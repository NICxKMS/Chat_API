import React, { forwardRef, useEffect, useState, useRef, useMemo, memo } from 'react';
import ChatMessage from '../ChatMessage';
import styles from './MessageList.module.css';
import { useChat } from '../../../contexts/ChatContext';

/**
 * Simple message list without virtualization
 * @param {Object} props - Component props
 * @param {Array} props.messages - Array of message objects
 * @param {string} props.error - Error message to display
 * @returns {JSX.Element} - Rendered component
 */
const MessageList = forwardRef(({ messages, error }, ref) => {
  const { isWaitingForResponse } = useChat();

  // Combine regular messages with error content (if any)
  const finalMessages = useMemo(() => {
    const result = [...messages];
    
    // Add error message if any
    if (error) {
      result.push({
        role: 'error',
        content: error,
        timestamp: Date.now()
      });
    }
    
    return result;
  }, [messages, error]);

  return (
    <div 
      className={styles.messageListContainer} 
      ref={ref}
      aria-live="polite"
      aria-relevant="additions text"
    >
      {finalMessages.map((message, index) => {
        // Determine if this message is currently streaming
        const isLastMessage = index === finalMessages.length - 1;
        const isStreaming = message.role === 'assistant' && 
                            isLastMessage && 
                            isWaitingForResponse;
        
        return (
          <div key={`${message.role}-${index}`} className={styles.messageRow}>
            <ChatMessage
              message={message}
              isStreaming={isStreaming}
            />
          </div>
        );
      })}
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default memo(MessageList); 