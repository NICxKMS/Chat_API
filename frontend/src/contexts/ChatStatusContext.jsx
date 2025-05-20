import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useLoading } from './LoadingContext';

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
  // Sync with global loading context for chat
  const [, startChatLoading, stopChatLoading] = useLoading('chat');
  useEffect(() => {
    if (isWaitingForResponse) startChatLoading();
    else stopChatLoading();
  }, [isWaitingForResponse, startChatLoading, stopChatLoading]);

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