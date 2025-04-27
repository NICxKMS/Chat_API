import { createContext, useContext, useState, useMemo } from 'react';

// Create chat status context
const ChatStatusContext = createContext();

// Hook to use chat status context
export const useChatStatus = () => {
  const context = useContext(ChatStatusContext);
  if (context === undefined) {
    throw new Error('useChatStatus must be used within a ChatStatusProvider');
  }
  return context;
};

// Provider component for chat status
export const ChatStatusProvider = ({ children }) => {
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [error, setError] = useState(null);

  const value = useMemo(() => ({
    isWaitingForResponse,
    setIsWaitingForResponse,
    error,
    setError,
  }), [isWaitingForResponse, error]);

  return (
    <ChatStatusContext.Provider value={value}>
      {children}
    </ChatStatusContext.Provider>
  );
}; 