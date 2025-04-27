import React, { createContext, useContext, useMemo } from 'react';
import { useChatHistory } from './ChatHistoryContext';
import { useChatStatus } from './ChatStatusContext';

// Context for read-only chat state
const ChatStateContext = createContext();

// Hook to consume chat state
export const useChatState = () => {
  const context = useContext(ChatStateContext);
  if (context === undefined) {
    throw new Error('useChatState must be used within a ChatStateProvider');
  }
  return context;
};

// Provider component for chat state
export const ChatStateProvider = ({ children }) => {
  const { chatHistory, chatHistoryRef } = useChatHistory();
  const { isWaitingForResponse, error } = useChatStatus();

  const value = useMemo(() => ({
    chatHistory,
    chatHistoryRef,
    isWaitingForResponse,
    error
  }), [
    chatHistory,
    chatHistoryRef,
    isWaitingForResponse,
    error
  ]);

  return (
    <ChatStateContext.Provider value={value}>
      {children}
    </ChatStateContext.Provider>
  );
}; 