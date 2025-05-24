/**
 * Chunk Optimization Utility
 * Helps with intelligent loading and grouping of small chunks
 */

// Track loaded chunks to avoid duplicate loading
const loadedChunks = new Set();
const loadingChunks = new Map();

/**
 * Intelligent chunk loader that groups small imports together
 * @param {Object} importMap - Map of import functions
 * @param {Object} options - Loading options
 */
export const loadChunkGroup = async (importMap, options = {}) => {
  const {
    groupName = 'default',
    priority = 0,
    timeout = 5000,
    retries = 2,
  } = options;

  // Check if already loaded
  if (loadedChunks.has(groupName)) {
    return Promise.resolve();
  }

  // Check if currently loading
  if (loadingChunks.has(groupName)) {
    return loadingChunks.get(groupName);
  }

  const loadPromise = loadWithRetry(importMap, groupName, retries, timeout);
  loadingChunks.set(groupName, loadPromise);

  try {
    await loadPromise;
    loadedChunks.add(groupName);
    loadingChunks.delete(groupName);
  } catch (error) {
    loadingChunks.delete(groupName);
    throw error;
  }

  return loadPromise;
};

/**
 * Load chunks with retry logic
 */
const loadWithRetry = async (importMap, groupName, retries, timeout) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout loading ${groupName}`)), timeout);
      });

      const loadPromise = Promise.all(
        Object.entries(importMap).map(async ([key, importFn]) => {
          try {
            const module = await importFn();
            console.log(`✓ Loaded ${groupName}.${key}`);
            return { key, module };
          } catch (error) {
            console.warn(`✗ Failed to load ${groupName}.${key}:`, error);
            throw error;
          }
        })
      );

      await Promise.race([loadPromise, timeoutPromise]);
      console.log(`✓ Chunk group '${groupName}' loaded successfully`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(`Retry ${attempt + 1}/${retries} for ${groupName} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

/**
 * Preload chunks during idle time with intelligent scheduling
 */
export const idlePreloadChunks = (chunkGroups, options = {}) => {
  const {
    maxConcurrent = 2,
    priorityDelay = 100,
    idleTimeout = 5000,
  } = options;

  let currentlyLoading = 0;
  const queue = Object.entries(chunkGroups)
    .sort(([, a], [, b]) => (a.priority || 0) - (b.priority || 0));

  const processQueue = () => {
    if (currentlyLoading >= maxConcurrent || queue.length === 0) {
      return;
    }

    const [groupName, config] = queue.shift();
    currentlyLoading++;

    const delay = (config.priority || 0) * priorityDelay;

    setTimeout(() => {
      requestIdleCallback(async () => {
        try {
          await loadChunkGroup(config.imports, {
            groupName,
            timeout: idleTimeout,
            ...config.options,
          });
        } catch (error) {
          console.warn(`Idle preload failed for ${groupName}:`, error);
        } finally {
          currentlyLoading--;
          processQueue(); // Process next in queue
        }
      }, { timeout: idleTimeout });
    }, delay);
  };

  // Start processing
  processQueue();
  processQueue(); // Start with max concurrent if possible
};

/**
 * Smart chunk bundler that groups small modules together
 */
export const createSmallChunkBundle = (modules, bundleName = 'small-bundle') => {
  const bundleImport = () => Promise.all(
    modules.map(async (moduleImport) => {
      try {
        return await moduleImport();
      } catch (error) {
        console.warn(`Failed to load module in ${bundleName}:`, error);
        return null;
      }
    })
  ).then(results => results.filter(Boolean));

  return {
    [bundleName]: bundleImport,
  };
};

/**
 * Monitor chunk loading performance
 */
export const createChunkMonitor = () => {
  const metrics = {
    loadTimes: new Map(),
    failures: new Map(),
    totalLoaded: 0,
    totalFailed: 0,
  };

  return {
    startLoad: (chunkName) => {
      metrics.loadTimes.set(chunkName, performance.now());
    },

    endLoad: (chunkName, success = true) => {
      const startTime = metrics.loadTimes.get(chunkName);
      if (startTime) {
        const duration = performance.now() - startTime;
        if (success) {
          metrics.totalLoaded++;
          console.log(`📊 Chunk '${chunkName}' loaded in ${duration.toFixed(2)}ms`);
        } else {
          metrics.totalFailed++;
          metrics.failures.set(chunkName, (metrics.failures.get(chunkName) || 0) + 1);
          console.warn(`📊 Chunk '${chunkName}' failed after ${duration.toFixed(2)}ms`);
        }
        metrics.loadTimes.delete(chunkName);
      }
    },

    getMetrics: () => ({
      ...metrics,
      loadTimes: Object.fromEntries(metrics.loadTimes),
      failures: Object.fromEntries(metrics.failures),
    }),

    reset: () => {
      metrics.loadTimes.clear();
      metrics.failures.clear();
      metrics.totalLoaded = 0;
      metrics.totalFailed = 0;
    },
  };
};

/**
 * Adaptive loading strategy based on network conditions
 */
export const createAdaptiveLoader = () => {
  const getNetworkInfo = () => {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData,
      };
    }
    return { effectiveType: '4g', downlink: 10, rtt: 100, saveData: false };
  };

  const getLoadingStrategy = () => {
    const network = getNetworkInfo();
    
    if (network.saveData || network.effectiveType === 'slow-2g' || network.effectiveType === '2g') {
      return {
        maxConcurrent: 1,
        priorityDelay: 500,
        timeout: 10000,
        skipNonEssential: true,
      };
    }
    
    if (network.effectiveType === '3g') {
      return {
        maxConcurrent: 2,
        priorityDelay: 200,
        timeout: 8000,
        skipNonEssential: false,
      };
    }
    
    // 4g or better
    return {
      maxConcurrent: 4,
      priorityDelay: 100,
      timeout: 5000,
      skipNonEssential: false,
    };
  };

  return {
    getStrategy: getLoadingStrategy,
    getNetworkInfo,
  };
};

// Export utilities
export default {
  loadChunkGroup,
  idlePreloadChunks,
  createSmallChunkBundle,
  createChunkMonitor,
  createAdaptiveLoader,
}; 