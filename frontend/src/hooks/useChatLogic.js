import { useCallback } from 'react';
import { useChatState } from '../contexts/ChatStateContext';
import { useChatControl } from '../contexts/ChatControlContext';
import { useModel } from '../contexts/ModelContext';
import { useSettings } from '../contexts/SettingsContext';
import { generateMessageId } from '../utils/uuid';
import { validateMessageContent, findMessageIndex, prepareMessageForSubmission } from '../utils/messageProcessing';

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
    
    // Validate message content using utility
    const validation = validateMessageContent(message);
    if (!validation.isValid) {
      console.warn('Invalid message:', validation.reason);
      return;
    }
    
    if (!selectedModel) return;
    
    try {
      if (isEditing) {
        // Get or create unique identifier for the message
        const editMsgId = editedMessage.uniqueId || editedMessage.id || editedMessage.timestamp;
        // Find the index of the message being edited using utility
        const editIndex = findMessageIndex(chatHistory, editedMessage);
        if (editIndex === -1) {
          return;
        }
        // Prepare message for submission using utility
        const finalMessage = prepareMessageForSubmission(message, editMsgId);
        
        // Call the submitMessage function with the truncated history index
        await submitMessage(finalMessage, editIndex);
      } else {
        // For new messages, generate a unique ID and prepare message
        const uniqueId = generateMessageId();
        const finalMessage = prepareMessageForSubmission(message, uniqueId);
        
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