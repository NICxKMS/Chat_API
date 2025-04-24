import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import Spinner from './components/common/Spinner';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';
import { preloadComponents, preloadComponentsIdle } from './utils/lazyLoad';
import { basicFormattingImports, advancedFormattingImports, modelSelectorImports } from './utils/preloadFormatting';

// === Phase 1: Critical (lazy) components ===
const Layout = lazy(() => import(/* webpackPreload: true, webpackChunkName: "layout" */ './components/layout/Layout'));
const MainContent = lazy(() => import(/* webpackPreload: true, webpackChunkName: "main-content" */ './components/layout/MainContent'));
const LoginModal = lazy(() => import(/* webpackChunkName: "login-modal" */ './components/auth/LoginModal'));

// === Preload lists ===
const CORE_IMPORTS = [
  () => import(/* webpackPreload: true */ './components/layout/Layout'),
  () => import(/* webpackPreload: true */ './components/layout/MainContent'),
  () => import(/* webpackPreload: true */ './components/chat/ChatContainer'),
  () => import(/* webpackPreload: true */ './components/chat/ChatInput'),
];

const UI_IMPORTS = [
  () => import(/* webpackChunkName: "layout-sidebar" */ './components/layout/Sidebar'),
  () => import(/* webpackChunkName: "models-dropdown" */ './components/models/ModelDropdown'),
  () => import(/* webpackChunkName: "common-theme" */ './components/common/ThemeToggle'),
  () => import(/* webpackChunkName: "layout-sidebar-toggle" */ './components/layout/SidebarToggle'),
  () => import(/* webpackChunkName: "chat-messagelist" */ './components/chat/MessageList'),
  ...modelSelectorImports,
  () => import(/* webpackChunkName: "auth-button" */ './components/auth/AuthButton'),
  () => import(/* webpackChunkName: "chat-globalmetrics" */ './components/chat/GlobalMetricsBar'),
  () => import(/* webpackChunkName: "settings-panel" */ './components/settings/SettingsPanel'),
  () => import(/* webpackChunkName: "common-more-actions" */ './components/common/MoreActions'),
];

const BASIC_IMPORTS = basicFormattingImports; // react-markdown, remark-gfm, remark-emoji, rehype-raw, StreamingMessage
const HEAVY_IMPORTS = [
  ...advancedFormattingImports,           // syntax-highlighter, rehype-katex, KaTeX CSS
  // Dynamically import Firebase initialization to avoid blocking
  () => import('./firebaseConfig').then(mod => mod.initializeFirebase()),
];

/**
 * AppShell handles phased loading of chunks for optimal startup.
 */
function AppShell() {
  const [shellReady, setShellReady] = useState(false);
  const { isLoggingIn, setIsLoggingIn } = useAuth();

  useEffect(() => {
    let canceled = false;

    async function runPhases() {
      // Phase 1: Core components
      performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);
      console.log('[Phase1] Loading core components...');
      try {
        await preloadComponents(CORE_IMPORTS);
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
        console.log('[Phase1] Core components loaded');
      } catch (error) {
        console.error('[Phase1] Error loading core:', error);
      }

      // Show initial shell before heavy loads
      requestAnimationFrame(() => {
        if (canceled) return;
        setShellReady(true);
        performanceMonitor.mark(PERFORMANCE_MARKS.APP_INTERACTIVE);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.TIME_TO_INTERACTIVE,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.APP_INTERACTIVE
        );
        console.log('[Phase1] App is interactive');

        // Phase 2: UI + basic formatting in parallel
        console.log('[Phase2] Loading UI & basic formatting...');
        Promise.all([
          preloadComponents(UI_IMPORTS),
          preloadComponents(BASIC_IMPORTS)
        ])
          .then(() => {
            performanceMonitor.mark(PERFORMANCE_MARKS.APP_READY);
            performanceMonitor.measure(
              PERFORMANCE_MEASURES.TOTAL_LOAD,
              PERFORMANCE_MARKS.APP_START,
              PERFORMANCE_MARKS.APP_READY
            );
            console.log('[Phase2] UI & basic formatting loaded');

            // Phase 3: Idle-load heavy dependencies
            preloadComponentsIdle(HEAVY_IMPORTS);
            console.log('[Phase3] Heavy dependencies scheduled on idle');
          })
          .catch((err) => console.error('[Phase2] Error loading UI/basic formatting:', err));
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
      {isLoggingIn && (
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