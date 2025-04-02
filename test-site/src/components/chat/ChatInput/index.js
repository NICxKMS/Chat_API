import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { PaperAirplaneIcon, PlusIcon } from '@primer/octicons-react';
import styles from './ChatInput.module.css';

/**
 * Auto-resizing chat input component
 * @param {Object} props - Component props
 * @param {Function} props.onSendMessage - Function to handle message sending
 * @param {Function} props.onNewChat - Function to trigger a new chat
 * @param {boolean} [props.disabled=false] - Whether the input is disabled
 * @param {Object} [props.selectedModel] - Currently selected model
 * @param {boolean} [props.isStaticLayout=false] - Flag indicating if the layout is static (empty chat)
 * @returns {JSX.Element} - Rendered component
 */
const ChatInput = memo(({ onSendMessage, onNewChat, disabled = false, selectedModel, isStaticLayout = false }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);
  
  // Focus input on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
  // Auto-resize the textarea as content changes
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get proper scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight (content height) + some padding
    const newHeight = Math.min(textarea.scrollHeight + 2, 200);
    textarea.style.height = `${newHeight}px`;
  }, []);
  
  // Update height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);
  
  // Handle message change
  const handleChange = (e) => {
    setMessage(e.target.value);
  };
  
  // Handle keydown events (Enter without Shift to send)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Send message and reset input
  const handleSend = () => {
    if (!message.trim() || disabled) return;
    
    onSendMessage(message);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Focus textarea after sending
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };
  
  return (
    <div className={styles.inputContainer}>
      {/* Conditionally render New Chat button only if not static layout */}
      {!isStaticLayout && (
        <button 
          className={`${styles.actionButton} ${styles.newChatButton}`}
          onClick={onNewChat}
          aria-label="Start new chat"
          title="Start new chat"
          type="button"
        >
          <PlusIcon size={18} />
        </button>
      )}
      
      <textarea
        ref={textareaRef}
        className={styles.chatInput}
        placeholder={selectedModel ? 'Type your message...' : 'Select a model to start chatting...'}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || !selectedModel}
        rows={1}
        aria-label="Chat message input"
      />
      
      <button
        className={styles.sendButton}
        onClick={handleSend}
        disabled={!message.trim() || disabled || !selectedModel}
        aria-label="Send message"
        type="button"
      >
        <PaperAirplaneIcon size={18} className={styles.sendIcon} />
      </button>
    </div>
  );
});

ChatInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  selectedModel: PropTypes.object,
  isStaticLayout: PropTypes.bool,
};

ChatInput.displayName = 'ChatInput';

export default ChatInput; 