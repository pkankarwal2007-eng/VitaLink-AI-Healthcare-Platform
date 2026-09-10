const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing. Authentication cannot proceed securely.');
  }
  return secret;
};

const generateToken = (user) => {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      fullName: user.fullName
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

module.exports = { generateToken, verifyToken };
