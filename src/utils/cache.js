/**
 * Advanced caching utility with multi-level caching support
 * Implements memory and Redis caching with optimized TTL values
 */
const NodeCache = require('node-cache');
const Redis = require('ioredis');
const config = require('../config/config');
const metrics = require('./metrics');
const crypto = require('crypto');

// Create tiered cache system
const memoryCache = new NodeCache({ 
  stdTTL: config.cache.memoryCacheTTL, 
  checkperiod: Math.min(config.cache.memoryCacheTTL / 5, 60)  // More frequent checks for smaller TTLs
});

let redisCache = null;

// Initialize Redis if configured
if (config.cache.redis.enabled && config.cache.redis.url) {
  try {
    redisCache = new Redis(config.cache.redis.url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 3000,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    // Handle Redis connection events
    redisCache.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    redisCache.on('connect', () => {
      console.log('Redis cache connected');
    });
  } catch (error) {
    console.error('Failed to initialize Redis cache:', error);
  }
}

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  setCount: 0,
  memoryCacheSize: 0,
  modelCacheHits: 0,
  completionCacheHits: 0
};

// Cache key generation helper
function generateKey(data) {
  // If data is a string, use it directly
  if (typeof data === 'string') {
    return `str:${crypto.createHash('md5').update(data).digest('hex')}`;
  }
  
  // For objects, create a deterministic JSON string
  if (typeof data === 'object') {
    // Sort keys to ensure deterministic ordering
    const sortedObj = {};
    Object.keys(data).sort().forEach(key => {
      sortedObj[key] = data[key];
    });
    
    // Special handling for messages array (common in chat completions)
    if (Array.isArray(data.messages)) {
      // Only use role and content for caching, ignore other fields
      const simplifiedMessages = data.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      sortedObj.messages = simplifiedMessages;
    }
    
    return `obj:${crypto.createHash('md5').update(JSON.stringify(sortedObj)).digest('hex')}`;
  }
  
  // Fallback for other types
  return `raw:${crypto.createHash('md5').update(String(data)).digest('hex')}`;
}

// Cache module
const cache = {
  // Get from cache with tiered fallback
  async get(key, type = 'completion') {
    if (!config.cache.enabled) {
      return null;
    }
    
    // Try memory cache first (fastest)
    const memResult = memoryCache.get(key);
    if (memResult !== undefined) {
      stats.hits++;
      metrics.cacheAccessCounter.inc({ result: 'hit', type });
      
      if (type === 'model') {
        stats.modelCacheHits++;
      } else {
        stats.completionCacheHits++;
      }
      
      return memResult;
    }
    
    // Try Redis if available
    if (redisCache) {
      try {
        const redisResult = await redisCache.get(key);
        if (redisResult) {
          // Populate memory cache for next time
          const parsed = JSON.parse(redisResult);
          memoryCache.set(key, parsed);
          stats.hits++;
          metrics.cacheAccessCounter.inc({ result: 'hit', type });
          
          if (type === 'model') {
            stats.modelCacheHits++;
          } else {
            stats.completionCacheHits++;
          }
          
          return parsed;
        }
      } catch (error) {
        console.error('Redis cache error:', error);
      }
    }
    
    stats.misses++;
    metrics.cacheAccessCounter.inc({ result: 'miss', type });
    return null;
  },
  
  // Set in all cache layers
  async set(key, value, ttl = null, type = 'completion') {
    if (!config.cache.enabled) {
      return false;
    }
    
    stats.setCount++;
    stats.memoryCacheSize = memoryCache.keys().length + 1;
    
    // Determine TTL based on the type of data being cached
    const effectiveTtl = ttl || (
      type === 'model' 
        ? config.cache.memoryCacheTTL * 2  // Cache models longer
        : config.cache.memoryCacheTTL
    );
    
    // Always set in memory cache
    memoryCache.set(key, value, effectiveTtl);
    
    // Set in Redis if available (with potentially longer TTL)
    if (redisCache) {
      try {
        const redisTtl = type === 'model' 
          ? config.cache.redis.ttl * 2  // Cache models longer
          : config.cache.redis.ttl;
          
        await redisCache.setex(key, redisTtl, JSON.stringify(value));
      } catch (error) {
        console.error('Redis cache set error:', error);
      }
    }
    
    return true;
  },
  
  // Remove from all cache layers
  async del(key) {
    if (!config.cache.enabled) {
      return false;
    }
    
    // Remove from memory cache
    memoryCache.del(key);
    
    // Remove from Redis if available
    if (redisCache) {
      try {
        await redisCache.del(key);
      } catch (error) {
        console.error('Redis cache delete error:', error);
      }
    }
    
    stats.memoryCacheSize = memoryCache.keys().length;
    return true;
  },
  
  // Clear all caches
  async flush() {
    if (!config.cache.enabled) {
      return false;
    }
    
    // Clear memory cache
    memoryCache.flushAll();
    
    // Clear Redis if available
    if (redisCache) {
      try {
        await redisCache.flushall();
      } catch (error) {
        console.error('Redis cache flush error:', error);
      }
    }
    
    stats.memoryCacheSize = 0;
    return true;
  },
  
  // Cache warming for frequently used models
  async warmModelCache(providerFactory) {
    if (!config.cache.enabled) {
      return;
    }
    
    console.log('Warming model cache...');
    
    try {
      const providers = providerFactory.getAllProviders();
      
      // Fetch and cache models from all providers in parallel
      await Promise.all(providers.map(async (provider) => {
        const cacheKey = `models:${provider.name}`;
        
        try {
          // Skip if already in cache
          const cachedModels = await cache.get(cacheKey, 'model');
          if (cachedModels) {
            return;
          }
          
          // Fetch and cache models
          const models = await provider.getModels();
          await cache.set(cacheKey, models, null, 'model');
          console.log(`Cached ${models.length} models for ${provider.name}`);
        } catch (error) {
          console.error(`Error warming cache for ${provider.name}:`, error);
        }
      }));
    } catch (error) {
      console.error('Error warming model cache:', error);
    }
  },
  
  // Get cache stats
  getStats() {
    const hitRatio = stats.hits + stats.misses > 0 
      ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) 
      : 0;
    
    const modelHitRatio = stats.modelCacheHits / stats.hits * 100 || 0;
    const completionHitRatio = stats.completionCacheHits / stats.hits * 100 || 0;
      
    return {
      ...stats,
      hitRatio: `${hitRatio}%`,
      modelHitRatio: `${modelHitRatio.toFixed(2)}%`,
      completionHitRatio: `${completionHitRatio.toFixed(2)}%`,
      memoryItems: memoryCache.keys().length,
      memoryStats: memoryCache.getStats(),
      redisAvailable: !!redisCache
    };
  },
  
  // Expose key generation function
  generateKey
};

module.exports = cache;