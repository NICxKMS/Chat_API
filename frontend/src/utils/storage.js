/**
 * Safe localStorage utilities with consistent error handling
 */

/**
 * Safely get an item from localStorage with error handling
 * @param {string} key - The localStorage key
 * @param {any} defaultValue - Default value if key doesn't exist or error occurs
 * @returns {any} - The parsed value or default value
 */
export const getStorageItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to get localStorage item "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Safely set an item in localStorage with error handling
 * @param {string} key - The localStorage key
 * @param {any} value - The value to store
 * @returns {boolean} - Success status
 */
export const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage item "${key}":`, error);
    return false;
  }
};

/**
 * Safely remove an item from localStorage with error handling
 * @param {string} key - The localStorage key
 * @returns {boolean} - Success status
 */
export const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove localStorage item "${key}":`, error);
    return false;
  }
};

/**
 * Safely get a raw string item from localStorage (no JSON parsing)
 * @param {string} key - The localStorage key
 * @param {string} defaultValue - Default value if key doesn't exist
 * @returns {string} - The raw string value or default
 */
export const getRawStorageItem = (key, defaultValue = null) => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (error) {
    console.warn(`Failed to get raw localStorage item "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Safely set a raw string item in localStorage (no JSON stringification)
 * @param {string} key - The localStorage key
 * @param {string} value - The raw string value to store
 * @returns {boolean} - Success status
 */
export const setRawStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to set raw localStorage item "${key}":`, error);
    return false;
  }
};
