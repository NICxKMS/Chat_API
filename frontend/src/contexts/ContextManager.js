import { createContext, useContext, useMemo, useEffect } from 'react';
import { ThemeProvider } from './ThemeContext';
import { ApiProvider } from './ApiContext';
import { ModelProvider } from './ModelContext';
import { SettingsProvider } from './SettingsContext';
import { ChatStatusProvider } from './ChatStatusContext';
import { ChatHistoryProvider } from './ChatHistoryContext';
import { PerformanceMetricsProvider } from './PerformanceMetricsContext';
import { StreamingEventsProvider } from './StreamingEventsContext';
import { ChatStateProvider } from './ChatStateContext';
import { ChatControlProvider } from './ChatControlContext';

// Create a context for managing initialization state
const InitializationContext = createContext(null);

export const useInitialization = () => {
  const context = useContext(InitializationContext);
  if (!context) {
    throw new Error('useInitialization must be used within an InitializationProvider');
  }
  return context;
};

/**
 * ContextManager component that handles all context providers
 * and their initialization states
 */
export const ContextManager = ({ children }) => {
  // Memoize the initialization state to prevent unnecessary re-renders
  const initializationState = useMemo(() => ({
    isInitialized: false,
    setInitialized: (value) => {
      initializationState.isInitialized = value;
    }
  }), []);
  // Mark as initialized once on mount
  useEffect(() => {
    initializationState.setInitialized(true);
  }, [initializationState]);

  return (
    <InitializationContext.Provider value={initializationState}>
      <ThemeProvider>
        <ApiProvider>
          <ModelProvider>
            <SettingsProvider>
              <ChatStatusProvider>
                <ChatHistoryProvider>
                  <PerformanceMetricsProvider>
                    <StreamingEventsProvider>
                      <ChatStateProvider>
                        <ChatControlProvider>
                          {children}
                        </ChatControlProvider>
                      </ChatStateProvider>
                    </StreamingEventsProvider>
                  </PerformanceMetricsProvider>
                </ChatHistoryProvider>
              </ChatStatusProvider>
            </SettingsProvider>
          </ModelProvider>
        </ApiProvider>
      </ThemeProvider>
    </InitializationContext.Provider>
  );
}; 