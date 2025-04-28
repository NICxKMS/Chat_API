import React, { createContext, useContext, useState, useRef,  useCallback, useMemo } from 'react';

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
  // State and ref for chat history, with custom setter to sync ref immediately
  const [chatHistory, internalSetChatHistory] = useState([]);
  const chatHistoryRef = useRef([]);

  // Wrap setter to sync ref and state in one step
  const setChatHistory = useCallback((update) => {
    internalSetChatHistory(prev => {
      const newHistory = typeof update === 'function' ? update(prev) : update;
      chatHistoryRef.current = newHistory;
      return newHistory;
    });
  }, []);

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
  }), [chatHistory, setChatHistory, addMessageToHistory, updateChatWithContent]);

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}; 