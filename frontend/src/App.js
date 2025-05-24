/* eslint-disable no-unused-vars */
import React, { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ContextManager } from "./contexts/ContextManager";
import Spinner from "./components/common/Spinner";
import {
  performanceMonitor,
  PERFORMANCE_MARKS,
  PERFORMANCE_MEASURES,
} from "./utils/performance";
import {
  loadChunkGroup,
  idlePreloadChunks,
  createChunkMonitor,
  createAdaptiveLoader,
  createSmallChunkBundle,
} from "./utils/chunkOptimizer";
// (Formatting preloads removed - we rely on on-demand loading)

// === Enhanced Lazy Loading Strategy with Chunk Optimization ===
// Group related components into micro-chunks for better caching and loading

// Core Layout Components (Critical - Load First)
const CORE_IMPORTS = {
  layout: () =>
    import(/* webpackChunkName: "core-layout" */ "./components/layout/Layout"),
  spinner: () =>
    import(
      /* webpackChunkName: "core-spinner" */ "./components/common/Spinner"
    ),
};

// Essential UI Components (Load Second)
const ESSENTIAL_IMPORTS = {
  chatContainer: () =>
    import(
      /* webpackChunkName: "chat-container" */ "./components/chat/ChatContainer"
    ),
  chatInput: () =>
    import(/* webpackChunkName: "chat-input" */ "./components/chat/ChatInput"),
  messageList: () =>
    import(
      /* webpackChunkName: "chat-messages" */ "./components/chat/MessageList"
    ),
  sidebar: () =>
    import(
      /* webpackChunkName: "layout-sidebar" */ "./components/layout/Sidebar"
    ),
  mainContent: () =>
    import(
      /* webpackChunkName: "layout-main" */ "./components/layout/MainContent"
    ),
};

// UI Controls (Load Third) - Group small controls together
const UI_CONTROLS_IMPORTS = createSmallChunkBundle(
  [
    () =>
      import(
        /* webpackChunkName: "ui-controls" */ "./components/models/ModelDropdown"
      ),
    () =>
      import(
        /* webpackChunkName: "ui-controls" */ "./components/common/ThemeToggle"
      ),
    () =>
      import(
        /* webpackChunkName: "ui-controls" */ "./components/layout/SidebarToggle"
      ),
    () =>
      import(
        /* webpackChunkName: "ui-controls" */ "./components/auth/AuthButton"
      ),
    () =>
      import(
        /* webpackChunkName: "ui-controls" */ "./components/common/MoreActions"
      ),
  ],
  "ui-controls"
);

// Secondary Features (Load Fourth) - Group feature components
const SECONDARY_IMPORTS = createSmallChunkBundle(
  [
    () =>
      import(
        /* webpackChunkName: "features" */ "./components/chat/GlobalMetricsBar"
      ),
    () =>
      import(
        /* webpackChunkName: "features" */ "./components/chat/PerformanceMetrics"
      ),
    () =>
      import(
        /* webpackChunkName: "features" */ "./components/settings/SettingsPanel"
      ),
  ],
  "features"
);

// Heavy/Optional Components (Load on Idle)
const HEAVY_IMPORTS = {
  markdownRenderer: () =>
    import(
      /* webpackChunkName: "heavy-markdown" */ "./components/common/LazyMarkdownRenderer/MarkdownRenderer"
    ),
  streamingMessage: () =>
    import(
      /* webpackChunkName: "heavy-streaming" */ "./components/chat/ChatMessage/StreamingMessage"
    ),
  loginModal: () =>
    import(
      /* webpackChunkName: "heavy-auth-modal" */ "./components/auth/LoginModal"
    ),
  imageOverlay: () =>
    import(
      /* webpackChunkName: "heavy-image-overlay" */ "./components/common/ImageOverlay"
    ),
  typingIndicator: () =>
    import(
      /* webpackChunkName: "heavy-typing" */ "./components/common/TypingIndicator"
    ),
};

// External Services (Load Last)
const EXTERNAL_IMPORTS = {
  firebase: () =>
    import(/* webpackChunkName: "external-firebase" */ "./firebaseConfig").then(
      () => {
        window.dispatchEvent(new Event("firebaseInitialized"));
      }
    ),
};

