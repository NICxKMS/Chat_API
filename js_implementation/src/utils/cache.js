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
 * @param {string} key - Base key
 * @param {...any} args - Additional arguments to include in the key
 * @returns {string} - Generated cache key
 */
function generateKey(key, ...args) {
  if (args.length === 0) {
    return key;
  }
  
  const argString = args
    .map(arg => {
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
 * @returns {Promise<any>} - Cached value or null
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
 * @returns {boolean} - Whether the key was found and invalidated
 */
function invalidate(key) {
  const result = cacheStore.delete(key);
  stats.size = cacheStore.size;
  return result;
}

/**
 * Clear all cache entries or entries of a specific category
 * 
 * @param {string} category - Optional category to clear
 * @returns {number} - Number of entries cleared
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
 * @returns {Object} - Cache statistics
 */
function getStats() {
  return {
    ...stats,
    categories: getCategoryStats(),
    hitRate: stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) : 0
  };
}

/**
 * Get statistics by category
 * 
 * @returns {Object} - Category statistics
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
 * @returns {boolean} - Whether cache is enabled
 */
function isEnabled() {
  // Default to enabled, can be expanded to check configuration
  return true;
}

module.exports = {
  get,
  set,
  invalidate,
  clear,
  generateKey,
  getStats,
  isEnabled
};