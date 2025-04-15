/**
 * Feature-based code splitting utility
 * Handles loading of features in priority order
 */

// Import all feature bundles
import { layoutComponents } from '../features/layout';
import { authComponents } from '../features/auth';
import { chatComponents } from '../features/chat';
import { settingsComponents } from '../features/settings';
import { modelComponents } from '../features/models';
import { commonComponents } from '../features/common';

// Define feature loading priorities
const PRIORITIES = {
  CRITICAL: 'critical',    // Load immediately
  HIGH: 'high',           // Load soon after initial render
  MEDIUM: 'medium',       // Load when browser is idle
  LOW: 'low',             // Load only when needed or after other features
};

// Map features to their priorities
const featurePriorities = {
  layout: {
    components: layoutComponents,
    priority: PRIORITIES.CRITICAL
  },
  common: {
    components: commonComponents,
    priority: PRIORITIES.CRITICAL
  },
  chat: {
    components: chatComponents,
    priority: PRIORITIES.HIGH
  },
  auth: {
    components: authComponents,
    priority: PRIORITIES.MEDIUM
  },
  models: {
    components: modelComponents,
    priority: PRIORITIES.MEDIUM
  },
  settings: {
    components: settingsComponents,
    priority: PRIORITIES.LOW
  }
};

/**
 * Preload critical features immediately
 */
export const preloadCriticalFeatures = () => {
  Object.values(featurePriorities).forEach(feature => {
    if (feature.priority === PRIORITIES.CRITICAL) {
      feature.components.forEach(importFn => importFn());
    }
  });
};

/**
 * Preload high priority features with a small delay
 */
export const preloadHighPriorityFeatures = () => {
  setTimeout(() => {
    Object.values(featurePriorities).forEach(feature => {
      if (feature.priority === PRIORITIES.HIGH) {
        feature.components.forEach(importFn => importFn());
      }
    });
  }, 1000); // Small delay to let critical features load first
};

/**
 * Preload medium priority features when browser is idle
 */
export const preloadMediumPriorityFeatures = () => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      Object.values(featurePriorities).forEach(feature => {
        if (feature.priority === PRIORITIES.MEDIUM) {
          feature.components.forEach(importFn => importFn());
        }
      });
    }, { timeout: 5000 });
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => {
      Object.values(featurePriorities).forEach(feature => {
        if (feature.priority === PRIORITIES.MEDIUM) {
          feature.components.forEach(importFn => importFn());
        }
      });
    }, 3000);
  }
};

/**
 * Preload specific feature by name
 * @param {string} featureName - The name of feature to preload
 */
export const preloadFeature = (featureName) => {
  const feature = featurePriorities[featureName];
  if (feature) {
    feature.components.forEach(importFn => importFn());
  }
};

/**
 * Initialize the feature loader
 * Call this function at app startup
 */
export const initFeatureLoader = () => {
  // Immediately load critical features
  preloadCriticalFeatures();
  
  // Load high priority features with a small delay
  preloadHighPriorityFeatures();
  
  // Load medium priority features when browser is idle
  preloadMediumPriorityFeatures();
  
  // Listen for visibility change to load low priority features when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      Object.values(featurePriorities).forEach(feature => {
        if (feature.priority === PRIORITIES.LOW) {
          feature.components.forEach(importFn => importFn());
        }
      });
    }
  });
};

export default {
  initFeatureLoader,
  preloadFeature,
  PRIORITIES
}; 