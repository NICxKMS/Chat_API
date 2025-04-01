import React, { forwardRef, useEffect, useState, useRef, useMemo } from 'react';
import { FixedSizeList as List, VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import ChatMessage from '../ChatMessage';
import TypingIndicator from '../../common/TypingIndicator';
import styles from './MessageList.module.css';

/**
 * Virtualized list of chat messages with optimized rendering
 * @param {Object} props - Component props
 * @param {Array} props.messages - Array of message objects
 * @param {string} props.streamContent - Current content being streamed
 * @param {boolean} props.isStreaming - Whether streaming is in progress
 * @param {string} props.error - Error message to display
 * @returns {JSX.Element} - Rendered component
 */
const MessageList = forwardRef(({ messages, streamContent, isStreaming, error }, ref) => {
  // Track whether we should auto-scroll to bottom
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const listRef = useRef(null);
  const outerListRef = useRef(null);
  
  // Combine regular messages with streaming content (if any)
  const displayMessages = useMemo(() => {
    const result = [...messages];
    
    // If we have streaming content, add it as a temporary AI message
    if (isStreaming && streamContent) {
      result.push({
        role: 'assistant',
        content: streamContent,
        isStreaming: true
      });
    }
    
    // Add error message if any
    if (error) {
      result.push({
        role: 'error',
        content: error,
        timestamp: Date.now()
      });
    }
    
    return result;
  }, [messages, streamContent, isStreaming, error]);
  
  // Add System welcome message if no messages
  const finalMessages = useMemo(() => {
    if (displayMessages.length === 0) {
      return [{
        role: 'system',
        content: 'Welcome to AI Chat! Select a model from the sidebar and start chatting.',
        timestamp: Date.now()
      }];
    }
    return displayMessages;
  }, [displayMessages]);
  
  // Set ref to the current list instance
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(listRef.current);
      } else {
        ref.current = listRef.current;
      }
    }
  }, [ref]);
  
  // When messages change, scroll to bottom if shouldAutoScroll is true
  useEffect(() => {
    if (shouldAutoScroll && outerListRef.current) {
      const { scrollHeight, clientHeight } = outerListRef.current;
      outerListRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [finalMessages, shouldAutoScroll, streamContent]);
  
  // Handle scroll events to determine if we should auto-scroll
  const handleScroll = ({ scrollOffset, scrollUpdateWasRequested }) => {
    if (!scrollUpdateWasRequested && outerListRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = outerListRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };
  
  // Render each row (message)
  const renderRow = ({ index, style }) => {
    const message = finalMessages[index];
    return (
      <div style={style} className={styles.messageRow}>
        <ChatMessage
          role={message.role}
          content={message.content}
          isStreaming={message.isStreaming}
        />
      </div>
    );
  };

  // Estimate message height based on content
  const getItemHeight = (index) => {
    const message = finalMessages[index];
    const contentLength = message?.content?.length || 0;
    return Math.max(70, Math.min(500, 70 + contentLength / 5));
  };
  
  return (
    <div className={styles.messageListContainer}>
      {/* Virtualized message list */}
      <AutoSizer>
        {({ height, width }) => (
          <VariableSizeList
            ref={listRef}
            outerRef={outerListRef}
            height={height}
            width={width}
            itemCount={finalMessages.length}
            itemSize={getItemHeight}
            onScroll={handleScroll}
            overscanCount={3}
          >
            {renderRow}
          </VariableSizeList>
        )}
      </AutoSizer>
      
      {/* Typing indicator shown during streaming */}
      {isStreaming && !streamContent && (
        <div className={styles.typingIndicatorContainer}>
          <TypingIndicator />
        </div>
      )}
      
      {/* Scroll to bottom button */}
      {!shouldAutoScroll && (
        <button
          className={styles.scrollToBottomButton}
          onClick={() => {
            setShouldAutoScroll(true);
            if (outerListRef.current) {
              const { scrollHeight, clientHeight } = outerListRef.current;
              outerListRef.current.scrollTop = scrollHeight - clientHeight;
            }
          }}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <ArrowDownIcon className={styles.scrollIcon} />
        </button>
      )}
    </div>
  );
});

// SVG Arrow Down icon
const ArrowDownIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

// Display name for debugging
MessageList.displayName = 'MessageList';

export default MessageList; 