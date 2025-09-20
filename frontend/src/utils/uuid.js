/**
 * UUID Generation Utility
 * Centralized utility for generating unique identifiers
 */

/**
 * Generate a UUID using crypto.randomUUID if available, fallback to timestamp + random
 * @returns {string} - Unique identifier
 */
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Generate a message-specific unique ID with prefix
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} - Unique message identifier
 */
export const generateMessageId = (prefix = 'msg') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate a request-specific unique ID
 * @returns {string} - Unique request identifier
 */
export const generateRequestId = () => {
  return generateUUID();
};

/**
 * Generate a toast notification ID
 * @returns {string} - Unique toast identifier
 */
export const generateToastId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};
