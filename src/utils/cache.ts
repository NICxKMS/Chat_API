/**
 * In-memory Cache Utility
 * Provides a simple caching mechanism for expensive operations
 */

// Define cache item interface
interface CacheItem<T> {
  value: T;
  expiry: number;
  category: string;
}

// Define cache statistics interface
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  categories?: Record<string, number>;
  hitRate?: number;
}

// In-memory cache store
const cacheStore = new Map<string, CacheItem<unknown>>();

// Cache statistics
const stats: CacheStats = {
  hits: 0,
  misses: 0,
  size: 0
};

/**
 * Generate a cache key based on the provided parameters
 * 
 * @param keyOrData - Base key or object to use as key data
 * @param args - Additional arguments to include in the key
 * @returns Generated cache key
 */
function generateKey(keyOrData: string | Record<string, any>, ...args: unknown[]): string {
  // If keyOrData is an object, convert it to a string key
  if (typeof keyOrData === 'object' && keyOrData !== null) {
    return `object-${JSON.stringify(keyOrData)}`;
  }
  
  // Original string key behavior
  const key = keyOrData as string;
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
 * @param key - Cache key
 * @param category - Optional category for metrics
 * @returns Cached value or null if not found
 */
async function get<T>(key: string, category = 'general'): Promise<T | null> {
  const cacheItem = cacheStore.get(key) as CacheItem<T> | undefined;
  
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
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttlSeconds - Time to live in seconds
 * @param category - Optional category for metrics
 */
async function set<T>(key: string, value: T, ttlSeconds = 60, category = 'general'): Promise<void> {
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
 * @param key - Cache key to invalidate
 * @returns Whether the key was found and invalidated
 */
function invalidate(key: string): boolean {
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
 * @param category - Optional category to clear
 * @returns Number of entries cleared
 */
function clear(category: string | null = null): number {
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
 * @returns Cache statistics
 */
function getStats(): CacheStats {
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
 * @returns Category statistics
 */
function getCategoryStats(): Record<string, number> {
  const categories: Record<string, number> = {};
  
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
 * @returns Whether cache is enabled
 */
function isEnabled(): boolean {
  // Default to enabled, can be expanded to check configuration
  return true;
}

export {
  get,
  set,
  invalidate,
  clear,
  generateKey,
  getStats,
  isEnabled,
  CacheItem,
  CacheStats
}; 