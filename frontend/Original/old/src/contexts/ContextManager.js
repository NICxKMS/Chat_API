import { createContext, useContext, useMemo } from 'react';
import { ThemeProvider } from './ThemeContext';
import { ApiProvider } from './ApiContext';
import { ModelProvider } from './ModelContext';
import { SettingsProvider } from './SettingsContext';
import { ChatProvider } from './ChatContext';

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

  return (
    <InitializationContext.Provider value={initializationState}>
      <ThemeProvider>
        <ApiProvider>
          <ModelProvider>
            <SettingsProvider>
              <ChatProvider>
                {children}
              </ChatProvider>
            </SettingsProvider>
          </ModelProvider>
        </ApiProvider>
      </ThemeProvider>
    </InitializationContext.Provider>
  );
}; 