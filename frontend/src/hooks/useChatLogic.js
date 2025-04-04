import { useState, useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useModel } from '../contexts/ModelContext';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Custom Hook for Chat Container Logic
 * Encapsulates state management, API calls, and event handlers 
 * related to the chat interface.
 */
export const useChatLogic = () => {
  const { 
    chatHistory, 
    isWaitingForResponse, 
    error,
    metrics,
    submitMessage,
    resetChat, 
    downloadChatHistory 
  } = useChat();
  
  const { selectedModel } = useModel();
  const { settings } = useSettings();
  
  // Function to handle sending messages using the context's submitMessage
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !selectedModel) return;
    
    try {
      // Call the submitMessage function from the context
      await submitMessage(message);
    } catch (err) {
      // Error handling might already be done in ChatContext, but good to be safe
      console.error("Error submitting message from useChatLogic:", err);
    }
  }, [selectedModel, submitMessage]);

  // Return values needed by the ChatContainer component
  return {
    chatHistory,
    isWaitingForResponse,
    error,
    metrics,
    selectedModel,
    settings,
    handleSendMessage,
    resetChat, // Pass through from context
    downloadChatHistory, // Pass through from context
  };
}; 