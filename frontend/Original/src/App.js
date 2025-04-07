import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ContextManager } from './contexts/ContextManager';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';

// Lazy-loaded components with preload hints
const Layout = lazy(() => import(/* webpackPrefetch: true */ './components/layout/Layout'));
const LoadingSpinner = lazy(() => import(/* webpackPrefetch: true */ './components/common/Spinner'));

// Preload critical components
const preloadComponents = () => {
  const components = [
    () => import(/* webpackPrefetch: true */ './components/layout/Layout'),
    () => import(/* webpackPrefetch: true */ './components/common/Spinner')
  ];
  
  // Use requestIdleCallback for non-critical preloading
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => {
      components.forEach(component => component());
    });
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => {
      components.forEach(component => component());
    }, 0);
  }
};

/**
 * Main App component
 * Sets up context providers and base layout
 */
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Mark app start
    performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);

    // Start preloading components after initial render
    preloadComponents();
    
    // Use requestAnimationFrame to ensure smooth initialization
    requestAnimationFrame(() => {
      performanceMonitor.mark(PERFORMANCE_MARKS.COMPONENT_LOAD);
      setIsInitialized(true);
    });

    // Cleanup performance marks on unmount
    return () => {
      performanceMonitor.clear();
    };
  }, []);

  useEffect(() => {
    if (isInitialized) {
      performanceMonitor.mark(PERFORMANCE_MARKS.APP_READY);
      performanceMonitor.measure(
        PERFORMANCE_MEASURES.TOTAL_LOAD,
        PERFORMANCE_MARKS.APP_START,
        PERFORMANCE_MARKS.APP_READY
      );
      performanceMonitor.logMetrics();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <ContextManager>
      <Suspense fallback={<LoadingScreen />}>
        <Layout />
      </Suspense>
    </ContextManager>
  );
}

/**
 * Loading screen while app initializes
 */
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <LoadingSpinner size="large" />
      </Suspense>
      <p>Initializing Chat App...</p>
    </div>
  );
}

export default App; 