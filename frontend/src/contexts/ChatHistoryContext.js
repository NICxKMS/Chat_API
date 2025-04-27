import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';

// Create chat history context
const ChatHistoryContext = createContext();

// Hook to use chat history context
export const useChatHistory = () => {
  const context = useContext(ChatHistoryContext);
  if (context === undefined) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
};

// Provider component for chat history
export const ChatHistoryProvider = ({ children }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const chatHistoryRef = useRef([]);

  // Keep ref in sync with state
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  // Add message, stable callback
  const addMessageToHistory = useCallback((role, content, metrics) => {
    const message = { role, content, timestamp: Date.now(), ...(metrics && { metrics }) };
    setChatHistory(prev => [...prev, message]);
    return message;
  }, [setChatHistory]);

  // Function to update content of the most recent assistant message (avoiding user replacements)
  const updateChatWithContent = useCallback((content) => {
    setChatHistory(prev => {
      const lastIndex = prev.length - 1;
      if (lastIndex < 0) return prev;
      const lastMsg = prev[lastIndex];
      // No-op if not assistant or same content
      if (lastMsg.role !== 'assistant' || lastMsg.content === content) {
        return prev;
      }
      // Otherwise clone and update
      const newHistory = [...prev];
      newHistory[lastIndex] = { ...lastMsg, content };
      return newHistory;
    });
  }, [setChatHistory]);

  // Memoize context value to avoid re-renders
  const value = useMemo(() => ({
    chatHistory,
    chatHistoryRef,
    setChatHistory,
    addMessageToHistory,
    updateChatWithContent
  }), [chatHistory, chatHistoryRef, setChatHistory, addMessageToHistory, updateChatWithContent]);

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}; 