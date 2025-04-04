/**
 * Error Handler Middleware
 * Centralized error handling for the application.
 * Provides standardized JSON error responses.
 */
import logger from "../utils/logger.js"; // Use a structured logger

// Map common error names/types to HTTP status codes
const ERROR_STATUS_MAP = {
  ValidationError: 400,
  BadRequestError: 400,
  AuthenticationError: 401,
  UnauthorizedError: 403,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
  RateLimitError: 429,
  InternalServerError: 500,
  ServiceUnavailableError: 503,
  TimeoutError: 504,
  ProviderError: 502, // Bad Gateway often suitable for upstream provider issues
};

/**
 * Centralized Error Handling Middleware.
 * Catches errors passed via `next(err)`.
 * Logs the error details.
 * Sends a standardized JSON error response to the client.
 */
function errorHandler(err, req, res, next) {
  // Determine HTTP status code
  let statusCode = err.status || err.statusCode || ERROR_STATUS_MAP[err.name] || 500;

  // Determine error code/type string
  const errorCode = err.code || err.name || "InternalServerError";

  // Log the error
  const logContext = {
    error_name: err.name,
    error_message: err.message,
    error_code: errorCode,
    status_code: statusCode,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  };
  // Log stack trace only for server errors and in non-production environments
  if (statusCode >= 500 || process.env.NODE_ENV !== "production") {
    logContext.stack = err.stack;
  }
  logger.error("API Error Handled", logContext);

  // Prevent sending multiple responses if headers already sent
  if (res.headersSent) {
    logger.warn("Headers already sent, cannot send error response.", { path: req.originalUrl });
    return next(err); // Pass to default Express handler if needed
  }

  // Construct standardized JSON error response
  const errorResponse = {
    error: {
      code: errorCode,
      message: err.message || "An unexpected error occurred.",
      status: statusCode,
      // Optionally include more details in development
      ...(process.env.NODE_ENV === "development" && { details: err.details || null }),
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    }
  };

  // Send response to client
  res.status(statusCode).json(errorResponse);
}

export default errorHandler; 