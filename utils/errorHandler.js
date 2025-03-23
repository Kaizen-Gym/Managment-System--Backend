import logger from './logger.js';

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Log error
  logger.error(`Error ${statusCode}: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    logger.debug(err.stack);
  }

  // Send response
  res.status(statusCode).json({
    status,
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};