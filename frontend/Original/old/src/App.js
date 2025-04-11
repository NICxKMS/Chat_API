import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ContextManager } from './contexts/ContextManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';
import { lazyLoad, preloadComponentsIdle } from './utils/lazyLoad';

// Lazy-loaded components with preload hints
const Layout = lazy(() => import(/* webpackChunkName: "layout" */ './components/layout/Layout'));
const LoadingSpinner = lazy(() => import(/* webpackChunkName: "spinner" */ './components/common/Spinner'));
const LoginModal = lazy(() => import(/* webpackChunkName: "loginModal" */ './components/auth/LoginModal'));

// Define components to preload
const componentsToPreload = [
  () => import('./components/layout/Layout'),
  () => import('./components/common/Spinner'),
  () => import('./components/auth/LoginModal')
];

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
    preloadComponentsIdle(componentsToPreload);
    
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
    <AuthProvider>
      <ContextManager>
        <AppContent />
      </ContextManager>
    </AuthProvider>
  );
}

// New component to access AuthContext
function AppContent() {
  const { isLoggingIn, setIsLoggingIn } = useAuth();

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Layout />
      {isLoggingIn && (
        <Suspense fallback={<LoadingScreen />}>
          <LoginModal onClose={() => setIsLoggingIn(false)} />
        </Suspense>
      )}
    </Suspense>
  );
}

/**
 * Loading screen while app initializes
 */
function LoadingScreen() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <LoadingSpinner size="large" />
    </div>
  );
}

export default App; 