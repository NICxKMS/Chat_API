import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';
import { basicFormattingImports, advancedFormattingImports, modelSelectorImports } from './utils/preloadFormatting';
import Spinner from './components/common/Spinner';
import { preloadComponents, preloadComponentsIdle } from './utils/lazyLoad';

// Phase 1 Components (Loaded immediately or via webpackPreload)
const Layout = lazy(() => import(/* webpackPreload: true, webpackChunkName: "important-layout" */ './components/layout/Layout'));
// MainContent, ChatContainer, ChatInput are imported directly below for Phase 1

// Other Lazy Loaded Components (will be loaded in phases or background)
const LoginModal = lazy(() => import(/* webpackChunkName: "auth-modal" */ './components/auth/LoginModal'));
// Define component import functions for phases
// Phase 2 Imports
const phase2Imports = [
  () => import(/* webpackChunkName: "layout-sidebar" */ './components/layout/Sidebar'),
  () => import(/* webpackChunkName: "models-dropdown" */ './components/models/ModelDropdown'),
  () => import(/* webpackChunkName: "common-theme" */ './components/common/ThemeToggle'),
  () => import(/* webpackChunkName: "layout-sidebar-toggle" */ './components/layout/SidebarToggle'),
  () => import(/* webpackChunkName: "chat-messagelist" */ './components/chat/MessageList'), // Needed early for chat view
  ...basicFormattingImports, // Includes react-markdown, remark-gfm, remark-emoji, rehype-raw, StreamingMessage
  ...modelSelectorImports, // Includes ModelDropdown, ModelItem, ModelSearch, ModelSelectorButton
  // Moved from backgroundImports:
  () => import(/* webpackChunkName: "auth-button" */ './components/auth/AuthButton'),
  () => import(/* webpackChunkName: "chat-globalmetrics" */ './components/chat/GlobalMetricsBar'),
  // Add any other non-critical components previously in background here
];

// Phase 3 Imports
const phase3Imports = [
  () => import(/* webpackChunkName: "auth-modal" */ './components/auth/LoginModal'),

  () => import(/* webpackChunkName: "settings-panel" */ './components/settings/SettingsPanel'),
  () => import(/* webpackChunkName: "common-more-actions" */ './components/common/MoreActions'),
  ...advancedFormattingImports, // Includes syntax highlighting

];

// Background Imports (Idle Time) - Removed

// Update Performance Marks for Phases
const PHASED_MARKS = {
  ...PERFORMANCE_MARKS,
  PHASE_2_START: 'phase-2-start',
  PHASE_2_END: 'phase-2-end',
  PHASE_3_START: 'phase-3-start',
  PHASE_3_END: 'phase-3-end',
  // BACKGROUND_LOAD_SCHEDULED: 'background-load-scheduled' - Removed
};
const PHASED_MEASURES = {
  ...PERFORMANCE_MEASURES,
  PHASE_2_LOAD_TIME: 'phase-2-load-time',
  PHASE_3_LOAD_TIME: 'phase-3-load-time',
};