// Micro-components bundled together for efficiency
const MICRO_IMPORTS = createSmallChunkBundle(
  [
    () => import(/* webpackChunkName: "micro-bundle" */ "react-icons"),
    () => import(/* webpackChunkName: "micro-bundle" */ "lodash.debounce"),
    () => import(/* webpackChunkName: "micro-bundle" */ "lodash.throttle"),
    () => import(/* webpackChunkName: "micro-bundle" */ "clsx"),
  ],
  "micro-bundle"
);

// Lazy-load the layout using the shared import
const Layout = lazy(CORE_IMPORTS.layout);
const LoginModal = lazy(HEAVY_IMPORTS.loginModal);

// Initialize performance monitoring and adaptive loading
const chunkMonitor = createChunkMonitor();
const adaptiveLoader = createAdaptiveLoader();

/**
 * Enhanced AppShell with intelligent chunk loading and network awareness
 */
function AppShell() {
  const [loadingPhase, setLoadingPhase] = useState("initializing");
  const [loadedPhases, setLoadedPhases] = useState(new Set());
  const [networkStrategy, setNetworkStrategy] = useState(null);
  const { isLoggingIn, setIsLoggingIn } = useAuth();

  useEffect(() => {
    let canceled = false;

    async function runEnhancedPhases() {
      performanceMonitor.mark(PERFORMANCE_MARKS.APP_START);

      // Get network-aware loading strategy
      const strategy = adaptiveLoader.getStrategy();
      setNetworkStrategy(strategy);

      console.log("🌐 Network strategy:", strategy);

      try {
        // Phase 1: Core Components (Critical Path)
        setLoadingPhase("core");
        chunkMonitor.startLoad("core");

        await loadChunkGroup(CORE_IMPORTS, {
          groupName: "core",
          timeout: strategy.timeout,
          retries: strategy.skipNonEssential ? 1 : 2,
        });

        if (canceled) return;

        chunkMonitor.endLoad("core", true);
        performanceMonitor.mark(PERFORMANCE_MARKS.IMPORTANT_COMPONENTS_LOADED);
        setLoadedPhases((prev) => new Set([...prev, "core"]));

        // Phase 2: Essential UI (Main Interface)
        setLoadingPhase("essential");
        chunkMonitor.startLoad("essential");

        await loadChunkGroup(ESSENTIAL_IMPORTS, {
          groupName: "essential",
          timeout: strategy.timeout,
          retries: strategy.skipNonEssential ? 1 : 2,
        });

        if (canceled) return;

        chunkMonitor.endLoad("essential", true);
        setLoadedPhases((prev) => new Set([...prev, "essential"]));

        // Phase 3: UI Controls (Interactive Elements) - Load as bundled group
        setLoadingPhase("controls");
        chunkMonitor.startLoad("ui-controls");

        await loadChunkGroup(UI_CONTROLS_IMPORTS, {
          groupName: "ui-controls",
          timeout: strategy.timeout,
          retries: 1,
        });

        if (canceled) return;

        chunkMonitor.endLoad("ui-controls", true);
        performanceMonitor.mark(PERFORMANCE_MARKS.COMPONENT_LOAD);
        performanceMonitor.measure(
          PERFORMANCE_MEASURES.COMPONENT_LOAD,
          PERFORMANCE_MARKS.APP_START,
          PERFORMANCE_MARKS.COMPONENT_LOAD
        );

        setLoadedPhases((prev) => new Set([...prev, "controls"]));
        setLoadingPhase("ready");

        // Show app as interactive
        requestAnimationFrame(() => {
          if (canceled) return;

          performanceMonitor.mark(PERFORMANCE_MARKS.APP_INTERACTIVE);
          performanceMonitor.measure(
            PERFORMANCE_MEASURES.TIME_TO_INTERACTIVE,
            PERFORMANCE_MARKS.APP_START,
            PERFORMANCE_MARKS.APP_INTERACTIVE
          );

          console.log(
            "[Enhanced] App is interactive; starting intelligent preloading"
          );

          // Phase 4+: Intelligent idle loading based on network conditions
          if (!strategy.skipNonEssential) {
            const chunkGroups = {
              "secondary-features": {
                imports: SECONDARY_IMPORTS,
                priority: 0,
                options: { timeout: strategy.timeout },
              },
              "heavy-components": {
                imports: HEAVY_IMPORTS,
                priority: 1,
                options: { timeout: strategy.timeout * 1.5 },
              },
              "external-services": {
                imports: EXTERNAL_IMPORTS,
                priority: 2,
                options: { timeout: strategy.timeout * 2 },
              },
              "micro-components": {
                imports: MICRO_IMPORTS,
                priority: 3,
                options: { timeout: strategy.timeout },
              },
            };

            idlePreloadChunks(chunkGroups, {
              maxConcurrent: strategy.maxConcurrent,
              priorityDelay: strategy.priorityDelay,
              idleTimeout: strategy.timeout,
            });

            // Monitor chunk loading
            Object.keys(chunkGroups).forEach((groupName) => {
              chunkMonitor.startLoad(groupName);
            });

            // Update loaded phases as chunks complete
            const originalOnComplete = (groupName) => {
              chunkMonitor.endLoad(groupName, true);
              setLoadedPhases(
                (prev) =>
                  new Set([...prev, groupName.toLowerCase().replace(" ", "-")])
              );
            };
          } else {
            console.log(
              "🚫 Skipping non-essential chunks due to network conditions"
            );
          }
        });
      } catch (error) {
        console.error("[Enhanced] Error in loading phases:", error);
        chunkMonitor.endLoad(loadingPhase, false);
        setLoadingPhase("error");
      }
    }

    runEnhancedPhases();

    return () => {
      canceled = true;
      performanceMonitor.clear();
    };
  }, []);

  // Enhanced loading states with network awareness
  const isReady = loadingPhase === "ready" || loadedPhases.has("controls");
  const showSpinner =
    loadingPhase === "initializing" || loadingPhase === "core";

  if (showSpinner) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <Spinner size="medium" />
        <div style={{ fontSize: "0.875rem", opacity: 0.7 }}>
          Loading {loadingPhase}...
          {networkStrategy && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
              Network: {networkStrategy.effectiveType || "detecting..."}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loadingPhase === "error") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div>⚠️ Loading Error</div>
        <button onClick={() => window.location.reload()}>Reload App</button>
        {process.env.NODE_ENV === "development" && (
          <details style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
            <summary>Performance Metrics</summary>
            <pre style={{ textAlign: "left", fontSize: "0.75rem" }}>
              {JSON.stringify(chunkMonitor.getMetrics(), null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  // App ready: render layout + chat UI
  return (
    <>
      <Suspense
        fallback={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
            }}
          >
            <Spinner size="small" />
          </div>
        }
      >
        <Layout />
      </Suspense>

      {isLoggingIn && loadedPhases.has("heavy-components") && (
        <Suspense fallback={<Spinner size="small" />}>
          <LoginModal onClose={() => setIsLoggingIn(false)} />
        </Suspense>
      )}

      {/* Enhanced debug info in development */}
      {process.env.NODE_ENV === "development" && (
        <div
          style={{
            position: "fixed",
            bottom: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.9)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "11px",
            zIndex: 9999,
            maxWidth: "300px",
            fontFamily: "monospace",
          }}
        >
          <div>
            <strong>Phase:</strong> {loadingPhase}
          </div>
          <div>
            <strong>Loaded:</strong> {Array.from(loadedPhases).join(", ")}
          </div>
          {networkStrategy && (
            <>
              <div>
                <strong>Network:</strong>{" "}
                {adaptiveLoader.getNetworkInfo().effectiveType}
              </div>
              <div>
                <strong>Strategy:</strong> {networkStrategy.maxConcurrent}x
                concurrent
              </div>
            </>
          )}
          <div>
            <strong>Chunks:</strong> {chunkMonitor.getMetrics().totalLoaded}{" "}
            loaded, {chunkMonitor.getMetrics().totalFailed} failed
          </div>
        </div>
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
