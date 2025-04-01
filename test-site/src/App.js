import React, { Suspense, lazy } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ApiProvider } from './contexts/ApiContext';
import { ModelProvider } from './contexts/ModelContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ChatProvider } from './contexts/ChatContext';

// Lazy-loaded components
const Layout = lazy(() => import('./components/layout/Layout'));
const LoadingSpinner = lazy(() => import('./components/common/Spinner'));

/**
 * Main App component
 * Sets up context providers and base layout
 */
function App() {
  return (
    <ThemeProvider>
      <ApiProvider>
        <ModelProvider>
          <SettingsProvider>
            <ChatProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Layout />
              </Suspense>
            </ChatProvider>
          </SettingsProvider>
        </ModelProvider>
      </ApiProvider>
    </ThemeProvider>
  );
}

/**
 * Loading screen while app initializes
 */
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <LoadingSpinner size="large" />
      </Suspense>
      <p>Initializing Chat App...</p>
    </div>
  );
}

export default App; 