/**
 * Main App component with optimized phased loading strategy
 */
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // == PHASE 1: INSTANT RENDER ==
    performanceMonitor.mark(PHASED_MARKS.APP_START);
    console.log("[Load] Phase 1: Critical Path Start");

    // Trigger critical Layout chunk load (already marked webpackPreload)
    const layoutPromise = import(/* webpackPreload: true, webpackChunkName: "important-layout" */ './components/layout/Layout');

    // Immediately import other critical JS for core functionality
    import(/* webpackPreload: true, webpackChunkName: "important-maincontent" */ './components/layout/MainContent');
    import(/* webpackPreload: true, webpackChunkName: "important-chatcontainer" */'./components/chat/ChatContainer');
    import(/* webpackPreload: true, webpackChunkName: "important-chatinput" */'./components/chat/ChatInput');
    // Spinner is imported directly

    performanceMonitor.mark(PHASED_MARKS.COMPONENT_LOAD); // Mark end of Phase 1 synchronous imports
    performanceMonitor.measure(PHASED_MEASURES.COMPONENT_LOAD, PHASED_MARKS.APP_START, PHASED_MARKS.COMPONENT_LOAD);
    console.log("[Load] Phase 1: Critical Imports Triggered");

    // Use rAF to ensure Phase 1 rendering completes before starting Phase 2 loads
    requestAnimationFrame(() => {
      setIsInitialized(true); // Render the basic layout shell
      performanceMonitor.mark(PHASED_MARKS.APP_INTERACTIVE);
      performanceMonitor.measure(
        PHASED_MEASURES.TIME_TO_INTERACTIVE,
        PHASED_MARKS.APP_START,
        PHASED_MARKS.APP_INTERACTIVE
      );
      console.log(`[Perf] TTI: ${performance.getEntriesByName(PHASED_MEASURES.TIME_TO_INTERACTIVE, 'measure')[0]?.duration.toFixed(1)}ms`);

      // == PHASE 2: INTERACTIVE EXPERIENCE ==
      // Start loading Phase 2 components immediately after becoming interactive
      console.log("[Load] Phase 2: Interactive Experience Start");
      performanceMonitor.mark(PHASED_MARKS.PHASE_2_START);
      const phase2Promise = preloadComponents(phase2Imports);
      phase2Promise.then(() => {
        performanceMonitor.mark(PHASED_MARKS.PHASE_2_END);
        performanceMonitor.measure(PHASED_MEASURES.PHASE_2_LOAD_TIME, PHASED_MARKS.PHASE_2_START, PHASED_MARKS.PHASE_2_END);
        console.log(`[Load] Phase 2: Complete (${performance.getEntriesByName(PHASED_MEASURES.PHASE_2_LOAD_TIME, 'measure')[0]?.duration.toFixed(1)}ms)`);

        // == PHASE 3: COMPLETE APP ==
        // Start loading Phase 3 immediately after Phase 2 finishes
        console.log("[Load] Phase 3: Complete App Start");
        performanceMonitor.mark(PHASED_MARKS.PHASE_3_START);
        const phase3Promise = preloadComponents(phase3Imports);
        phase3Promise.then(() => {
           performanceMonitor.mark(PHASED_MARKS.PHASE_3_END);
           performanceMonitor.measure(PHASED_MEASURES.PHASE_3_LOAD_TIME, PHASED_MARKS.PHASE_3_START, PHASED_MARKS.PHASE_3_END);
           console.log(`[Load] Phase 3: Complete (${performance.getEntriesByName(PHASED_MEASURES.PHASE_3_LOAD_TIME, 'measure')[0]?.duration.toFixed(1)}ms)`);
           performanceMonitor.mark(PHASED_MARKS.APP_READY); // Mark app as fully ready
           performanceMonitor.measure(PHASED_MEASURES.TOTAL_LOAD, PHASED_MARKS.APP_START, PHASED_MARKS.APP_READY);
           console.log(`[Perf] Total Load Time (Foreground): ${performance.getEntriesByName(PHASED_MEASURES.TOTAL_LOAD, 'measure')[0]?.duration.toFixed(1)}ms`);
        }).catch(err => console.error("Error loading Phase 3 components:", err));

      }).catch(err => console.error("Error loading Phase 2 components:", err));

      // == BACKGROUND LOADING == - Removed
      // Schedule remaining non-critical components during idle time
      // console.log("[Load] Background: Scheduling idle loads");
      // preloadComponentsIdle(backgroundImports);
      // performanceMonitor.mark(PHASED_MARKS.BACKGROUND_LOAD_SCHEDULED);

      // Original layoutPromise handling (can be kept or adjusted)
      // For example, measure time until the main layout chunk specifically is ready
      layoutPromise.then(() => {
        performanceMonitor.mark(PHASED_MARKS.IMPORTANT_COMPONENTS_LOADED); // Or a more specific mark like LAYOUT_CHUNK_LOADED
        performanceMonitor.measure(
          PHASED_MEASURES.IMPORTANT_LOAD_TIME, // Or a more specific measure
          PHASED_MARKS.APP_START,
          PHASED_MARKS.IMPORTANT_COMPONENTS_LOADED
        );
         console.log(`[Perf] Layout Chunk Load Time: ${performance.getEntriesByName(PHASED_MEASURES.IMPORTANT_LOAD_TIME, 'measure')[0]?.duration.toFixed(1)}ms`);
        // Any specific action needed after Layout is loaded can go here
      });
    });

    // Cleanup on unmount
    return () => performanceMonitor.clear();
  }, []);

  // Render Spinner during initial hydration before isInitialized is true
  if (!isInitialized) {
    // Minimal full-page spinner for initial load before Layout shell renders
    return (
       <div style={{ display: 'flex', width: '100vw', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
         <Spinner size="medium" />
       </div>
     );
  }

  // Render App structure once initialized
  return (
    <AuthProvider>
      <ContextManager>
        <AppContent />
      </ContextManager>
    </AuthProvider>
  );
}

// Component to access AuthContext - uses Layout which handles its own Suspense
function AppContent() {
  const { isLoggingIn, setIsLoggingIn } = useAuth();

  // Layout already has a Suspense fallback internally.
  // The outer Spinner handles the very initial load before Layout is even attempted.
  return (
    <>
      <Suspense fallback={null}> {/* Fallback managed within Layout */}
        <Layout />
      </Suspense>

      {/* Login Modal - loaded in background, suspended if needed */}
      {isLoggingIn && (
        <Suspense fallback={<Spinner size="small"/>}> {/* Smaller spinner for modal */}
          <LoginModal onClose={() => setIsLoggingIn(false)} />
        </Suspense>
      )}
    </>
  );
}

export default App; 