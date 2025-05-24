/**
 * Route-Based Code Splitting Utility
 * Implements intelligent route-based lazy loading and prefetching
 */

// Track route access patterns for intelligent prefetching
const routeAccessPatterns = new Map();
const prefetchedRoutes = new Set();

/**
 * Route definitions with lazy loading and prefetch hints
 */
export const ROUTE_CHUNKS = {
  // Core routes (always loaded)
  core: {
    priority: 1,
    preload: true,
    routes: ['/'],
    chunks: [
      () => import(/* webpackChunkName: "route-home" */ '../components/layout/Layout'),
      () => import(/* webpackChunkName: "route-home" */ '../components/chat/ChatContainer'),
    ],
  },

  // Chat-related routes
  chat: {
    priority: 2,
    preload: false,
    routes: ['/chat', '/chat/*'],
    chunks: [
      () => import(/* webpackChunkName: "route-chat" */ '../components/chat/MessageList'),
      () => import(/* webpackChunkName: "route-chat" */ '../components/chat/ChatInput'),
      () => import(/* webpackChunkName: "route-chat" */ '../components/chat/GlobalMetricsBar'),
    ],
  },

  // Settings routes
  settings: {
    priority: 3,
    preload: false,
    routes: ['/settings', '/settings/*'],
    chunks: [
      () => import(/* webpackChunkName: "route-settings" */ '../components/settings/SettingsPanel'),
      () => import(/* webpackChunkName: "route-settings" */ '../components/settings/SettingsGroup'),
    ],
  },

  // Model management routes
  models: {
    priority: 4,
    preload: false,
    routes: ['/models', '/models/*'],
    chunks: [
      () => import(/* webpackChunkName: "route-models" */ '../components/models/ModelDropdown'),
      () => import(/* webpackChunkName: "route-models" */ '../components/models/ModelItem'),
      () => import(/* webpackChunkName: "route-models" */ '../components/models/ModelSearch'),
    ],
  },

  // Authentication routes
  auth: {
    priority: 5,
    preload: false,
    routes: ['/login', '/signup', '/auth/*'],
    chunks: [
      () => import(/* webpackChunkName: "route-auth" */ '../components/auth/AuthButton'),
      () => import(/* webpackChunkName: "route-auth" */ '../components/auth/LoginModal'),
    ],
  },

  // Heavy features (load on demand)
  heavy: {
    priority: 10,
    preload: false,
    routes: ['/markdown', '/performance', '/debug'],
    chunks: [
      () => import(/* webpackChunkName: "route-heavy" */ '../components/common/LazyMarkdownRenderer'),
      () => import(/* webpackChunkName: "route-heavy" */ '../components/chat/PerformanceMetrics'),
    ],
  },
};

/**
 * Get current route pattern
 */
const getCurrentRoute = () => {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname;
};

/**
 * Match route to chunk group
 */
const matchRouteToChunk = (route) => {
  for (const [chunkName, config] of Object.entries(ROUTE_CHUNKS)) {
    if (config.routes.some(pattern => {
      if (pattern.includes('*')) {
        const basePattern = pattern.replace('/*', '');
        return route.startsWith(basePattern);
      }
      return route === pattern;
    })) {
      return chunkName;
    }
  }
  return 'core'; // Default fallback
};

/**
 * Load chunks for specific route
 */
export const loadRouteChunks = async (route, options = {}) => {
  const chunkName = matchRouteToChunk(route);
  const config = ROUTE_CHUNKS[chunkName];
  
  if (!config) {
    console.warn(`No chunk configuration found for route: ${route}`);
    return;
  }

  const {
    timeout = 5000,
    retries = 2,
    trackAccess = true,
  } = options;

  // Track route access for analytics
  if (trackAccess) {
    const count = routeAccessPatterns.get(route) || 0;
    routeAccessPatterns.set(route, count + 1);
  }

  console.log(`🛣️ Loading chunks for route: ${route} (${chunkName})`);

  try {
    await Promise.all(config.chunks.map(chunkFn => chunkFn()));
    console.log(`✅ Route chunks loaded: ${chunkName}`);
  } catch (error) {
    console.error(`❌ Failed to load route chunks for ${chunkName}:`, error);
    throw error;
  }
};

/**
 * Prefetch chunks for likely next routes
 */
