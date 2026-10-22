const jwt = require('jsonwebtoken');
const pool = require('../config/mysql');
const config = require('../config/env');
const AppError = require('../utils/appError');
const { hashBcryptPassword, verifyPassword } = require('../utils/passwordUtils');

function generateToken(payload) {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '24h' });
}

async function getMonthlyTicketCount(userId) {
  try {
    const [rows] = await pool.query('SELECT fn_get_user_monthly_ticket_count(?, NOW()) as cnt', [userId]);
    return rows && rows[0] && rows[0].cnt !== null ? Number(rows[0].cnt) : 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Passenger Registration: POST /api/auth/passenger/register
 */
async function registerPassenger(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Full name is required', 400);
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new AppError('VALIDATION_ERROR', 'A valid email address is required', 400);
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      throw new AppError('VALIDATION_ERROR', 'A valid phone number is required', 400);
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new AppError('VALIDATION_ERROR', 'Password must be at least 6 characters long', 400);
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    // Check unique email and phone
    const [existing] = await pool.query(
      'SELECT user_id, email, phone FROM USER_ACCOUNT WHERE email = ? OR phone = ?',
      [trimmedEmail, trimmedPhone]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (match.email === trimmedEmail) {
        throw new AppError('CONFLICT', 'Email is already registered', 409);
      }
      throw new AppError('CONFLICT', 'Phone number is already registered', 409);
    }

    const passwordHash = await hashBcryptPassword(password);

    // Atomic assignment of next user_id
    const connection = await pool.getConnection();
    let newUserId;
    try {
      await connection.beginTransaction();
      const [maxRow] = await connection.query('SELECT COALESCE(MAX(user_id), 0) + 1 AS next_id FROM USER_ACCOUNT FOR UPDATE');
      newUserId = maxRow[0].next_id;

      await connection.query(
        `INSERT INTO USER_ACCOUNT (
          user_id, email, password_hash, phone, full_name,
          role, account_status, aadhaar_verified, created_at
        ) VALUES (?, ?, ?, ?, ?, 'PASSENGER', 'ACTIVE', 0, NOW())`,
        [newUserId, trimmedEmail, passwordHash, trimmedPhone, trimmedName]
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const token = generateToken({
      userId: newUserId,
      email: trimmedEmail,
      role: 'PASSENGER'
    });

    return res.status(201).json({
      success: true,
      data: {
        userId: newUserId,
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        role: 'PASSENGER',
        accountStatus: 'ACTIVE',
        aadhaarVerified: false,
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Passenger Login: POST /api/auth/passenger/login
 */
async function loginPassenger(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'Email and password are required', 400);
    }

    const [rows] = await pool.query(
      'SELECT user_id, email, password_hash, phone, full_name, role, account_status, aadhaar_verified FROM USER_ACCOUNT WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const user = rows[0];

    if (user.role !== 'PASSENGER') {
      throw new AppError('FORBIDDEN', 'Please use the appropriate staff or admin login portal', 403);
    }

    if (user.account_status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', `Your account is ${user.account_status.toLowerCase()}`, 403);
    }

    const isMatch = await verifyPassword(password, user.password_hash, user.user_id);
    if (!isMatch) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      role: user.role
    });

    const monthlyUsed = await getMonthlyTicketCount(user.user_id);
    const monthlyAllowed = user.aadhaar_verified ? 24 : 12;

    return res.status(200).json({
      success: true,
      data: {
        userId: user.user_id,
        name: user.full_name,
        role: user.role,
        aadhaarVerified: Boolean(user.aadhaar_verified),
        monthlyBookingsUsed: monthlyUsed,
        monthlyBookingsAllowed: monthlyAllowed,
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Staff Login: POST /api/auth/staff/login
 */
async function loginStaff(req, res, next) {
  try {
    const { employeeId, email, password } = req.body;

    if ((!employeeId && !email) || !password) {
      throw new AppError('VALIDATION_ERROR', 'Employee ID or email, and password are required', 400);
    }

    let rows;
    if (employeeId) {
      [rows] = await pool.query(
        `SELECT u.user_id, u.email, u.password_hash, u.full_name, u.role, u.account_status,
                s.staff_id, s.employee_no, s.designation, s.status as staff_status
         FROM STAFF s
         JOIN USER_ACCOUNT u ON s.user_id = u.user_id
         WHERE s.employee_no = ?`,
        [employeeId.trim()]
      );
    } else {
      [rows] = await pool.query(
        `SELECT u.user_id, u.email, u.password_hash, u.full_name, u.role, u.account_status,
                s.staff_id, s.employee_no, s.designation, s.status as staff_status
         FROM USER_ACCOUNT u
         LEFT JOIN STAFF s ON u.user_id = s.user_id
         WHERE u.email = ? AND u.role = 'STAFF'`,
        [email.trim().toLowerCase()]
      );
    }

    if (rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const staffMember = rows[0];

    if (staffMember.account_status !== 'ACTIVE' || staffMember.staff_status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Staff account is inactive or suspended', 403);
    }

    const isMatch = await verifyPassword(password, staffMember.password_hash, staffMember.user_id);
    if (!isMatch) {
      throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const token = generateToken({
      userId: staffMember.user_id,
      email: staffMember.email,
      role: 'STAFF',
      staffId: staffMember.staff_id
    });

    return res.status(200).json({
      success: true,
      data: {
        userId: staffMember.user_id,
        staffId: staffMember.staff_id,
        employeeId: staffMember.employee_no,
        name: staffMember.full_name,
        designation: staffMember.designation,
        role: 'STAFF',
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin Login: POST /api/auth/admin/login
 */
async function loginAdmin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'Email and password are required', 400);
    }

    const [rows] = await pool.query(
      `SELECT u.user_id, u.email, u.password_hash, u.full_name, u.role, u.account_status,
              a.admin_id, a.employee_no, a.access_level
       FROM USER_ACCOUNT u
       JOIN ADMIN a ON u.user_id = a.user_id
       WHERE u.email = ? AND u.role = 'ADMIN'`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const admin = rows[0];

    if (admin.account_status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Admin account is inactive', 403);
    }

    const isMatch = await verifyPassword(password, admin.password_hash, admin.user_id);
    if (!isMatch) {
      throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const token = generateToken({
      userId: admin.user_id,
      email: admin.email,
      role: 'ADMIN',
      adminId: admin.admin_id
    });

    return res.status(200).json({
      success: true,
      data: {
        userId: admin.user_id,
        adminId: admin.admin_id,
        name: admin.full_name,
        role: 'ADMIN',
        accessLevel: admin.access_level,
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Universal Login: POST /api/auth/login
 */
async function loginUniversal(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'Email and password are required', 400);
    }

    const [rows] = await pool.query(
      'SELECT user_id, email, password_hash, phone, full_name, role, account_status, aadhaar_verified FROM USER_ACCOUNT WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const user = rows[0];
    if (user.account_status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', `Account is ${user.account_status.toLowerCase()}`, 403);
    }

    const isMatch = await verifyPassword(password, user.password_hash, user.user_id);
    if (!isMatch) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      role: user.role
    });

    const monthlyUsed = await getMonthlyTicketCount(user.user_id);
    const monthlyAllowed = user.aadhaar_verified ? 24 : 12;

    return res.status(200).json({
      success: true,
      data: {
        userId: user.user_id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        aadhaarVerified: Boolean(user.aadhaar_verified),
        monthlyBookingsUsed: monthlyUsed,
        monthlyBookingsAllowed: monthlyAllowed,
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Profile: GET /api/auth/me or GET /me
 */
async function getMe(req, res, next) {
  try {
    const user = req.user;
    const monthlyUsed = await getMonthlyTicketCount(user.user_id);
    const monthlyAllowed = user.aadhaar_verified ? 24 : 12;

    return res.status(200).json({
      success: true,
      data: {
        userId: user.user_id,
        name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.account_status,
        aadhaarVerified: Boolean(user.aadhaar_verified),
        monthlyBookingsUsed: monthlyUsed,
        monthlyBookingsAllowed: monthlyAllowed,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registerPassenger,
  loginPassenger,
  loginStaff,
  loginAdmin,
  loginUniversal,
  getMe
};
