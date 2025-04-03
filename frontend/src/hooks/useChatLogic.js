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
    sendMessage, 
    sendMessageStreaming,
    stopStreaming,
    resetChat, 
    downloadChatHistory 
  } = useChat();
  
  const { selectedModel } = useModel();
  const { settings } = useSettings();
  
  // Reference to message list for scrolling (can be managed here or passed in if needed)
  // const messageListRef = useRef(null); 
  
  // Local state for streaming content updates could be managed here
  const [streamContent, setStreamContent] = useState('');
  
  // State for tracking the currently processed message (might not be needed if Input handles its own state)
  // const [currentMessage, setCurrentMessage] = useState(''); 

  // Function to handle sending messages
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !selectedModel) return;
    
    // Reset stream content before sending
    setStreamContent(''); 
    
    // Decide whether to stream based on settings
    if (settings.stream) {
      await sendMessageStreaming(message, (content) => {
        setStreamContent(content); // Update stream content as it arrives
      });
    } else {
      await sendMessage(message);
    }
    
    // Clear stream content after message is fully sent (if needed)
    // setStreamContent(''); // Reset after non-streaming call? Review this logic.

  }, [selectedModel, settings.stream, sendMessage, sendMessageStreaming]);
  
  // Handle stopping generation
  const handleStopGeneration = useCallback(() => {
    stopStreaming();
    setStreamContent(''); // Clear any partial streaming content
  }, [stopStreaming]);

  // Return values needed by the ChatContainer component
  return {
    chatHistory,
    isWaitingForResponse,
    error,
    metrics,
    selectedModel,
    settings,
    streamContent,
    // messageListRef, // Expose ref if managed here
    handleSendMessage,
    handleStopGeneration,
    resetChat, // Pass through from context
    downloadChatHistory, // Pass through from context
  };
}; 