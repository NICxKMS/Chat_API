import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';
import { preloadFormattingComponents, preloadFormattingComponentsIdle } from './utils/preloadFormatting';
import Spinner from './components/common/Spinner';
import { preloadComponentsIdle } from './utils/lazyLoad';

// Components loaded with dynamic imports
const Layout = lazy(() => import(/* webpackPreload: true, webpackChunkName: "important" */ './components/layout/Layout'));
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

// Define all non-formatting/model-selector chunks to preload during idle time
const idleImports = [
  () => import('./components/auth/LoginModal'),
  // Noncritical layout pieces
  () => import('./components/layout/Sidebar'),
  () => import('./components/models/ModelDropdown'),
  () => import('./components/common/Spinner'),
  // Chat subtree
  () => import('./components/chat/MessageList'),
  () => import('./components/chat/ChatInput'),
  () => import('./components/chat/GlobalMetricsBar'),
  () => import('./components/models/ModelSelectorButton')
];

/**
 * Main App component with optimized loading strategy
 */
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Mark app start
    performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);

    // Kick off critical imports for instant responsiveness
    const layoutPromise = import(
      /* webpackPreload: true, webpackChunkName: "important" */
      './components/layout/Layout'
    );
    // Prime chat components for immediate typing
    import('./components/chat/ChatContainer');
    import('./components/chat/ChatInput');
    // Also preload MainContent immediately since it's part of the core UI
    import('./components/layout/MainContent');

    requestAnimationFrame(() => {
      setIsInitialized(true);

      // Mark interactive and measure TTI
      performanceMonitor.mark(PERFORMANCE_MARKS.APP_INTERACTIVE);
      performanceMonitor.measure(
        PERFORMANCE_MEASURES.TIME_TO_INTERACTIVE,
        PERFORMANCE_MARKS.APP_START,
        PERFORMANCE_MARKS.APP_INTERACTIVE
      );

      // Schedule formatting/model-selector to load during idle time
      preloadFormattingComponentsIdle();

      // Schedule all other noncritical chunks to load during idle time
      preloadComponentsIdle(idleImports);

      // When Layout chunk resolves, mark important component load and preload formatting immediately
      layoutPromise.then(() => {
        performanceMonitor.mark(PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.IMPORTANT_LOAD_TIME,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED
        );
        // Immediately load formatting components for best markdown UX
        preloadFormattingComponents();
      });
    });

    // Cleanup on unmount
    return () => performanceMonitor.clear();
  }, []);

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

  // Fallback UI for Layout: spinner centered full-viewport
  const layoutFallback = (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      <Spinner size="medium" />
    </div>
  );

  return (
    <>
      <Suspense fallback={layoutFallback}>
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