/* eslint-disable no-unused-vars */
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContextManager } from './contexts/ContextManager';
import Spinner from './components/common/Spinner';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './utils/performance';
import { basicFormattingImports, advancedFormattingImports, modelSelectorImports } from './utils/preloadFormatting';

// === Phase 1: Critical (lazy) components ===
const Layout = lazy(() => import(/* webpackPreload: true, webpackChunkName: "layout" */ './components/layout/Layout'));
const LoginModal = lazy(() => import(/* webpackChunkName: "login-modal" */ './components/auth/LoginModal'));

// === Preload lists ===
// Combined core and UI imports for faster initial load
const ESSENTIAL_IMPORTS = [
  // Core UI components
  () => import(/* webpackPreload: true, webpackChunkName: "layout" */ './components/layout/Layout'),
  () => import(/* webpackPreload: true, webpackChunkName: "chat-container" */ './components/chat/ChatContainer'),
  () => import(/* webpackPreload: true, webpackChunkName: "chat-input" */ './components/chat/ChatInput'),
  ...modelSelectorImports,
  () => import(/* webpackChunkName: "models-dropdown" */ './components/models/ModelDropdown'),
  
  // Additional UI components
  () => import(/* webpackChunkName: "layout-sidebar" */ './components/layout/Sidebar'),
  () => import(/* webpackChunkName: "common-theme" */ './components/common/ThemeToggle'),
  () => import(/* webpackChunkName: "layout-sidebar-toggle" */ './components/layout/SidebarToggle'),
  () => import(/* webpackChunkName: "chat-messagelist" */ './components/chat/MessageList'),
  () => import(/* webpackChunkName: "auth-button" */ './components/auth/AuthButton'),
  () => import(/* webpackChunkName: "chat-globalmetrics" */ './components/chat/GlobalMetricsBar'),
  () => import(/* webpackChunkName: "common-more-actions" */ './components/common/MoreActions'),
];

const BASIC_IMPORTS = [
  ...basicFormattingImports, // Just react-markdown and remark-gfm
  // Settings panel (load with basic components)
  () => import(/* webpackChunkName: "settings-panel" */ './components/settings/SettingsPanel'),
];

const HEAVY_IMPORTS = [
  ...advancedFormattingImports,          // StreamingMessage and all formatting tools (syntax-highlighter, KaTeX, etc.)
  // Firebase auth imports
  () => import(/* webpackChunkName: "firebase-config" */ './firebaseConfig').then(mod => mod.initializeFirebase()),
  () => import(/* webpackChunkName: "login-modal" */ './components/auth/LoginModal'),
];

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
        // Load all essential UI components
        for (const importFn of ESSENTIAL_IMPORTS) {
          await importFn();
        }
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

        // Phase 2: Load basic formatting
        console.log('[Phase2] Loading basic formatting...');
        Promise.all(BASIC_IMPORTS.map(importFn => importFn()))
          .then(() => {
            performanceMonitor.mark(PERFORMANCE_MARKS.APP_READY);
            performanceMonitor.measure(
              PERFORMANCE_MEASURES.TOTAL_LOAD,
              PERFORMANCE_MARKS.APP_START,
              PERFORMANCE_MARKS.APP_READY
            );
            console.log('[Phase2] Basic formatting loaded');

            // Phase 3: Idle-load heavy dependencies (including Firebase)
            console.log('[Phase3] Scheduling heavy dependencies on idle...');
            let index = 0;
            
            function loadNext(deadline) {
              let i = index;  // Create a local variable
              while ((deadline.timeRemaining() > 0 || deadline.didTimeout) && i < HEAVY_IMPORTS.length) {
                const currentIndex = i;
                HEAVY_IMPORTS[currentIndex]()
                  .then(() => {
                    // Set firebaseReady when Firebase config import is complete
                    if (currentIndex === HEAVY_IMPORTS.length - 2) { // Firebase config import
                      console.log('[Phase3] Firebase initialized');
                      setFirebaseReady(true);
                      // Dispatch custom event to notify AuthContext
                      window.dispatchEvent(new Event('firebaseInitialized'));
                    }
                  })
                  .catch(err => console.error(`Idle load error for module ${currentIndex}:`, err));
                i++;
              }
              
              // Update the outer index variable
              index = i;
              
              if (index < HEAVY_IMPORTS.length) {
                requestIdleCallback(loadNext, { timeout: 1000 });
              } else {
                console.log(`[Phase3] Completed loading ${HEAVY_IMPORTS.length} heavy modules`);
              }
            }
            
            // Instead of idle callback, which might delay Firebase too much,
            // preload Firebase immediately then use idle for the rest
            console.log('[Phase3] Explicitly loading Firebase...');
            // Load Firebase first (the last two imports in HEAVY_IMPORTS)
            Promise.all([
              HEAVY_IMPORTS[HEAVY_IMPORTS.length - 2](), // Firebase config
              HEAVY_IMPORTS[HEAVY_IMPORTS.length - 1]()  // Login modal
            ])
            .then(() => {
              console.log('[Phase3] Firebase initialized');
              setFirebaseReady(true);
              // Dispatch custom event to notify AuthContext
              window.dispatchEvent(new Event('firebaseInitialized'));
              
              // Now load the remaining imports using idle callback
              if (HEAVY_IMPORTS.length > 2) {
                index = 0; // Reset index to load non-Firebase modules
                const nonFirebaseImports = HEAVY_IMPORTS.slice(0, -2);
                
                function loadRemainingModules(deadline) {
                  let j = index;  // Create a local variable
                  while ((deadline.timeRemaining() > 0 || deadline.didTimeout) && j < nonFirebaseImports.length) {
                    const currentModuleIndex = j;
                    nonFirebaseImports[currentModuleIndex]()
                      .catch(err => console.error(`Idle load error for module ${currentModuleIndex}:`, err));
                    j++;
                  }
                  
                  // Update the outer index variable
                  index = j;
                  
                  if (index < nonFirebaseImports.length) {
                    requestIdleCallback(loadRemainingModules, { timeout: 1000 });
                  } else {
                    console.log(`[Phase3] Completed loading ${nonFirebaseImports.length} remaining heavy modules`);
                  }
                }
                
                requestIdleCallback(loadRemainingModules, { timeout: 1000 });
              }
            })
            .catch(err => console.error('[Phase3] Error loading Firebase:', err));
          })
          .catch((err) => console.error('[Phase2] Error loading basic formatting:', err));
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