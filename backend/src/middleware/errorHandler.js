// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Default error status and message
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // PostgreSQL errors
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'This record already exists',
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Invalid reference',
      message: 'Referenced record does not exist',
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: err.message,
      details: err.errors,
    });
  }

  // Default error response
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Server error' : err.name,
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
