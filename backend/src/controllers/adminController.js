const pool = require('../config/mysql');
const { processGatewayRefund } = require('../services/gatewayRefundService');
const { prepareChartForSchedule } = require('../services/chartPreparationService');
const { hashBcryptPassword } = require('../utils/passwordUtils');
const { createNotification } = require('../services/notificationService');

const VALID_SETTING_KEYS = {
  BOOKING_WINDOW_DAYS: 'number',
  CHART_HOURS_BEFORE_ORIGIN_DEPARTURE: 'number',
  CLERKAGE_PER_PASSENGER: 'number',
  CONCESSION_SENIOR_ENABLED: 'boolean',
  DYNAMIC_FARE_ENABLED: 'boolean',
  GST_RATE_AC: 'number',
  HOLD_MINUTES: 'number',
  INSURANCE_PREMIUM_PER_PASSENGER: 'number',
  MAX_PASSENGERS_PER_PNR: 'number',
  MAX_PASSENGERS_PER_PNR_TATKAL: 'number',
  MAX_TICKETS_PER_MONTH: 'number',
  MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED: 'number',
  MIN_CHARGEABLE_DISTANCE_KM: 'number'
};

/**
 * Middleware: Enforce ADMIN role
 */
function requireAdminRole(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: ADMIN role required'
      }
    });
  }
  next();
}

/**
 * GET /api/admin/tdr
 * List pending TDR claims (optional ?status=, default FILED and UNDER_REVIEW)
 */
