const rateLimit = require('express-rate-limit');

const isDevOrTest = process.env.NODE_ENV !== 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevOrTest ? 2000 : 20, // 2000 requests in dev/test, 20 in production
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
    errors: []
  },
  standardHeaders: true,
  legacyHeaders: false
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevOrTest ? 1000 : 30, // 1000 in dev/test, 30 in production
  message: {
    success: false,
    message: 'Too many AI requests in a short time. Please slow down.',
    code: 'AI_RATE_LIMIT_EXCEEDED',
    errors: []
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevOrTest ? 20000 : 300, // 20000 in dev/test, 300 in production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    errors: []
  },
  standardHeaders: true,
  legacyHeaders: false
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevOrTest ? 1000 : 15, // 1000 in dev/test, 15 in production
  message: {
    success: false,
    message: 'Too many contact messages submitted. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    errors: []
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, aiLimiter, generalLimiter, contactLimiter };
