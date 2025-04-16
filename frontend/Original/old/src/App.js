import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';

// Components loaded with dynamic imports
const Layout = lazy(() => import(/* webpackChunkName: "important" */ './components/layout/Layout'));
const LoginModal = lazy(() => import(/* webpackChunkName: "auth" */ './components/auth/LoginModal'));

// Component loading priorities
const PRIORITY = {
  IMPORTANT: 'important',
  EVENTUAL: 'eventual'
};

const componentsToPreload = {
  [PRIORITY.IMPORTANT]: [
    () => import('./components/layout/Layout'),
  ],
  [PRIORITY.EVENTUAL]: [
    () => import('./components/auth/LoginModal')
  ]
};

/**
 * Main App component with optimized loading strategy
 */
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Mark app start
    performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);
    
    // Use requestAnimationFrame for smooth initialization after first paint
    requestAnimationFrame(() => {
      performanceMonitor.mark(PERFORMANCE_MARKS.COMPONENT_LOAD);
      setIsInitialized(true);
      
      // Mark app as interactive when main UI becomes visible
      performanceMonitor.mark(PERFORMANCE_MARKS.APP_INTERACTIVE);
      performanceMonitor.measure(
        PERFORMANCE_MEASURES.TIME_TO_INTERACTIVE,
        PERFORMANCE_MARKS.APP_START,
        PERFORMANCE_MARKS.APP_INTERACTIVE
      );
      
      // Load important components next with higher priority and track performance
      Promise.all(componentsToPreload[PRIORITY.IMPORTANT].map(fn => fn()))
        .then(() => {
          performanceMonitor.mark(PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED);
          performanceMonitor.measure(
            PERFORMANCE_MEASURES.IMPORTANT_LOAD_TIME,
            PERFORMANCE_MARKS.APP_START,
            PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED
          );
        });
      
      // Load eventual components during idle time
      if (window.requestIdleCallback) {
        window.requestIdleCallback(
          () => Promise.all(componentsToPreload[PRIORITY.EVENTUAL].map(fn => fn())),
          { timeout: 2000 }
        );
      } else {
        setTimeout(
          () => Promise.all(componentsToPreload[PRIORITY.EVENTUAL].map(fn => fn())),
          500
        );
      }
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
      
      // Log all collected metrics
      setTimeout(() => {
        performanceMonitor.logMetrics();
      }, 1000); // Delay logging to ensure all metrics are collected
    }
  }, [isInitialized]);

  // Render nothing until initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <AuthProvider>
      <ContextManager>
        <AppContent />
      </ContextManager>
    </AuthProvider>
  );
}

// Component to access AuthContext with no loading fallbacks
function AppContent() {
  const { isLoggingIn, setIsLoggingIn } = useAuth();

  return (
    <>
      <Suspense fallback={null}>
        <Layout />
      </Suspense>
      
      {isLoggingIn && (
        <Suspense fallback={null}>
          <LoginModal onClose={() => setIsLoggingIn(false)} />
        </Suspense>
      )}
    </>
  );
}

export default App; 