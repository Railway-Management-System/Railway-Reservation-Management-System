const pool = require('../config/mysql');
const AppError = require('../utils/appError');

const ALLOWED_TYPES = ['CLEANING', 'REPAIR', 'AC_SERVICE', 'INSPECTION', 'SAFETY_CHECK'];

/**
 * Middleware: require STAFF with active MAINTENANCE_DUTY or ADMIN
 */
async function requireMaintenanceRole(req, res, next) {
  try {
    const role = (req.user && req.user.role ? req.user.role : '').toUpperCase();
    if (role === 'ADMIN') {
      return next();
    }
    if (role === 'STAFF') {
      let staffId = req.user.staffId;
      if (!staffId) {
        const [sRows] = await pool.query('SELECT staff_id FROM STAFF WHERE user_id = ?', [req.user.userId]);
        if (sRows.length > 0) {
          staffId = sRows[0].staff_id;
          req.user.staffId = staffId;
        }
      }
      if (staffId) {
        const [assignRows] = await pool.query(
          'SELECT COUNT(*) AS cnt FROM STAFF_ASSIGNMENT WHERE staff_id = ? AND duty_type = "MAINTENANCE_DUTY"',
          [staffId]
        );
        if (assignRows[0].cnt > 0) {
          return next();
        }
      }
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: staff must have an active MAINTENANCE_DUTY assignment'
        }
      });
    }
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: STAFF with MAINTENANCE_DUTY or ADMIN role required'
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/maintenance/tasks
 * Contract 6.1 (BR-M1, BR-M2)
 * Exactly one of coachId or platformId must be provided.
 * Uses MAX(maint_id) + 1 inside transaction as maint_id has no AUTO_INCREMENT.
 */
async function createTask(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { coachId, platformId, type, description } = req.body;

    const hasCoach = coachId !== undefined && coachId !== null;
    const hasPlatform = platformId !== undefined && platformId !== null;

    if ((hasCoach && hasPlatform) || (!hasCoach && !hasPlatform)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Exactly one of coachId or platformId must be non-null'
        }
      });
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid maintenance task type. Must be one of: ${ALLOWED_TYPES.join(', ')}`
        }
      });
    }

    // Resolve staffId
    let staffId = null;
    const role = (req.user && req.user.role ? req.user.role : '').toUpperCase();
    if (role === 'STAFF') {
      staffId = req.user.staffId;
    } else if (role === 'ADMIN') {
      if (req.body.staffId) {
        staffId = parseInt(req.body.staffId, 10);
      } else {
        const [maintStaffRows] = await pool.query(
          'SELECT staff_id FROM STAFF_ASSIGNMENT WHERE duty_type = "MAINTENANCE_DUTY" LIMIT 1'
        );
        if (maintStaffRows.length > 0) {
          staffId = maintStaffRows[0].staff_id;
        } else {
          const [anyStaffRows] = await pool.query('SELECT staff_id FROM STAFF WHERE status = "ACTIVE" LIMIT 1');
          staffId = anyStaffRows.length > 0 ? anyStaffRows[0].staff_id : 1;
        }
      }
    }

    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(maint_id), 0) + 1 AS next_id FROM MAINTENANCE FOR UPDATE');
    const maintId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO MAINTENANCE (maint_id, staff_id, coach_id, platform_id, type, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'OPEN', NOW())`,
      [maintId, staffId, hasCoach ? Number(coachId) : null, hasPlatform ? Number(platformId) : null, type]
    );

    await conn.commit();

    const [createdRows] = await pool.query('SELECT created_at FROM MAINTENANCE WHERE maint_id = ?', [maintId]);
    const createdAt = createdRows.length > 0 && createdRows[0].created_at
      ? createdRows[0].created_at
      : null;

    return res.status(201).json({
      success: true,
      data: {
        maintId,
        coachId: hasCoach ? Number(coachId) : null,
        platformId: hasPlatform ? Number(platformId) : null,
        type,
        status: 'OPEN',
        createdAt
      }
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
}

/**
 * PUT /api/maintenance/tasks/:maintId/status
 * Contract 6.2 (BR-M4)
 * Allowed status moves:
 * - OPEN -> IN_PROGRESS or CANCELLED
 * - IN_PROGRESS -> COMPLETED or CANCELLED
 * Sets completed_at on COMPLETED; refuses any other move.
 */
async function updateTaskStatus(req, res, next) {
  try {
    const maintId = parseInt(req.params.maintId, 10);
    if (isNaN(maintId) || maintId <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Valid numeric maintId is required'
        }
      });
    }

    const { status: newStatus } = req.body;
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Target status is required'
        }
      });
    }

    const [taskRows] = await pool.query(
      'SELECT maint_id, staff_id, coach_id, platform_id, type, status, created_at, completed_at FROM MAINTENANCE WHERE maint_id = ?',
      [maintId]
    );

    if (taskRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Maintenance task not found'
        }
      });
    }

    const currentStatus = taskRows[0].status;

    // Validate status transition
    const isValidTransition =
      (currentStatus === 'OPEN' && (newStatus === 'IN_PROGRESS' || newStatus === 'CANCELLED')) ||
      (currentStatus === 'IN_PROGRESS' && (newStatus === 'COMPLETED' || newStatus === 'CANCELLED'));

    if (!isValidTransition) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: OPEN -> IN_PROGRESS / CANCELLED, IN_PROGRESS -> COMPLETED / CANCELLED`
        }
      });
    }

    let completedAt = null;
    if (newStatus === 'COMPLETED') {
      await pool.query(
        'UPDATE MAINTENANCE SET status = ?, completed_at = NOW() WHERE maint_id = ?',
        [newStatus, maintId]
      );
      const [updatedRows] = await pool.query('SELECT completed_at FROM MAINTENANCE WHERE maint_id = ?', [maintId]);
      completedAt = updatedRows[0].completed_at || null;
    } else {
      await pool.query(
        'UPDATE MAINTENANCE SET status = ? WHERE maint_id = ?',
        [newStatus, maintId]
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        maintId,
        status: newStatus,
        completedAt
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireMaintenanceRole,
  createTask,
  updateTaskStatus
};
