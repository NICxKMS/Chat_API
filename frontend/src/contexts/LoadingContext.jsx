import React, { createContext, useContext, useState, useCallback } from 'react';

// Context to track multiple loading tags
const LoadingContext = createContext(null);

/**
 * Provider to wrap application and manage loading states by tags
 */
export const LoadingProvider = ({ children }) => {
  const [loadingMap, setLoadingMap] = useState({});

  const setLoading = useCallback((tag, isLoading) => {
    setLoadingMap(prev => ({ ...prev, [tag]: isLoading }));
  }, []);

  const isLoading = useCallback(tag => !!loadingMap[tag], [loadingMap]);
  const anyLoading = Object.values(loadingMap).some(val => val);

  return (
    <LoadingContext.Provider value={{ setLoading, isLoading, anyLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};

/**
 * Hook to control loading for a specific tag
 * @param {string} tag - Unique identifier for loading scope
 * @returns {[boolean, function, function]} [isLoading, startLoading, stopLoading]
 */
export const useLoading = (tag) => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoading must be used within LoadingProvider');
  const { setLoading, isLoading } = context;
  const startLoading = useCallback(() => setLoading(tag, true), [setLoading, tag]);
  const stopLoading = useCallback(() => setLoading(tag, false), [setLoading, tag]);
  return [isLoading(tag), startLoading, stopLoading];
};

/**
 * Hook to check if any loading is active globally
 * @returns {boolean}
 */
export const useGlobalLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useGlobalLoading must be used within LoadingProvider');
  return context.anyLoading;
}; 