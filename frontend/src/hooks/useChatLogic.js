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

  // Function to handle sending messages using the context's submitMessage
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !selectedModel) return;
    
    // Reset stream content before sending
    setStreamContent(''); 
    
    try {
      // Call the unified submitMessage function from the context
      // It handles both streaming and non-streaming internally
      // Pass setStreamContent as the onUpdate callback for streaming
      await submitMessage(message, (content) => {
        setStreamContent(content);
      });
    } catch (err) {
      // Error handling might already be done in ChatContext, but good to be safe
      console.error("Error submitting message from useChatLogic:", err);
      // Optionally set a local error state if needed
    }
    
    // Clear stream content after message is fully sent?
    // Only needed if submitMessage doesn't handle this implicitly or if you want immediate UI clear
    // setStreamContent(''); // Review if this is necessary after the context change

  }, [selectedModel, submitMessage, setStreamContent]);
  
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