const Razorpay = require('razorpay');
const config = require('../config/env');
const { getMongoDb } = require('../config/mongodb');

/**
 * Convert rupee decimal to exact paise integer using BigInt math (never floating point)
 */
function toPaise(decimalStrOrNum) {
  const s = String(decimalStrOrNum).trim();
  const parts = s.split('.');
  const rupees = BigInt(parts[0] || '0');
  const frac = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const paise = BigInt(frac);
  return Number(rupees * 100n + paise);
}

/**
 * Detects real/gateway Razorpay payment IDs vs seeded fake IDs and simulated test IDs.
 * - Seeded fake IDs in database: 'pay_test_2849100000_1002' (all 16,375 seeded rows start with 'pay_test_')
 * - Simulated test IDs in scripts: 'pay_sim_...'
 * - Real Razorpay payment IDs: 'pay_' followed by exactly 14 letters or digits.
 */
function isRealRazorpayPaymentId(id) {
  if (typeof id !== 'string') return false;
  if (id.startsWith('pay_test_') || id.startsWith('pay_sim_')) return false;
  return /^pay_[a-zA-Z0-9]{14}$/.test(id);
}

let _razorpayClientOverride = null;

function setRazorpayClientOverride(mockClient) {
  _razorpayClientOverride = mockClient;
}

/**
 * Shared gateway refund helper for online payments.
 * Performs idempotent Razorpay refund and logs raw replies to MongoDB raw_gateway_replies.
 * 
 * @param {Object} params
 * @param {string} params.pnr - Booking PNR
 * @param {string} [params.paymentMethod] - Payment method ('UPI', 'NET_BANKING', 'CREDIT_CARD', 'CASH', etc.)
 * @param {string} params.gatewayPaymentId - Payment transaction ID from gateway
 * @param {number|string} params.amountInRupees - Refund amount in INR
 * @param {Array<number>} [params.refundIds] - Array of database REFUND IDs covered by this refund call
 * @param {string} params.reason - Reason for refund ('CANCELLATION', 'PAYMENT_AFTER_EXPIRY', etc.)
 * @returns {Promise<{ status: 'SUCCESS'|'FAILED'|'SKIPPED', reason?: string, reply?: Object, error?: string, isIdempotent?: boolean }>}
 */
async function processGatewayRefund({ pnr, paymentMethod, gatewayPaymentId, amountInRupees, refundIds, reason }) {
  // 1. Skip CASH payments or payments without gateway IDs
  if (paymentMethod === 'CASH' || !gatewayPaymentId) {
    return { status: 'SKIPPED', reason: 'CASH_OR_NO_GATEWAY_ID' };
  }

  // 2. Skip seeded fake IDs and simulated test IDs
  if (!isRealRazorpayPaymentId(gatewayPaymentId)) {
    return { status: 'SKIPPED', reason: 'SEEDED_OR_SIMULATED_PAYMENT_ID', gatewayPaymentId };
  }

  const db = getMongoDb();
  const sortedRefundIds = Array.isArray(refundIds)
    ? refundIds.map(Number).sort((a, b) => a - b)
    : [];

  // 3. Idempotency check: payment id PLUS list of REFUND ids covered by this call
  if (db) {
    const query = {
      paymentId: String(gatewayPaymentId),
      type: { $in: ['refund_success', 'refund_failure'] }
    };
    if (sortedRefundIds.length > 0) {
      query.refundIds = sortedRefundIds;
    }
    const existing = await db.collection('raw_gateway_replies').findOne(query);
    if (existing) {
      return {
        status: existing.type === 'refund_success' ? 'SUCCESS' : 'FAILED',
        reply: existing.reply,
        isIdempotent: true
      };
    }
  }

  // 4. Exact integer math for paise
  const amountInPaise = toPaise(amountInRupees);

  // 5. Invoke live/test Razorpay API or simulated test client
  const razorpay = _razorpayClientOverride || new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET
  });

  try {
    const reply = await razorpay.payments.refund(gatewayPaymentId, {
      amount: amountInPaise,
      notes: { pnr: String(pnr), reason: String(reason || 'CANCELLATION') }
    });

    if (db) {
      await db.collection('raw_gateway_replies').insertOne({
        pnr: String(pnr),
        type: 'refund_success',
        paymentId: String(gatewayPaymentId),
        refundIds: sortedRefundIds,
        amount: amountInPaise,
        reason,
        reply,
        createdAt: new Date()
      });
    }

    return { status: 'SUCCESS', reply };
  } catch (err) {
    const errorDescription = (err.error && err.error.description) || err.description || err.message || 'Unknown gateway error';
    const statusCode = err.statusCode || (err.error && err.error.code) || 'N/A';
    console.error(`[GATEWAY_REFUND_FAIL]: (status: ${statusCode}) ${errorDescription}`);

    if (db) {
      await db.collection('raw_gateway_replies').insertOne({
        pnr: String(pnr),
        type: 'refund_failure',
        paymentId: String(gatewayPaymentId),
        refundIds: sortedRefundIds,
        amount: amountInPaise,
        reason,
        reply: {
          statusCode: err.statusCode || null,
          description: errorDescription,
          error: err.error || err
        },
        createdAt: new Date()
      });
    }
    return { status: 'FAILED', error: errorDescription, statusCode };
  }
}

module.exports = {
  toPaise,
  isRealRazorpayPaymentId,
  processGatewayRefund,
  setRazorpayClientOverride
};
