import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';

/**
 * Utility functions for lazy loading components with preloading capabilities
 */

/**
 * Creates a lazy-loaded component with preloading capability
 * @param {Function} importFn - The dynamic import function
 * @param {Object} options - Options for lazy loading
 * @param {boolean} options.prefetch - Whether to prefetch the component
 * @param {string} options.webpackChunkName - Optional webpack chunk name
 * @returns {React.LazyExoticComponent} - Lazy-loaded component
 */
export const lazyLoad = (importFn, { prefetch = false, webpackChunkName } = {}) => {
  // Use React.lazy directly with the import function
  // The webpack magic comments will be added by the build process
  return React.lazy(importFn);
};

/**
 * Preloads a component for faster subsequent loading
 * @param {Function} importFn - The dynamic import function
 * @returns {Promise} - Promise that resolves when the component is loaded
 */
export const preloadComponent = (importFn) => {
  return importFn();
};

/**
 * Preloads multiple components in parallel
 * @param {Array<Function>} importFns - Array of dynamic import functions
 * @returns {Promise} - Promise that resolves when all components are loaded
 */
export const preloadComponents = (importFns) => {
  return Promise.all(importFns.map(fn => preloadComponent(fn)));
};

/**
 * Preloads components during idle time
 * @param {Array<Function>} importFns - Array of dynamic import functions
 * @param {number} timeout - Timeout in ms
 */
export const preloadComponentsIdle = (importFns, timeout = 2000) => {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => {
      preloadComponents(importFns);
    }, { timeout });
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => {
      preloadComponents(importFns);
    }, 0);
  }
};

export default {
  lazyLoad,
  preloadComponent,
  preloadComponents,
  preloadComponentsIdle
}; 