export const prefetchLikelyRoutes = (currentRoute, options = {}) => {
  const {
    maxPrefetch = 2,
    minAccessCount = 2,
  } = options;

  // Get routes that are frequently accessed after current route
  const likelyRoutes = Array.from(routeAccessPatterns.entries())
    .filter(([route, count]) => count >= minAccessCount && route !== currentRoute)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxPrefetch)
    .map(([route]) => route);

  likelyRoutes.forEach(route => {
    if (!prefetchedRoutes.has(route)) {
      prefetchedRoutes.add(route);
      
      requestIdleCallback(() => {
        loadRouteChunks(route, { trackAccess: false })
          .then(() => console.log(`🔮 Prefetched route: ${route}`))
          .catch(() => console.warn(`⚠️ Failed to prefetch route: ${route}`));
      });
    }
  });
};

/**
 * Smart route-based preloading strategy
 */
export const createRoutePreloader = () => {
  let currentRoute = getCurrentRoute();

  const preloadForRoute = (route) => {
    const chunkName = matchRouteToChunk(route);
    const config = ROUTE_CHUNKS[chunkName];

    if (config && config.preload) {
      loadRouteChunks(route);
    }
  };

  const handleRouteChange = (newRoute) => {
    if (newRoute !== currentRoute) {
      currentRoute = newRoute;
      
      // Load chunks for new route
      loadRouteChunks(newRoute);
      
      // Prefetch likely next routes
      setTimeout(() => {
        prefetchLikelyRoutes(newRoute);
      }, 1000);
    }
  };

  // Listen for route changes (if using client-side routing)
  if (typeof window !== 'undefined') {
    // For hash-based routing
    window.addEventListener('hashchange', () => {
      handleRouteChange(window.location.hash.slice(1) || '/');
    });

    // For history API routing
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      handleRouteChange(window.location.pathname);
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      handleRouteChange(window.location.pathname);
    };

    window.addEventListener('popstate', () => {
      handleRouteChange(window.location.pathname);
    });
  }

  return {
    preloadForRoute,
    handleRouteChange,
    getCurrentRoute: () => currentRoute,
    getAccessPatterns: () => Object.fromEntries(routeAccessPatterns),
    getPrefetchedRoutes: () => Array.from(prefetchedRoutes),
  };
};

/**
 * Component-level route chunk loader
 */
export const useRouteChunks = (route) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let canceled = false;

    const loadChunks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await loadRouteChunks(route);
        if (!canceled) {
          setIsLoaded(true);
        }
      } catch (err) {
        if (!canceled) {
          setError(err);
        }
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    loadChunks();

    return () => {
      canceled = true;
    };
  }, [route]);

  return { isLoading, isLoaded, error };
};

/**
 * Analyze route access patterns for optimization
 */
export const analyzeRoutePatterns = () => {
  const patterns = Object.fromEntries(routeAccessPatterns);
  const totalAccess = Object.values(patterns).reduce((sum, count) => sum + count, 0);
  
  const analysis = Object.entries(patterns).map(([route, count]) => ({
    route,
    count,
    percentage: ((count / totalAccess) * 100).toFixed(1),
    chunkGroup: matchRouteToChunk(route),
  })).sort((a, b) => b.count - a.count);

  return {
    totalAccess,
    patterns: analysis,
    recommendations: generateOptimizationRecommendations(analysis),
  };
};

/**
 * Generate optimization recommendations based on usage patterns
 */
const generateOptimizationRecommendations = (patterns) => {
  const recommendations = [];

  // Find frequently accessed routes that should be preloaded
  const frequentRoutes = patterns.filter(p => p.percentage > 20);
  if (frequentRoutes.length > 0) {
    recommendations.push({
      type: 'preload',
      message: `Consider preloading chunks for frequently accessed routes: ${frequentRoutes.map(r => r.route).join(', ')}`,
      routes: frequentRoutes.map(r => r.route),
    });
  }

  // Find rarely accessed routes that could be lazy-loaded more aggressively
  const rareRoutes = patterns.filter(p => p.percentage < 5);
  if (rareRoutes.length > 0) {
    recommendations.push({
      type: 'lazy-load',
      message: `Consider more aggressive lazy loading for rarely accessed routes: ${rareRoutes.map(r => r.route).join(', ')}`,
      routes: rareRoutes.map(r => r.route),
    });
  }

  return recommendations;
};

export default {
  ROUTE_CHUNKS,
  loadRouteChunks,
  prefetchLikelyRoutes,
  createRoutePreloader,
  useRouteChunks,
  analyzeRoutePatterns,
}; 