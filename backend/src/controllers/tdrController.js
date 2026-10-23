const pool = require('../config/mysql');

/**
 * Middleware: Enforce PASSENGER role
 */
function requirePassengerRole(req, res, next) {
  if (!req.user || req.user.role !== 'PASSENGER') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: PASSENGER role required'
      }
    });
  }
  next();
}

/**
 * POST /api/tdr
 * Contract 4.6: File a TDR claim.
 * Creates one TDR_FILING row per passenger.
 */
async function fileTdr(req, res, next) {
  try {
    const { pnr, reason, remarks } = req.body;
    const evidenceRef = req.body.evidenceReference || req.body.evidenceRef || null;
    let passengerNos = req.body.passengerNos;

    if (!pnr || typeof pnr !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Valid 10-digit PNR is required'
        }
      });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Reason code is required'
        }
      });
    }

    if (!passengerNos && req.body.passengerNo !== undefined) {
      passengerNos = [req.body.passengerNo];
    }

    if (!Array.isArray(passengerNos) || passengerNos.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'At least one passenger number must be provided in passengerNos'
        }
      });
    }

    const createdTdrs = [];
    let filedAtStr = null;

    for (const pNo of passengerNos) {
      const passengerNo = parseInt(pNo, 10);
      if (isNaN(passengerNo) || passengerNo < 1) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: `Invalid passenger number: ${pNo}`
          }
        });
      }

      await pool.query(
        'CALL sp_file_tdr(?, ?, ?, ?, ?, ?, 1, @out_tdr_ref_no, @out_status)',
        [pnr, passengerNo, req.user.userId, reason, evidenceRef, remarks || null]
      );

      const [[{ out_tdr_ref_no, out_status }]] = await pool.query(
        'SELECT @out_tdr_ref_no AS out_tdr_ref_no, @out_status AS out_status'
      );

      if (out_status === 'NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Booking or passenger ${passengerNo} not found`
          }
        });
      }

      if (out_status === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only file a TDR for your own bookings'
          }
        });
      }

      if (out_status === 'DUPLICATE_TDR') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: `A TDR is already filed, under review, or approved for passenger ${passengerNo}`
          }
        });
      }

      if (out_status === 'NOT_ELIGIBLE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Passenger reservation status or train delay is not eligible for this TDR reason'
          }
        });
      }

      if (out_status === 'EVIDENCE_REQUIRED') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Evidence reference is required for this TDR reason'
          }
        });
      }

      if (out_status === 'DEADLINE_EXCEEDED') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'TDR filing deadline has passed or train has already departed'
          }
        });
      }

      if (out_status === 'INVALID_REASON') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid TDR reason code'
          }
        });
      }

      if (out_status !== 'FILED') {
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to file TDR'
          }
        });
      }

      createdTdrs.push({
        tdrRefNo: out_tdr_ref_no,
        passengerNo,
        status: 'FILED'
      });
    }

    // Query filed_at of the first created record
    if (createdTdrs.length > 0) {
      const [rows] = await pool.query(
        'SELECT filed_at FROM TDR_FILING WHERE tdr_ref_no = ?',
        [createdTdrs[0].tdrRefNo]
      );
      if (rows.length > 0 && rows[0].filed_at) {
        filedAtStr = String(rows[0].filed_at);
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        tdrRefNo: createdTdrs[0].tdrRefNo,
        pnr,
        reason,
        status: 'FILED',
        filedAt: filedAtStr,
        tdrRefNos: createdTdrs.map(t => t.tdrRefNo),
        tdrs: createdTdrs
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tdr
 * Retrieve own filed TDRs for logged-in passenger
 */
async function getMyTdrs(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT t.tdr_ref_no, t.pnr, t.passenger_no, t.reason, t.status, t.filed_at, t.refund_amount, t.remarks
       FROM TDR_FILING t
       JOIN BOOKING b ON t.pnr = b.pnr
       WHERE b.user_id = ?
       ORDER BY t.filed_at DESC, t.tdr_ref_no DESC`,
      [req.user.userId]
    );

    const data = rows.map(r => ({
      tdrRefNo: r.tdr_ref_no,
      pnr: r.pnr,
      passengerNo: r.passenger_no,
      reason: r.reason,
      status: r.status,
      filedAt: String(r.filed_at),
      refundAmount: r.refund_amount !== null ? parseFloat(r.refund_amount) : null,
      remarks: r.remarks
    }));

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tdr/:tdrRefNo
 * Retrieve single TDR by reference number (own only)
 */
async function getTdrByRefNo(req, res, next) {
  try {
    const { tdrRefNo } = req.params;

    const [rows] = await pool.query(
      `SELECT t.tdr_ref_no, t.pnr, t.passenger_no, t.reason, t.status, t.filed_at, t.refund_amount, t.remarks, b.user_id
       FROM TDR_FILING t
       JOIN BOOKING b ON t.pnr = b.pnr
       WHERE t.tdr_ref_no = ?`,
      [tdrRefNo]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'TDR record not found'
        }
      });
    }

    const row = rows[0];
    if (row.user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You may only view your own TDR filings'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        tdrRefNo: row.tdr_ref_no,
        pnr: row.pnr,
        passengerNo: row.passenger_no,
        reason: row.reason,
        status: row.status,
        filedAt: String(row.filed_at),
        refundAmount: row.refund_amount !== null ? parseFloat(row.refund_amount) : null,
        remarks: row.remarks
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requirePassengerRole,
  fileTdr,
  getMyTdrs,
  getTdrByRefNo
};