async function getAdminTdrs(req, res, next) {
  try {
    const { status } = req.query;
    let querySql;
    let queryParams;

    if (status) {
      querySql = `
        SELECT t.tdr_ref_no, t.pnr, t.passenger_no, t.reason, t.status, t.filed_at,
               t.evidence_ref, t.refund_amount, t.remarks, t.reviewed_by, t.reviewed_at
        FROM TDR_FILING t
        WHERE t.status = ?
        ORDER BY t.filed_at DESC, t.tdr_ref_no DESC
      `;
      queryParams = [status];
    } else {
      querySql = `
        SELECT t.tdr_ref_no, t.pnr, t.passenger_no, t.reason, t.status, t.filed_at,
               t.evidence_ref, t.refund_amount, t.remarks, t.reviewed_by, t.reviewed_at
        FROM TDR_FILING t
        WHERE t.status IN ('FILED', 'UNDER_REVIEW')
        ORDER BY t.filed_at DESC, t.tdr_ref_no DESC
      `;
      queryParams = [];
    }

    const [rows] = await pool.query(querySql, queryParams);

    const data = rows.map(r => ({
      tdrRefNo: r.tdr_ref_no,
      pnr: r.pnr,
      passengerNo: r.passenger_no,
      reason: r.reason,
      status: r.status,
      filedAt: String(r.filed_at),
      evidenceRef: r.evidence_ref,
      refundAmount: r.refund_amount !== null ? parseFloat(r.refund_amount) : null,
      remarks: r.remarks,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null
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
 * PUT /api/admin/tdr/:tdrRefNo
 * Review a TDR claim (Contract 7.3)
 */
async function reviewTdr(req, res, next) {
  try {
    const { tdrRefNo } = req.params;
    const { status, remarks } = req.body;
    let { refundAmount } = req.body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Status must be either APPROVED or REJECTED'
        }
      });
    }

    let parsedRefundAmount = null;
    if (status === 'APPROVED') {
      parsedRefundAmount = parseFloat(refundAmount);
      if (isNaN(parsedRefundAmount) || parsedRefundAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'A valid positive refundAmount is required for APPROVED status'
          }
        });
      }
    }

    // Resolve adminId
    let adminId = req.user.adminId;
    if (!adminId) {
      const [adminRows] = await pool.query('SELECT admin_id FROM ADMIN WHERE user_id = ?', [req.user.userId]);
      if (adminRows.length > 0) {
        adminId = adminRows[0].admin_id;
      }
    }

    if (!adminId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No administrative credentials found for this user'
        }
      });
    }

    await pool.query(
      'CALL sp_review_tdr(?, ?, ?, ?, ?, 1, @out_refund_id, @out_status)',
      [tdrRefNo, adminId, status, parsedRefundAmount, remarks || null]
    );

    const [[{ out_refund_id, out_status }]] = await pool.query(
      'SELECT @out_refund_id AS out_refund_id, @out_status AS out_status'
    );

    if (out_status === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'TDR record not found'
        }
      });
    }

    if (out_status === 'FORBIDDEN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to review TDR'
        }
      });
    }

    if (out_status === 'ALREADY_REVIEWED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'TDR has already been reviewed'
        }
      });
    }

    if (out_status === 'INVALID_REFUND_AMOUNT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Refund amount is invalid or exceeds passenger fare line'
        }
      });
    }

    if (out_status === 'INVALID_DECISION') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid decision status'
        }
      });
    }

    if (out_status === 'NOT_ELIGIBLE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Passenger reservation status is not eligible for TDR approval'
        }
      });
    }

    if (out_status !== 'APPROVED' && out_status !== 'REJECTED') {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process TDR review'
        }
      });
    }

    if (out_status === 'APPROVED' || out_status === 'REJECTED') {
      const [tdrUserRows] = await pool.query(
        'SELECT t.pnr, b.user_id FROM TDR_FILING t JOIN BOOKING b ON t.pnr = b.pnr WHERE t.tdr_ref_no = ?',
        [tdrRefNo]
      );
      if (tdrUserRows.length > 0) {
        createNotification({
          userId: Number(tdrUserRows[0].user_id),
          type: 'STATUS_UPDATE',
          title: `TDR Claim ${out_status}`,
          message: `Your TDR claim ${tdrRefNo} for PNR ${tdrUserRows[0].pnr} was ${out_status.toLowerCase()}.`,
          referenceId: String(tdrRefNo)
        });
      }
    }

    if (out_status === 'APPROVED') {
      // Find PNR and payment record
      const [tdrRows] = await pool.query('SELECT pnr FROM TDR_FILING WHERE tdr_ref_no = ?', [tdrRefNo]);
      const tdrPnr = tdrRows.length > 0 ? tdrRows[0].pnr : null;

      let gatewayRefund = 'SKIPPED';
      if (tdrPnr) {
        const [payRows] = await pool.query(
          'SELECT payment_id, method, gateway_payment_id FROM PAYMENT WHERE pnr = ? AND status = "SUCCESS" ORDER BY paid_at DESC, payment_id DESC LIMIT 1',
          [tdrPnr]
        );
        if (payRows.length > 0 && payRows[0].gateway_payment_id) {
          try {
            const gwRes = await processGatewayRefund({
              pnr: tdrPnr,
              paymentMethod: payRows[0].method,
              gatewayPaymentId: payRows[0].gateway_payment_id,
              amountInRupees: parsedRefundAmount,
              refundIds: [out_refund_id],
              reason: 'TDR_APPROVED'
            });
            gatewayRefund = gwRes.status;
          } catch (gwErr) {
            gatewayRefund = 'FAILED';
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          tdrRefNo,
          status: 'APPROVED',
          refundAmount: parsedRefundAmount,
          refund: {
            refundId: out_refund_id,
            reason: 'TDR_APPROVED',
            status: 'PROCESSED'
          },
          gatewayRefund
        }
      });
    }

    // Status is REJECTED
    return res.status(200).json({
      success: true,
      data: {
        tdrRefNo,
        status: 'REJECTED',
        refundAmount: 0,
        refund: null
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/schedules/:scheduleId/chart-preparation
 * Prepares chart for schedule or returns existing result safely.
 */
async function prepareChart(req, res, next) {
  try {
    const { scheduleId } = req.params;
    const result = await prepareChartForSchedule(scheduleId, req.user ? req.user.userId : null);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/settings
 * List all system configuration settings (Contract 7.1)
 */
async function getSettings(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value, description, updated_at FROM SETTING ORDER BY setting_key ASC'
    );
    const data = rows.map(r => ({
      settingKey: r.setting_key,
      settingValue: r.setting_value,
      description: r.description,
      updatedAt: r.updated_at
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
 * PUT /api/admin/settings/:key
 * Update system configuration setting (Contract 7.1)
 * Audit logging is performed automatically by database trigger trg_audit_setting_change.
 */
async function updateSetting(req, res, next) {
  try {
    const { key } = req.params;
    if (!VALID_SETTING_KEYS[key]) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Unknown setting key: ${key}`
        }
      });
    }

    const rawVal = req.body.value !== undefined ? req.body.value : req.body.settingValue;
    if (rawVal === undefined || rawVal === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Setting value is required'
        }
      });
    }

    let valStr;
    const expectedType = VALID_SETTING_KEYS[key];
    if (expectedType === 'boolean') {
      if (rawVal === true || rawVal === 'true') {
        valStr = 'true';
      } else if (rawVal === false || rawVal === 'false') {
        valStr = 'false';
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Setting ${key} must be 'true' or 'false'`
          }
        });
      }
    } else if (expectedType === 'number') {
      const num = Number(rawVal);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Setting ${key} must be a positive number`
          }
        });
      }
      valStr = String(rawVal);
    }

    // Update setting (trigger trg_audit_setting_change fires and inserts into AUDIT_LOG)
    await pool.query(
      'UPDATE SETTING SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
      [valStr, key]
    );

    const [updatedRows] = await pool.query(
      'SELECT setting_key, setting_value, updated_at FROM SETTING WHERE setting_key = ?',
      [key]
    );

    const updated = updatedRows[0];
    return res.status(200).json({
      success: true,
      data: {
        settingKey: updated.setting_key,
        settingValue: updated.setting_value,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/audit-logs
 * List forensic audit log trail with paging and filters (Contract 7.4)
 */
async function getAuditLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const tableName = req.query.tableName || req.query.table_name || null;
    const recordId = req.query.recordId || req.query.record_id || null;
    const userId = req.query.userId || req.query.user_id || null;

    const whereClauses = [];
    const params = [];

    if (tableName) {
      whereClauses.push('table_name = ?');
      params.push(String(tableName));
    }
    if (recordId) {
      whereClauses.push('record_id = ?');
      params.push(String(recordId));
    }
    if (userId) {
      whereClauses.push('user_id = ?');
      params.push(Number(userId));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM AUDIT_LOG ${whereSql}`,
      params
    );
    const total = Number(countRows[0].total || 0);

    const [rows] = await pool.query(
      `SELECT log_id AS logId, user_id AS userId, action, table_name AS tableName,
              record_id AS recordId, old_value AS oldValue, new_value AS newValue,
              logged_at AS loggedAt
       FROM AUDIT_LOG
       ${whereSql}
       ORDER BY logged_at DESC, log_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: rows.map(r => ({
        logId: r.logId,
        userId: r.userId,
        action: r.action,
        tableName: r.tableName,
        recordId: r.recordId,
        oldValue: typeof r.oldValue === 'string' ? JSON.parse(r.oldValue) : r.oldValue,
        newValue: typeof r.newValue === 'string' ? JSON.parse(r.newValue) : r.newValue,
        loggedAt: r.loggedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}

const REPORTS_REGISTRY = {
  'busiest-trains': {
    reportType: 'BUSIEST_TRAINS',
    name: 'Top Busiest Trains Ranked by Passenger Count',
    description: 'Ranks trains by total passengers booked and revenue using RANK() and DENSE_RANK().',
    sql: `
      SELECT
          RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS rank_pos,
          DENSE_RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS dense_rank_pos,
          t.train_id,
          t.train_number,
          t.display_name AS train_name,
          t.train_type,
          COUNT(DISTINCT ts.schedule_id) AS total_runs_conducted,
          COUNT(pb.passenger_no) AS total_passengers_booked,
          ROUND(SUM(pb.total_fare), 2) AS total_revenue
      FROM TRAIN t
      JOIN TRAIN_SCHEDULE ts ON t.train_id = ts.train_id
      JOIN BOOKING b ON ts.schedule_id = b.schedule_id
      JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
      WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
      GROUP BY t.train_id, t.train_number, t.display_name, t.train_type
      ORDER BY rank_pos ASC
      LIMIT 15;
    `
  },
  'top-routes': {
    reportType: 'TOP_ROUTES',
    name: 'Top Routes Ranked by Gross Revenue',
    description: 'Ranks route origin-destination pairs by gross revenue using DENSE_RANK().',
    sql: `
      SELECT
          DENSE_RANK() OVER (ORDER BY SUM(pb.total_fare) DESC) AS revenue_rank,
          s_from.station_code AS origin_code,
          s_from.display_name AS origin_station,
          s_to.station_code AS destination_code,
          s_to.display_name AS destination_station,
          COUNT(DISTINCT b.pnr) AS total_bookings_count,
          ROUND(SUM(pb.total_fare), 2) AS gross_route_revenue,
          ROUND(AVG(pb.total_fare), 2) AS avg_fare_per_passenger
      FROM BOOKING b
      JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
      JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
      JOIN STATION s_from ON rs_from.station_id = s_from.station_id
      JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
      JOIN STATION s_to ON rs_to.station_id = s_to.station_id
      WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
      GROUP BY s_from.station_code, s_from.display_name, s_to.station_code, s_to.display_name
      ORDER BY revenue_rank ASC
      LIMIT 15;
    `
  },
  'station-ranking': {
    reportType: 'STATION_RANKING',
    name: 'Rank of Stations by Total Passenger Boardings',
    description: 'Ranks stations by total boarding passengers and originating revenue using RANK().',
    sql: `
      SELECT
          RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS station_rank,
          s.station_id,
          s.station_code,
          s.display_name AS station_name,
          s.city,
          s.state,
          COUNT(pb.passenger_no) AS total_boarding_passengers,
          ROUND(SUM(pb.total_fare), 2) AS originating_revenue
      FROM STATION s
      JOIN ROUTE_STOP rs ON s.station_id = rs.station_id
      JOIN BOOKING b ON rs.stop_id = b.from_stop_id
      JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
      WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
      GROUP BY s.station_id, s.station_code, s.display_name, s.city, s.state
      ORDER BY station_rank ASC
      LIMIT 20;
    `
  },
  'class-revenue': {
    reportType: 'CLASS_REVENUE',
    name: 'Class-wise Revenue, Volume and Cumulative Share',
    description: 'Calculates running cumulative revenue and percentage share across coach classes.',
    sql: `
      SELECT
          sc.class_code,
          sc.class_name,
          COUNT(pb.passenger_no) AS total_passengers,
          ROUND(SUM(pb.total_fare), 2) AS class_revenue,
          ROUND(SUM(SUM(pb.total_fare)) OVER (ORDER BY SUM(pb.total_fare) DESC), 2) AS running_cumulative_revenue,
          ROUND((SUM(pb.total_fare) / SUM(SUM(pb.total_fare)) OVER ()) * 100, 2) AS revenue_pct_share
      FROM SEAT_CLASS sc
      JOIN BOOKING b ON sc.class_id = b.class_id
      JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
      WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
      GROUP BY sc.class_code, sc.class_name
      ORDER BY class_revenue DESC;
    `
  },
  'quota-utilization': {
    reportType: 'QUOTA_UTILIZATION',
    name: 'Quota Utilization and Demand Spread',
    description: 'Ranks booking quotas by popularity and total fare collected using RANK().',
    sql: `
      SELECT
          b.quota,
          COUNT(DISTINCT b.pnr) AS total_bookings,
          COUNT(pb.passenger_no) AS total_passengers,
          ROUND(SUM(pb.total_fare), 2) AS total_fare_collected,
          ROUND(AVG(pb.total_fare), 2) AS avg_passenger_fare,
          RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS quota_popularity_rank
      FROM BOOKING b
      JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
      WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
      GROUP BY b.quota
      ORDER BY quota_popularity_rank ASC;
    `
  }
};

/**
 * GET /api/admin/reports
 * Lists all available analytical reports
 */
async function listReports(req, res, next) {
  try {
    const reports = Object.entries(REPORTS_REGISTRY).map(([key, def]) => ({
      reportKey: key,
      reportType: def.reportType,
      name: def.name,
      description: def.description
    }));

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/reports/:reportKey
 * Executes report query read-only, records run in REPORT table (report_id = MAX+1 in a transaction)
 */
async function getReportByKey(req, res, next) {
  let conn;
  try {
    const { reportKey } = req.params;
    const reportDef = REPORTS_REGISTRY[reportKey];
    if (!reportDef) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Unknown reportKey: ${reportKey}. Available reports: ${Object.keys(REPORTS_REGISTRY).join(', ')}`
        }
      });
    }

    let adminId = req.user.adminId;
    if (!adminId) {
      const [adminRows] = await pool.query('SELECT admin_id FROM ADMIN WHERE user_id = ?', [req.user.userId]);
      if (adminRows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin account record not found' }
        });
      }
      adminId = adminRows[0].admin_id;
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(report_id), 0) + 1 AS next_id FROM REPORT FOR UPDATE');
    const reportId = maxRows[0].next_id;

    await conn.query(
      'INSERT INTO REPORT (report_id, admin_id, report_type, generated_at) VALUES (?, ?, ?, NOW())',
      [reportId, adminId, reportDef.reportType]
    );

    await conn.commit();

    const [reportMeta] = await pool.query('SELECT generated_at FROM REPORT WHERE report_id = ?', [reportId]);

    // Execute report read-only SQL
    const [rows] = await pool.query(reportDef.sql);

    return res.status(200).json({
      success: true,
      data: {
        reportId,
        reportKey,
        reportType: reportDef.reportType,
        generatedAt: reportMeta[0].generated_at,
        rowCount: rows.length,
        rows
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * GET /api/admin/staff
 * Lists staff accounts (BR-ST1)
 */
async function getStaffList(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT s.staff_id AS staffId, s.employee_no AS employeeNo, s.designation, s.status,
             u.user_id AS userId, u.full_name AS name, u.email, u.phone, u.account_status AS accountStatus,
             u.created_at AS createdAt
      FROM STAFF s
      JOIN USER_ACCOUNT u ON s.user_id = u.user_id
      ORDER BY s.staff_id ASC
    `);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/staff
 * Creates staff user account and staff profile (BR-ST1, ADMIN only)
 * - Hashes password with bcrypt
 * - MAX+1 for user_id and staff_id in transaction
 * - Never returns or logs password
 * - Refuses duplicate employee number or email
 * - Writes AUDIT_LOG entry
 */
async function createStaffMember(req, res, next) {
  let conn;
  try {
    const { employeeNo, name, email, phone, designation, password } = req.body;

    if (!employeeNo || typeof employeeNo !== 'string' || !employeeNo.trim()) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'employeeNo is required' } });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'name is required' } });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Valid email is required' } });
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Valid phone is required' } });
    }
    if (!designation || typeof designation !== 'string' || !designation.trim()) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'designation is required' } });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Initial password must be at least 6 characters' } });
    }

    const trimmedEmpNo = employeeNo.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();
    const trimmedDesig = designation.trim();

    // Check duplicate employee number
    const [existingEmp] = await pool.query('SELECT staff_id FROM STAFF WHERE employee_no = ?', [trimmedEmpNo]);
    if (existingEmp.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Staff member with employee number ${trimmedEmpNo} already exists` }
      });
    }

    // Check duplicate email
    const [existingEmail] = await pool.query('SELECT user_id FROM USER_ACCOUNT WHERE email = ?', [trimmedEmail]);
    if (existingEmail.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `User account with email ${trimmedEmail} already exists` }
      });
    }

    // Hash password with bcrypt
    const passwordHash = await hashBcryptPassword(password);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxUserRows] = await conn.query('SELECT COALESCE(MAX(user_id), 0) + 1 AS next_user_id FROM USER_ACCOUNT FOR UPDATE');
    const newUserId = maxUserRows[0].next_user_id;

    const [maxStaffRows] = await conn.query('SELECT COALESCE(MAX(staff_id), 0) + 1 AS next_staff_id FROM STAFF FOR UPDATE');
    const newStaffId = maxStaffRows[0].next_staff_id;

    await conn.query(
      `INSERT INTO USER_ACCOUNT (user_id, email, password_hash, phone, full_name, role, account_status, aadhaar_verified, created_at)
       VALUES (?, ?, ?, ?, ?, 'STAFF', 'ACTIVE', 0, NOW())`,
      [newUserId, trimmedEmail, passwordHash, trimmedPhone, trimmedName]
    );

    await conn.query(
      `INSERT INTO STAFF (staff_id, user_id, employee_no, designation, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [newStaffId, newUserId, trimmedEmpNo, trimmedDesig]
    );

    // Write AUDIT_LOG entry with admin user id
    const adminUserId = req.user.userId;
    const auditNewVal = JSON.stringify({
      staffId: newStaffId,
      userId: newUserId,
      employeeNo: trimmedEmpNo,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      designation: trimmedDesig,
      status: 'ACTIVE'
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'CREATE_STAFF', 'STAFF', ?, NULL, ?, NOW())`,
      [adminUserId, String(newStaffId), auditNewVal]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        staffId: newStaffId,
        userId: newUserId,
        employeeNo: trimmedEmpNo,
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        designation: trimmedDesig,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * PUT /api/admin/staff/:staffId/status
 * Updates staff status (ACTIVE, ON_LEAVE, SUSPENDED)
 * - Synchronizes USER_ACCOUNT.account_status (SUSPENDED prevents login)
 * - Writes AUDIT_LOG entry
 */
async function updateStaffStatus(req, res, next) {
  let conn;
  try {
    const { staffId } = req.params;
    const numStaffId = Number(staffId);
    if (!numStaffId || isNaN(numStaffId)) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid staffId' } });
    }

    const { status } = req.body;
    const validStatuses = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }
      });
    }

    const [staffRows] = await pool.query(
      'SELECT s.staff_id, s.user_id, s.employee_no, s.status, u.account_status FROM STAFF s JOIN USER_ACCOUNT u ON s.user_id = u.user_id WHERE s.staff_id = ?',
      [numStaffId]
    );

    if (staffRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Staff member not found' }
      });
    }

    const staff = staffRows[0];
    const oldStatus = staff.status;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('UPDATE STAFF SET status = ? WHERE staff_id = ?', [status, numStaffId]);

    // Keep USER_ACCOUNT.account_status in sync (e.g. SUSPENDED prevents login across all portals)
    const newAccountStatus = status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    await conn.query('UPDATE USER_ACCOUNT SET account_status = ? WHERE user_id = ?', [newAccountStatus, staff.user_id]);

    // Write AUDIT_LOG entry with admin user id
    const adminUserId = req.user.userId;
    const oldVal = JSON.stringify({ status: oldStatus });
    const newVal = JSON.stringify({ status });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'UPDATE_STAFF_STATUS', 'STAFF', ?, ?, ?, NOW())`,
      [adminUserId, String(numStaffId), oldVal, newVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      data: {
        staffId: numStaffId,
        employeeNo: staff.employee_no,
        status
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  requireAdminRole,
  getAdminTdrs,
  reviewTdr,
  prepareChart,
  getSettings,
  updateSetting,
  getAuditLogs,
  listReports,
  getReportByKey,
  getStaffList,
  createStaffMember,
  updateStaffStatus
};
