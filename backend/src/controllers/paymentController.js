const crypto = require('crypto');
const Razorpay = require('razorpay');
const pool = require('../config/mysql');
const config = require('../config/env');
const { getMongoDb } = require('../config/mongodb');
const AppError = require('../utils/appError');
const { releaseExpiredHolds } = require('../services/holdCleanupService');
const { toPaise, processGatewayRefund } = require('../services/gatewayRefundService');

/**
 * Initialize Razorpay instance with key and secret
 */
function getRazorpayClient() {
  return new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET
  });
}

/**
 * 4.3.1 Create Gateway Order
 * POST /api/payments/razorpay/order
 */
async function createOrder(req, res, next) {
  try {
    // Release any expired holds first
    await releaseExpiredHolds();

    const userId = req.user.user_id || req.user.userId;
    const { pnr } = req.body;

    if (!pnr) {
      throw new AppError('VALIDATION_ERROR', 'PNR is required to create order', 400);
    }

    // Retrieve booking details and verify hold window
    const [bookingRows] = await pool.query(
      `SELECT b.pnr, b.user_id, b.total_fare, b.status, b.created_at,
              CAST(COALESCE(s.setting_value, '10') AS SIGNED) AS hold_minutes,
              NOW() AS db_now,
              (NOW() > DATE_ADD(b.created_at, INTERVAL CAST(COALESCE(s.setting_value, '10') AS SIGNED) MINUTE)) AS is_expired
       FROM BOOKING b
       LEFT JOIN SETTING s ON s.setting_key = 'HOLD_MINUTES'
       WHERE b.pnr = ?`,
      [pnr]
    );

    if (bookingRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRows[0];

    // Only the owner of the PNR may create an order
    if (Number(booking.user_id) !== Number(userId)) {
      throw new AppError('FORBIDDEN', 'Access denied: you do not own this booking', 403);
    }

    // Must be PAYMENT_PENDING and within hold window
    if (booking.status !== 'PAYMENT_PENDING' || Number(booking.is_expired) === 1) {
      throw new AppError('HOLD_EXPIRED', 'The 10-minute seat hold timer lapsed before payment completion.', 400);
    }

    // Convert total_fare from database to paise with exact integer math
    const amountInPaise = toPaise(booking.total_fare);

    const razorpay = getRazorpayClient();
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: String(pnr)
    };

    const order = await razorpay.orders.create(orderOptions);

    // Store full raw Razorpay reply plus pnr in MongoDB raw_gateway_replies
    const db = getMongoDb();
    if (db) {
      await db.collection('raw_gateway_replies').insertOne({
        pnr: String(pnr),
        type: 'order_create',
        orderId: order.id,
        amount: amountInPaise,
        reply: order,
        createdAt: new Date()
      });
    }

    // Do NOT insert into PAYMENT table
    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        keyId: config.RAZORPAY_KEY_ID,
        pnr: String(pnr)
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * 4.3.2 Verify Gateway Payment Signature & Issue Ticket
 * POST /api/payments/razorpay/verify
 */
async function verifyPayment(req, res, next) {
  try {
    // Release any expired holds first
    await releaseExpiredHolds();

    const userId = req.user.user_id || req.user.userId;
    const { pnr, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!pnr || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new AppError('VALIDATION_ERROR', 'pnr, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required', 400);
    }

    // Verify booking ownership
    const [bookingRows] = await pool.query(
      'SELECT pnr, user_id, total_fare, status FROM BOOKING WHERE pnr = ?',
      [pnr]
    );

    if (bookingRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRows[0];
    if (Number(booking.user_id) !== Number(userId)) {
      throw new AppError('FORBIDDEN', 'Access denied: you do not own this booking', 403);
    }

    const db = getMongoDb();
    const expectedAmount = toPaise(booking.total_fare);

    // Look up saved order in MongoDB raw_gateway_replies
    let savedOrder = null;
    if (db) {
      savedOrder = await db.collection('raw_gateway_replies').findOne({
        pnr: String(pnr),
        orderId: String(razorpayOrderId)
      });
    }

    if (!savedOrder) {
      throw new AppError('BAD_REQUEST', 'Order not found for this PNR in gateway records', 400);
    }

    if (Number(savedOrder.amount) !== expectedAmount) {
      throw new AppError('BAD_REQUEST', 'Order amount mismatch', 400);
    }

    // Signature verification using crypto.timingSafeEqual with length check
    const generatedSignature = crypto
      .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const sigBuf = Buffer.from(String(razorpaySignature), 'utf8');
    const genBuf = Buffer.from(generatedSignature, 'utf8');

    if (sigBuf.length !== genBuf.length || !crypto.timingSafeEqual(sigBuf, genBuf)) {
      throw new AppError('BAD_REQUEST', 'Invalid payment signature', 400);
    }

    // Call stored procedure sp_confirm_payment with p_manage_tx = 1
    const p_manage_tx = 1;
    const [confirmResult] = await pool.query(
      `CALL sp_confirm_payment(?, ?, 'UPI', ?, ?, @out_status, @out_payment_id);
       SELECT @out_status AS status, @out_payment_id AS payment_id;`,
      [pnr, booking.total_fare, razorpayPaymentId, p_manage_tx]
    );

    let output = null;
    if (Array.isArray(confirmResult)) {
      for (const r of confirmResult) {
        if (Array.isArray(r) && r.length > 0 && r[0].status !== undefined) {
          output = r[0];
          break;
        }
      }
    }

    if (!output) {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to confirm payment via procedure', 500);
    }

    const outStatus = output.status;
    const outPaymentId = output.payment_id;

    // Handle LATE payment status
    if (outStatus === 'LATE') {
      // Query REFUND record from MySQL
      const [refundRows] = await pool.query(
        `SELECT r.refund_id, r.amount, r.reason, r.status
         FROM REFUND r
         JOIN PAYMENT p ON r.payment_id = p.payment_id
         WHERE p.gateway_payment_id = ?
         LIMIT 1`,
        [razorpayPaymentId]
      );
      const refundRow = refundRows[0] || null;
      const lateRefundIds = refundRow ? [refundRow.refund_id] : [];

      await processGatewayRefund({
        pnr,
        paymentMethod: 'UPI',
        gatewayPaymentId: razorpayPaymentId,
        amountInRupees: booking.total_fare,
        refundIds: lateRefundIds,
        reason: 'PAYMENT_AFTER_EXPIRY'
      });

      if (db) {
        await db.collection('raw_gateway_replies').insertOne({
          pnr: String(pnr),
          type: 'verify_late',
          paymentId: outPaymentId,
          gatewayPaymentId: String(razorpayPaymentId),
          status: 'LATE',
          createdAt: new Date()
        });
      }

      // Contract 4.3.2 response for late payment (200 OK)
      return res.status(200).json({
        success: false,
        error: {
          code: 'HOLD_EXPIRED',
          message: 'Payment arrived after the seat hold expired (HOLD_MINUTES). No seats were assigned. Your payment has been refunded in full automatically.'
        },
        data: {
          bookingStatus: 'FAILED',
          refund: {
            refundId: refundRow ? refundRow.refund_id : null,
            amount: Number(booking.total_fare),
            reason: refundRow ? refundRow.reason : 'PAYMENT_AFTER_EXPIRY',
            status: refundRow ? refundRow.status : 'PROCESSED',
            gatewayPaymentId: String(razorpayPaymentId)
          }
        }
      });
    }

    // Normal payment success (CONFIRMED, RAC, WAITING_LIST)
    if (db) {
      await db.collection('raw_gateway_replies').insertOne({
        pnr: String(pnr),
        type: 'verify_success',
        paymentId: outPaymentId,
        gatewayPaymentId: String(razorpayPaymentId),
        status: outStatus,
        createdAt: new Date()
      });
    }

    // Retrieve PAYMENT record
    const [paymentRows] = await pool.query(
      'SELECT payment_id, pnr, amount, method, status, gateway_payment_id, paid_at FROM PAYMENT WHERE payment_id = ?',
      [outPaymentId]
    );
    if (paymentRows.length === 0) {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Payment record not found', 500);
    }
    const paymentRecord = paymentRows[0];
    const paidAt = String(paymentRecord.paid_at);

    // Retrieve passenger reservation allotment
    const [passengers] = await pool.query(
      `SELECT pb.passenger_no, pb.name,
              c.coach_code AS coachNumber,
              s.seat_number AS seatNumber,
              s.berth_type AS berthType,
              r.status, r.queue_position
       FROM PASSENGER_BOOKING pb
       JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
       LEFT JOIN SEAT s ON r.seat_id = s.seat_id
       LEFT JOIN COACH c ON s.coach_id = c.coach_id
       WHERE pb.pnr = ?
       ORDER BY pb.passenger_no ASC`,
      [pnr]
    );

    return res.status(200).json({
      success: true,
      data: {
        paymentId: paymentRecord.payment_id,
        pnr: String(pnr),
        paymentStatus: paymentRecord.status,
        gatewayPaymentId: String(razorpayPaymentId),
        paidAt,
        bookingStatus: outStatus,
        passengers: passengers.map(p => {
          const item = {
            passengerNo: p.passenger_no,
            name: p.name,
            coachNumber: p.coachNumber || null,
            seatNumber: p.seatNumber || null,
            berthType: p.berthType || null,
            status: p.status
          };
          if (p.queue_position) {
            item.queuePosition = p.queue_position;
          }
          return item;
        })
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  verifyPayment
};
