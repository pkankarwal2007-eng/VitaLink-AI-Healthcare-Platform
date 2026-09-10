const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/**
 * Protect routes: verify JWT in Authorization header and attach user to req.user
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. No token provided.',
      code: 'AUTH_NO_TOKEN'
    });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
        code: 'AUTH_USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This user account has been deactivated.',
        code: 'AUTH_ACCOUNT_INACTIVE'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
        code: 'AUTH_TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid token.',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
};

/**
 * Authorize specific roles
 * @param  {...string} roles Allowed roles ('patient', 'doctor', 'shipping', 'admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization.',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user.role}' is not authorized to access this resource.`,
        code: 'FORBIDDEN_ROLE'
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
