/**
 * Security utilities for VitaLink backend
 */

/**
 * Escapes characters with special regex meaning to prevent ReDoS or query logic tampering.
 * @param {string} str - Raw input string
 * @returns {string} Escaped string safe for RegExp
 */
const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Recursively sanitizes object keys to prevent MongoDB query operator injection ($gt, $ne, $where, etc.)
 * @param {any} obj - Request body, query, or params
 * @returns {any} Sanitized data
 */
const sanitizeMongoOperators = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMongoOperators);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Strip keys starting with '$' or containing '.'
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    sanitized[key] = sanitizeMongoOperators(value);
  }

  return sanitized;
};

module.exports = {
  escapeRegex,
  sanitizeMongoOperators
};
