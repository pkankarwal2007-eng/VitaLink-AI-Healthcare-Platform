const crypto = require('crypto');

/**
 * Generate a cryptographically secure 6-digit numeric OTP string (100000 - 999999).
 * @returns {string} 6-digit OTP
 */
const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Create a secure HMAC-SHA256 hash of the OTP using JWT_SECRET or platform salt.
 * Raw OTP is NEVER stored in the database.
 * @param {string|number} otp 6-digit OTP
 * @returns {string} 64-character hex hash
 */
const hashOtp = (otp) => {
  const secret = process.env.JWT_SECRET || 'vitalink_secure_otp_salt_fallback';
  return crypto
    .createHmac('sha256', secret)
    .update(String(otp).trim())
    .digest('hex');
};

/**
 * Verify an entered OTP against the stored HMAC-SHA256 hash using constant-time comparison.
 * Prevents timing attacks.
 * @param {string|number} enteredOtp User provided OTP
 * @param {string} storedHash Stored HMAC hash
 * @returns {boolean} True if matched
 */
const verifyOtp = (enteredOtp, storedHash) => {
  if (!enteredOtp || !storedHash) return false;
  const candidateHash = hashOtp(enteredOtp);

  try {
    const bufA = Buffer.from(candidateHash, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');

    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp
};
