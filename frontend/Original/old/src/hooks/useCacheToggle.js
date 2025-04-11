import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * Custom hook for controlling model caching
 * @returns {Object} Cache toggle state and methods
 */
export const useCacheToggle = () => {
  // Store cache enabled setting in localStorage with default value of true
  const [cacheEnabled, setCacheEnabled] = useLocalStorage('modelCacheEnabled', true);
  
  // Clear model cache
  const clearModelCache = useCallback(() => {
    try {
      localStorage.removeItem('modelDropdownCache');
      console.log('Model cache cleared');
    } catch (error) {
      console.error('Error clearing model cache:', error);
    }
  }, []);

  // Toggle cache enabled state and clear cache if disabling
  const toggleCache = useCallback((enabled) => {
    const newValue = typeof enabled === 'boolean' ? enabled : !cacheEnabled;
    
    // If turning off caching, clear the existing cache
    if (!newValue) {
      clearModelCache();
    }
    
    setCacheEnabled(newValue);
    return newValue;
  }, [cacheEnabled, setCacheEnabled, clearModelCache]);

  // Forcibly refresh models by clearing cache
  const refreshModels = useCallback(() => {
    clearModelCache();
    // Cache will be regenerated on next data fetch
  }, [clearModelCache]);

  // Patch the original isCacheValid function
  useEffect(() => {
    // Skip this effect during server-side rendering
    if (typeof window === 'undefined') return;

    // Store the original isCacheValid function
    const originalFunc = window.isCacheValid;

    // Define our patched function
    window.isCacheValid = function patchedIsCacheValid(cache) {
      // First check if caching is enabled at all
      const enabled = localStorage.getItem('modelCacheEnabled');
      if (enabled === 'false') return false;
      
      // If enabled, use original validation logic
      if (typeof originalFunc === 'function') {
        return originalFunc(cache);
      }
      
      // Fallback implementation if original not available
      return (
        cache &&
        cache.timestamp &&
        Date.now() - cache.timestamp < 5 * 60 * 1000 &&
        cache.allModels &&
        cache.processedModels &&
        cache.experimentalModels
      );
    };

    // Cleanup function to restore original
    return () => {
      window.isCacheValid = originalFunc;
    };
  }, []);

  // Return state and functions
  return {
    cacheEnabled,
    toggleCache,
    clearModelCache,
    refreshModels
  };
}; 