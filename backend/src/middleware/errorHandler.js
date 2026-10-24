const CANONICAL_ERROR_MESSAGES = {
  SEAT_NOT_AVAILABLE: 'No seats remain in the requested quota or segment.',
  WAITING_LIST_FULL: 'Waitlist capacity (25% of quota confirmed seats) is exhausted.',
  NOT_ALL_CONFIRMED: 'User opted "book only if confirmed" and at least one passenger would be RAC or WL.',
  HOLD_EXPIRED: 'The 10-minute seat hold timer lapsed before payment completion.',
  TRAIN_NOT_RUNNING: 'The train does not operate on the origin departure date corresponding to the boarding date (BR-B1a).',
  QUOTA_NOT_ELIGIBLE: 'Passenger roster does not satisfy quota criteria.',
  CONCESSION_PROOF_REQUIRED: 'Concession selected without valid proof type or certificate reference.',
  NO_ADULT_PASSENGER: 'Booking attempt contains no passenger aged 18 or older (BR-Q15).',
  BERTH_PREFERENCE_NOT_MET: 'The requested berth preference could not be satisfied for all passengers in the selected class.',
  MONTHLY_LIMIT_EXCEEDED: 'User exceeded monthly ticket limit (12 tickets/PNRs per calendar month, or 24 if Aadhaar-verified).',
  CHART_PREPARED: 'Booking or online cancellation attempted at or after chart time (BR-B12a, BR-B16).'
};

const CANONICAL_ERROR_STATUS_CODES = {
  SEAT_NOT_AVAILABLE: 400,
  WAITING_LIST_FULL: 400,
  NOT_ALL_CONFIRMED: 400,
  HOLD_EXPIRED: 400,
  TRAIN_NOT_RUNNING: 400,
  QUOTA_NOT_ELIGIBLE: 400,
  CONCESSION_PROOF_REQUIRED: 400,
  NO_ADULT_PASSENGER: 400,
  BERTH_PREFERENCE_NOT_MET: 400,
  MONTHLY_LIMIT_EXCEEDED: 400,
  CHART_PREPARED: 400,
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

/**
 * Universal error handler middleware enforcing docs/API_CONTRACT.md format:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "CANONICAL_CODE",
 *     "message": "Descriptive message"
 *   }
 * }
 */
function errorHandler(err, req, res, next) {
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let statusCode = err.statusCode || 500;

  // 1. Check if error is or contains a known canonical error code in message or sqlMessage
  const fullText = `${err.message || ''} ${err.sqlMessage || ''} ${err.code || ''}`;
  for (const canonicalCode of Object.keys(CANONICAL_ERROR_MESSAGES)) {
    if (fullText.includes(canonicalCode)) {
      code = canonicalCode;
      message = err.message && !err.message.includes('ER_') && !err.message.includes('SQL')
        ? err.message
        : CANONICAL_ERROR_MESSAGES[canonicalCode];
      statusCode = CANONICAL_ERROR_STATUS_CODES[canonicalCode] || 400;
      break;
    }
  }

  // 2. MySQL specific database error mapping
  if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
    code = 'CONFLICT';
    message = 'A record with this identifier already exists.';
    statusCode = 409;
  } else if (err.errno === 1452 || err.code === 'ER_NO_REFERENCED_ROW_2') {
    code = 'VALIDATION_ERROR';
    message = 'Invalid reference: referenced entity does not exist.';
    statusCode = 400;
  }

  // 3. JWT error mapping
  if (err.name === 'JsonWebTokenError') {
    code = 'UNAUTHORIZED';
    message = 'Invalid authentication token.';
    statusCode = 401;
  } else if (err.name === 'TokenExpiredError') {
    code = 'UNAUTHORIZED';
    message = 'Authentication token has expired.';
    statusCode = 401;
  }

  // 4. Default status code fallback
  if (!statusCode || statusCode < 400 || statusCode > 599) {
    statusCode = CANONICAL_ERROR_STATUS_CODES[code] || 400;
  }

  // Never leak raw SQL query strings or server internals in error message
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected server error occurred.';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
}

module.exports = {
  errorHandler,
  CANONICAL_ERROR_MESSAGES,
  CANONICAL_ERROR_STATUS_CODES
};
