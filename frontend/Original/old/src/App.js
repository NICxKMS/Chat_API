import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';

// Initial Shell - Ultra-lightweight component for immediate display
const AppShell = () => {
  // Mark shell visibility for performance tracking
  useEffect(() => {
    performanceMonitor.mark(PERFORMANCE_MARKS.SHELL_VISIBLE);
    performanceMonitor.measure(
      PERFORMANCE_MEASURES.TIME_TO_SHELL,
      PERFORMANCE_MARKS.APP_START,
      PERFORMANCE_MARKS.SHELL_VISIBLE
    );
  }, []);
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'var(--bg-color, #ffffff)'
    }}>
      <div className="pulse-loader"></div>
    </div>
  );
};

// Critical components loaded with highest priority
const LoadingSpinner = lazy(() => import(/* webpackChunkName: "critical", webpackPrefetch: true */ './components/common/Spinner'));

// Important components loaded next
const Layout = lazy(() => import(/* webpackChunkName: "important" */ './components/layout/Layout'));
const LoginModal = lazy(() => import(/* webpackChunkName: "auth" */ './components/auth/LoginModal'));

// Pre-loading strategy with priority tiers
const PRIORITY = {
  CRITICAL: 'critical',
  IMPORTANT: 'important',
  EVENTUAL: 'eventual'
};

const componentsToPreload = {
  [PRIORITY.CRITICAL]: [
    () => import('./components/common/Spinner')
  ],
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
  const [isShellDismissed, setIsShellDismissed] = useState(false);

  useEffect(() => {
    // Mark app start
    performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);
    
    // 1. Load critical components immediately and track performance
    Promise.all(componentsToPreload[PRIORITY.CRITICAL].map(fn => fn()))
      .then(() => {
        performanceMonitor.mark(PERFORMANCE_MARKS.CRITICAL_COMPONENTS_LOADED);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.CRITICAL_LOAD_TIME,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.CRITICAL_COMPONENTS_LOADED
        );
      });
    
    // 2. Use requestAnimationFrame for smooth initialization after first paint
    requestAnimationFrame(() => {
      performanceMonitor.mark(PERFORMANCE_MARKS.COMPONENT_LOAD);
      setIsInitialized(true);
      
      // 3. Dismiss shell after a short delay to avoid flicker
      setTimeout(() => {
        setIsShellDismissed(true);
        
        // Mark app as interactive when main UI becomes visible
        performanceMonitor.mark(PERFORMANCE_MARKS.APP_INTERACTIVE);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.TIME_TO_INTERACTIVE,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.APP_INTERACTIVE
        );
      }, 50);
      
      // 4. Load important components next with higher priority and track performance
      Promise.all(componentsToPreload[PRIORITY.IMPORTANT].map(fn => fn()))
        .then(() => {
          performanceMonitor.mark(PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED);
          performanceMonitor.measure(
            PERFORMANCE_MEASURES.IMPORTANT_LOAD_TIME,
            PERFORMANCE_MARKS.APP_START,
            PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED
          );
        });
      
      // 5. Load eventual components during idle time
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
    if (isInitialized && isShellDismissed) {
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
  }, [isInitialized, isShellDismissed]);

  // Show ultra-lightweight shell before anything else is ready
  if (!isInitialized || !isShellDismissed) {
    return <AppShell />;
  }

  return (
    <AuthProvider>
      <ContextManager>
        <AppContent />
      </ContextManager>
    </AuthProvider>
  );
}

// New component to access AuthContext with better Suspense boundaries
function AppContent() {
  const { isLoggingIn, setIsLoggingIn } = useAuth();

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Layout />
      </Suspense>
      
      {isLoggingIn && (
        <Suspense fallback={<LoadingScreen modal />}>
          <LoginModal onClose={() => setIsLoggingIn(false)} />
        </Suspense>
      )}
    </>
  );
}

/**
 * Loading screen with optimized rendering
 */
function LoadingScreen({ modal = false }) {
  const style = {
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center',
    height: modal ? '100%' : '100vh',
    width: '100%',
    position: modal ? 'fixed' : 'static',
    zIndex: modal ? 1000 : 1,
    background: modal ? 'rgba(0,0,0,0.2)' : 'var(--bg-color, #ffffff)'
  };

  return (
    <div style={style}>
      <Suspense fallback={<div className="pulse-loader"></div>}>
        <LoadingSpinner size="large" />
      </Suspense>
    </div>
  );
}

export default App; 