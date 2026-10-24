const jwt = require('jsonwebtoken');
const config = require('../config/env');
const pool = require('../config/mysql');
const AppError = require('../utils/appError');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Authorization header with Bearer token is required', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Bearer token is missing', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired authentication token', 401);
    }

    const [rows] = await pool.query(
      'SELECT user_id, email, phone, full_name, role, account_status, aadhaar_verified, created_at FROM USER_ACCOUNT WHERE user_id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'User associated with this token no longer exists', 401);
    }

    const user = rows[0];
    if (user.account_status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', `User account is ${user.account_status.toLowerCase()}`, 403);
    }

    user.userId = user.user_id;
    if (decoded.staffId) {
      user.staffId = decoded.staffId;
    } else if (user.role === 'STAFF') {
      const [staffRows] = await pool.query('SELECT staff_id FROM STAFF WHERE user_id = ?', [user.user_id]);
      if (staffRows.length > 0) {
        user.staffId = staffRows[0].staff_id;
      }
    }

    if (decoded.adminId) {
      user.adminId = decoded.adminId;
    } else if (user.role === 'ADMIN') {
      const [adminRows] = await pool.query('SELECT admin_id FROM ADMIN WHERE user_id = ?', [user.user_id]);
      if (adminRows.length > 0) {
        user.adminId = adminRows[0].admin_id;
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticate
};
