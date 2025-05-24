/* eslint-disable no-unused-vars */
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import Spinner from './components/common/Spinner';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';
// (Formatting preloads removed - we rely on on-demand loading)

// === Phase 1: Critical (lazy) components & essential import definitions ===
// Define all essential dynamic imports once for reuse
const ESSENTIAL_IMPORTS = {
  layout: () => import(/* webpackPreload: true, webpackChunkName: "layout" */ './components/layout/Layout'),
  chatContainer: () => import(/* webpackPreload: true, webpackChunkName: "chat-container" */ './components/chat/ChatContainer'),
  chatInput: () => import(/* webpackPreload: true, webpackChunkName: "chat-input" */ './components/chat/ChatInput'),
  modelDropdown: () => import(/* webpackPreload: true, webpackChunkName: "models-dropdown" */ './components/models/ModelDropdown'),
  sidebar: () => import(/* webpackPreload: true, webpackChunkName: "layout-sidebar" */ './components/layout/Sidebar'),
  themeToggle: () => import(/* webpackPreload: true, webpackChunkName: "common-theme" */ './components/common/ThemeToggle'),
  sidebarToggle: () => import(/* webpackPreload: true, webpackChunkName: "layout-sidebar-toggle" */ './components/layout/SidebarToggle'),
  messageList: () => import(/* webpackPreload: true, webpackChunkName: "chat-messagelist" */ './components/chat/MessageList'),
  authButton: () => import(/* webpackPreload: true, webpackChunkName: "auth-button" */ './components/auth/AuthButton'),
  globalMetrics: () => import(/* webpackPreload: true, webpackChunkName: "chat-globalmetrics" */ './components/chat/GlobalMetricsBar'),
  moreActions: () => import(/* webpackPreload: true, webpackChunkName: "common-more-actions" */ './components/common/MoreActions'),
};
// Lazy-load the layout using the shared import
const Layout = lazy(ESSENTIAL_IMPORTS.layout);
// Lazy-load the login modal separately
const LoginModal = lazy(() => import(/* webpackChunkName: "login-modal" */ './components/auth/LoginModal'));

// Only essential preload for core components (plus idle-loaded heavy chunks)
const PRELOAD_IMPORTS = {
  essential: Object.values(ESSENTIAL_IMPORTS),
  heavy: [
    () => import(/* webpackPrefetch: true, webpackChunkName: "markdown-renderer" */ './components/common/LazyMarkdownRenderer/MarkdownRenderer'),
    () => import(/* webpackPrefetch: true, webpackChunkName: "streaming-message" */ './components/chat/ChatMessage/StreamingMessage'),
    () => import(/* webpackPrefetch: true, webpackChunkName: "firebase-config" */ './firebaseConfig')
              .then(() => {
                window.dispatchEvent(new Event('firebaseInitialized'));
              }),
  ]
};

// Remove unused `preloadAsync` helper; keep `preloadSync` for essential sync loads
const preloadSync = async (imports) => {
  await Promise.all(imports.map(fn => fn()));
};

// Simplify idlePreload: on idle, batch load all heavy imports
const idlePreload = (imports, onComplete) => {
  requestIdleCallback(() => {
    imports.forEach((fn, idx) => fn()
      .then(() => onComplete(idx))
      .catch(() => {})
    );
  });
};

/**
 * AppShell handles phased loading of chunks for optimal startup.
 */
function AppShell() {
  const [shellReady, setShellReady] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const { isLoggingIn, setIsLoggingIn } = useAuth();

  useEffect(() => {
    let canceled = false;

    async function runPhases() {
      // Phase 1: Essential components
      performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);
      console.log('[Phase1] Loading essential components...');
      try {
        await preloadSync(PRELOAD_IMPORTS.essential);
        performanceMonitor.mark(PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.IMPORTANT_LOAD_TIME,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED
        );
        performanceMonitor.mark(PERFORMANCE_MARKS.COMPONENT_LOAD);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.COMPONENT_LOAD,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.COMPONENT_LOAD
        );
        console.log('[Phase1] Essential components loaded');
      } catch (error) {
        console.error('[Phase1] Error loading essential components:', error);
      }

      // Show initial shell before heavy loads
      requestAnimationFrame(async () => {
        if (canceled) return;
        setShellReady(true);
        performanceMonitor.mark(PERFORMANCE_MARKS.APP_INTERACTIVE);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.TIME_TO_INTERACTIVE,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.APP_INTERACTIVE
        );
        console.log('[Phase1] App is interactive; idle-preloading heavy components');
        idlePreload(PRELOAD_IMPORTS.heavy, (idx) => {
          if (idx === PRELOAD_IMPORTS.heavy.length - 1) {
            console.log('[Phase2] Heavy components idle-preloaded');
            setFirebaseReady(true);
          }
        });
      });
    }

    runPhases();
    return () => {
      canceled = true;
      performanceMonitor.clear();
    };
  }, []);

  // Spinner until shell is ready
  if (!shellReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner size="medium" />
      </div>
    );
  }

  // Shell ready: render layout + chat UI
  return (
    <>
      <Suspense fallback={<Spinner size="small" />}><Layout /></Suspense>
      {isLoggingIn && firebaseReady && (
        <Suspense fallback={<Spinner size="small" />}>
          <LoginModal onClose={() => setIsLoggingIn(false)} />
        </Suspense>
      )}
    </>
  );
}

/** Root App with providers **/
export default function App() {
  return (
    <AuthProvider>
      <ContextManager>
        <AppShell />
      </ContextManager>
    </AuthProvider>
  );
} 