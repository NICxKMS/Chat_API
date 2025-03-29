/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */
import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Error handler middleware
 * Catches any errors passed from previous middleware or routes
 * and returns a standardized error response
 */
function errorHandler(err: ErrorWithStatus, req: Request, res: Response, next: NextFunction): void {
  // Get the status code from the error object or default to 500
  const statusCode = err.status || err.statusCode || 500;
  
  // Log the error for debugging
  console.error(`[ERROR] ${statusCode} - ${err.message}`);
  if (statusCode >= 500) {
    console.error(err.stack);
  }
  
  // Send response to client
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: statusCode,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    }
  });
}

export default errorHandler; 