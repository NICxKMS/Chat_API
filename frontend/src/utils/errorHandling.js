/**
 * Error Handling Utilities
 * Centralized error handling patterns and utilities
 */

/**
 * Safe JSON parse with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} - Parsed object or fallback value
 */
export const safeJsonParse = (jsonString, fallback = null) => {
  if (typeof jsonString !== 'string') {
    return fallback;
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error.message);
    return fallback;
  }
};

/**
 * Safe JSON stringify with error handling
 * @param {any} data - Data to stringify
 * @param {string} fallback - Fallback value if stringification fails
 * @returns {string} - JSON string or fallback
 */
export const safeJsonStringify = (data, fallback = '{}') => {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn('Failed to stringify JSON:', error.message);
    return fallback;
  }
};

/**
 * Async error handler with retry logic
 * @param {Function} asyncFn - Async function to execute
 * @param {Object} options - Options for retry logic
 * @returns {Promise} - Result or throws final error
 */
export const withRetry = async (asyncFn, options = {}) => {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    onRetry = () => {},
    shouldRetry = () => true
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;
      
      if (attempt === retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      
      onRetry(error, attempt);
      
      if (delay > 0) {
        await new Promise(resolve => 
          setTimeout(resolve, delay * Math.pow(backoff, attempt))
        );
      }
    }
  }
  
  throw lastError;
};

/**
 * Error boundary utility for components
 * @param {Function} component - Component function to wrap
 * @param {Function} fallback - Fallback component on error
 * @returns {Function} - Wrapped component with error handling
 */
export const withErrorBoundary = (component, fallback = null) => {
  return (props) => {
    try {
      return component(props);
    } catch (error) {
      console.error('Component error:', error);
      return fallback ? fallback(error, props) : null;
    }
  };
};

/**
 * Timeout wrapper for promises
 * @param {Promise} promise - Promise to wrap with timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout error message
 * @returns {Promise} - Promise that rejects on timeout
 */
export const withTimeout = (promise, ms, message = 'Operation timed out') => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
  
  return Promise.race([promise, timeout]);
};

/**
 * Safe async operation with error logging
 * @param {Function} asyncFn - Async function to execute
 * @param {Object} options - Options for error handling
 * @returns {Promise} - Result or undefined on error
 */
export const safeAsync = async (asyncFn, options = {}) => {
  const {
    onError = console.error,
    fallback = undefined,
    logError = true
  } = options;
  
  try {
    return await asyncFn();
  } catch (error) {
    if (logError) {
      onError('Safe async operation failed:', error);
    }
    return fallback;
  }
};

/**
 * Create error object with consistent structure
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {string} type - Error type
 * @param {any} details - Additional error details
 * @returns {Object} - Structured error object
 */
export const createError = (message, code = 'UNKNOWN_ERROR', type = 'Error', details = null) => {
  return {
    message,
    code,
    type,
    details,
    timestamp: new Date().toISOString()
  };
};

/**
 * Network error handler with specific error types
 * @param {Error} error - Network error
 * @returns {Object} - Normalized error object
 */
export const handleNetworkError = (error) => {
  if (!navigator.onLine) {
    return createError('No internet connection', 'NETWORK_OFFLINE', 'NetworkError');
  }
  
  if (error.name === 'AbortError') {
    return createError('Request was cancelled', 'REQUEST_ABORTED', 'AbortError');
  }
  
  if (error.code === 'ENOTFOUND' || error.message.includes('fetch')) {
    return createError('Server unreachable', 'SERVER_UNREACHABLE', 'NetworkError');
  }
  
  return createError(error.message || 'Network request failed', 'NETWORK_ERROR', 'NetworkError', {
    originalError: error.message
  });
};

/**
 * Validation error handler
 * @param {string} field - Field that failed validation
 * @param {string} message - Validation error message
 * @param {any} value - Invalid value
 * @returns {Object} - Validation error object
 */
export const createValidationError = (field, message, value = null) => {
  return createError(
    `Validation failed for ${field}: ${message}`,
    'VALIDATION_ERROR',
    'ValidationError',
    { field, value }
  );
};
