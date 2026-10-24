const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Scrypt hash matching the database seed generation in database/seed/step1_clean.js
 */
function hashSeedPassword(pwd, salt) {
  return crypto.scryptSync(pwd, salt, 32, { N: 16, r: 8, p: 1 }).toString('hex');
}

/**
 * Hash password with bcrypt for newly registered users
 */
async function hashBcryptPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against either bcrypt hash or seed scrypt hash
 */
async function verifyPassword(plainPassword, storedHash, userId) {
  if (!plainPassword || !storedHash) return false;

  // 1. If stored hash is bcrypt ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(plainPassword, storedHash);
  }

  // 2. If stored hash is seed scrypt format (salt_user_${userId})
  if (userId) {
    const expectedSeedHash = hashSeedPassword(plainPassword, `salt_user_${userId}`);
    if (crypto.timingSafeEqual(Buffer.from(expectedSeedHash), Buffer.from(storedHash))) {
      return true;
    }
  }

  return false;
}

module.exports = {
  hashBcryptPassword,
  hashSeedPassword,
  verifyPassword
};
