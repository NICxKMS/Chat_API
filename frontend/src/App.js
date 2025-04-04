import React, { Suspense, lazy } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ApiProvider } from './contexts/ApiContext';
import { ModelProvider } from './contexts/ModelContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ChatProvider } from './contexts/ChatContext';
import { AuthProvider } from './contexts/AuthContext';

// Lazy-loaded components
const Layout = lazy(() => import('./components/layout/Layout'));
const LoadingSpinner = lazy(() => import('./components/common/Spinner'));

/**
 * Main App component
 * Sets up context providers and base layout
 */
function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
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