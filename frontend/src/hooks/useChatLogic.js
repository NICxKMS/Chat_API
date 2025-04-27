import { useCallback } from 'react';
import { useChatState } from '../contexts/ChatStateContext';
import { useChatControl } from '../contexts/ChatControlContext';
import { useModel } from '../contexts/ModelContext';
import { useSettings } from '../contexts/SettingsContext';

// Helper to generate unique IDs
const generateUniqueId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

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
    currentMessageMetrics: metrics
  } = useChatState();
  const { sendMessage: submitMessage, clearChat: resetChat, downloadChatHistory } = useChatControl();
  
  const { selectedModel } = useModel();
  const { settings } = useSettings();
  
  // Enhanced function to handle sending messages, including edits
  const handleSendMessage = useCallback(async (message, editedMessage = null) => {
    const isEditing = !!editedMessage;
    
    // Handle both string and array payloads for content validation
    const messageContent = Array.isArray(message) 
      ? message.map(part => part.type === 'text' ? part.text : '').join(' ').trim()
      : message;

    if (!messageContent && !Array.isArray(message)) return;
    if (!selectedModel) return;
    
    try {
      if (isEditing) {
        // Get or create unique identifier for the message
        const editMsgId = editedMessage.uniqueId || editedMessage.id || editedMessage.timestamp;
        // Find the index of the message being edited with a single pass
        const editIndex = chatHistory.findIndex(msg =>
          [msg.uniqueId, msg.id, msg.timestamp].includes(editMsgId) ||
          (typeof msg.content === 'string' && msg.content === editedMessage.content && msg.role === 'user')
        );
        if (editIndex === -1) {
          if (process.env.NODE_ENV === 'development') {
            console.error("Could not find message to edit");
            console.log("Edited message:", editedMessage);
            console.log("Chat history:", chatHistory.map(m => ({ 
              role: m.role, 
              uniqueId: m.uniqueId, 
              timestamp: m.timestamp,
              contentPreview: typeof m.content === 'string' ? m.content.substring(0, 20) : 'non-string'
            })));
          }
          return;
        }
        // Ensure the message to be submitted has the correct uniqueId
        const finalMessage = Array.isArray(message) ? message : { type: 'text', text: message };
        
        // Add uniqueId to message
        if (Array.isArray(finalMessage)) {
          finalMessage.uniqueId = editMsgId;
        } else {
          finalMessage.uniqueId = editMsgId;
        }
        
        // Call the submitMessage function with the truncated history index
        await submitMessage(finalMessage, editIndex);
      } else {
        // For new messages, generate a unique ID
        const uniqueId = generateUniqueId();
        
        // Add uniqueId to new message
        const finalMessage = Array.isArray(message) 
          ? message.map(part => ({...part, uniqueId}))
          : message;
          
        if (!Array.isArray(finalMessage)) {
          finalMessage.uniqueId = uniqueId;
        }
        
        // Normal message submission with uniqueId
        await submitMessage(finalMessage);
      }
    } catch (err) {
      console.error(`Error ${isEditing ? 'editing' : 'submitting'} message:`, err);
    }
  }, [selectedModel, submitMessage, chatHistory]);

  // Return values needed by the ChatContainer component
  return {
    chatHistory,
    isWaitingForResponse,
    error,
    metrics,
    selectedModel,
    settings,
    handleSendMessage,
    resetChat, 
    downloadChatHistory,
  };
}; 