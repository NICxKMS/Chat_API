/**
 * In-memory Cache Utility
 * Provides a simple caching mechanism for expensive operations
 */

// In-memory cache store
const cacheStore = new Map();

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  size: 0
};

/**
 * Generate a cache key based on the provided parameters
 * 
 * @param {string|object} keyOrData - Base key or object to use as key data
 * @param {...any} args - Additional arguments to include in the key
 * @returns {string} Generated cache key
 */
function generateKey(keyOrData, ...args) {
  // If keyOrData is an object, convert it to a string key
  if (typeof keyOrData === 'object' && keyOrData !== null) {
    return `object-${JSON.stringify(keyOrData)}`;
  }
  
  // Original string key behavior
  const key = keyOrData;
  if (args.length === 0) {
    return key;
  }
  
  const argString = args
    .map(arg => {
      if (arg === null) {
        return 'null';
      }
      if (arg === undefined) {
        return 'undefined';
      }
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    })
    .join('-');
    
  return `${key}-${argString}`;
}

/**
 * Get a value from the cache
 * 
 * @param {string} key - Cache key
 * @param {string} category - Optional category for metrics
 * @returns {Promise<any|null>} Cached value or null if not found
 */
async function get(key, category = 'general') {
  const cacheItem = cacheStore.get(key);
  
  if (!cacheItem) {
    stats.misses++;
    return null;
  }
  
  // Check if expired
  if (cacheItem.expiry < Date.now()) {
    cacheStore.delete(key);
    stats.misses++;
    return null;
  }
  
  stats.hits++;
  return cacheItem.value;
}

/**
 * Set a value in the cache
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {string} category - Optional category for metrics
 * @returns {Promise<void>}
 */
async function set(key, value, ttlSeconds = 60, category = 'general') {
  // Guard against null or undefined keys
  if (key === null || key === undefined) {
    throw new Error('Cache key cannot be null or undefined');
  }
  
  const expiry = Date.now() + (ttlSeconds * 1000);
  
  cacheStore.set(key, {
    value,
    expiry,
    category
  });
  
  stats.size = cacheStore.size;
}

/**
 * Invalidate a specific cache entry
 * 
 * @param {string} key - Cache key to invalidate
 * @returns {boolean} Whether the key was found and invalidated
 */
function invalidate(key) {
  if (!key) {
    return false;
  }
  
  const result = cacheStore.delete(key);
  stats.size = cacheStore.size;
  return result;
}

/**
 * Clear all cache entries or entries of a specific category
 * 
 * @param {string|null} category - Optional category to clear
 * @returns {number} Number of entries cleared
 */
function clear(category = null) {
  let count = 0;
  
  if (category) {
    // Clear only entries of the specified category
    for (const [key, item] of cacheStore.entries()) {
      if (item.category === category) {
        cacheStore.delete(key);
        count++;
      }
    }
  } else {
    // Clear all entries
    count = cacheStore.size;
    cacheStore.clear();
  }
  
  stats.size = cacheStore.size;
  return count;
}

/**
 * Get cache statistics
 * 
 * @returns {object} Cache statistics
 */
function getStats() {
  const totalRequests = stats.hits + stats.misses;
  return {
    ...stats,
    categories: getCategoryStats(),
    hitRate: totalRequests > 0 ? (stats.hits / totalRequests) : 0
  };
}

/**
 * Get statistics by category
 * 
 * @returns {object} Category statistics
 */
function getCategoryStats() {
  const categories = {};
  
  for (const item of cacheStore.values()) {
    const category = item.category || 'general';
    
    if (!categories[category]) {
      categories[category] = 0;
    }
    
    categories[category]++;
  }
  
  return categories;
}

/**
 * Check if cache is enabled
 * 
 * @returns {boolean} Whether cache is enabled
 */
function isEnabled() {
  return process.env.CACHE_ENABLED !== 'false';
}

// Export the cache methods
export {
  get,
  set,
  invalidate,
  clear,
  generateKey,
  getStats,
  isEnabled
}; 