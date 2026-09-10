const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('[Error Details]:', err);

  // Mongoose bad ObjectId / CastError
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    return res.status(404).json({
      success: false,
      message,
      code: 'RESOURCE_NOT_FOUND',
      errors: []
    });
  }

  // Mongoose duplicate key (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `Duplicate value entered for '${field}'. Please use another value.`;
    return res.status(400).json({
      success: false,
      message,
      code: 'DUPLICATE_KEY_ERROR',
      errors: [{ field, message }]
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors
    });
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
      code: 'FILE_UPLOAD_ERROR',
      errors: []
    });
  }

  const statusCode =
    error.statusCode ||
    error.status ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  const isProduction = process.env.NODE_ENV === 'production';
  const responseMessage =
    statusCode === 500 && isProduction
      ? 'An unexpected error occurred. Please try again later.'
      : (error.message || 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    message: responseMessage,
    code: error.code || (statusCode === 404 ? 'RESOURCE_NOT_FOUND' : 'SERVER_ERROR'),
    errors: error.errors || []
  });
};

module.exports = errorHandler;
