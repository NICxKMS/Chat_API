import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';
import { initFeatureLoader, preloadFeature } from './utils/featureLoader';

// Critical UI components - imported directly for faster initial render
import { Layout } from './features/layout';
import { Spinner } from './features/common';

// Non-critical components - lazy loaded after initial render
const LoginModal = lazy(() => import('./components/auth/LoginModal'));

/**
 * Main App component
 * Sets up context providers and base layout
 */
function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mark app start
    performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);

    // Initialize feature-based code splitting
    initFeatureLoader();
    
    // Preload auth components (will be needed soon)
    preloadFeature('auth');
    
    // Use requestAnimationFrame to ensure smooth initialization
    requestAnimationFrame(() => {
      performanceMonitor.mark(PERFORMANCE_MARKS.COMPONENT_LOAD);
      setIsInitialized(true);
    });

    // Timer to hide loading indicator - this ensures minimal flash of loading screen
    const timer = setTimeout(() => {
      setIsLoading(false);
      // After initial render, preload other important features
      preloadFeature('chat');
      preloadFeature('models');
    }, 100);

    // Cleanup performance marks on unmount
    return () => {
      performanceMonitor.clear();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isInitialized && !isLoading) {
      performanceMonitor.mark(PERFORMANCE_MARKS.APP_READY);
      performanceMonitor.measure(
        PERFORMANCE_MEASURES.TOTAL_LOAD,
        PERFORMANCE_MARKS.APP_START,
        PERFORMANCE_MARKS.APP_READY
      );
      performanceMonitor.logMetrics();
      
      // Preload remaining features after app is ready
      setTimeout(() => {
        preloadFeature('settings');
      }, 2000);
    }
  }, [isInitialized, isLoading]);

  if (!isInitialized || isLoading) {
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
    <>
      <Layout />
      {isLoggingIn && (
        <Suspense fallback={<LoadingScreen />}>
          <LoginModal onClose={() => setIsLoggingIn(false)} />
        </Suspense>
      )}
    </>
  );
}

/**
 * Loading screen while app initializes
 */
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Spinner size="large" />
    </div>
  );
}

export default App; 