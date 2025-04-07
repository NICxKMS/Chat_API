import React, { forwardRef, useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import ChatMessage from '../ChatMessage';
import styles from './MessageList.module.css';
import { ArrowDownIcon } from '@primer/octicons-react';
import { useChat } from '../../../contexts/ChatContext';

// Helper component to render and measure each row
const Row = memo(({ data, index, style }) => {
  const { finalMessages, setSize, width, isWaitingForResponse } = data;
  const rowRef = useRef(null);

  useEffect(() => {
    if (!rowRef.current) return; // Ensure ref is available

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const newHeight = entry.borderBoxSize[0].blockSize;
        // Use requestAnimationFrame to avoid ResizeObserver loop limit errors
        requestAnimationFrame(() => {
           setSize(index, newHeight);
        });
      }
    });

    observer.observe(rowRef.current);

    return () => observer.disconnect();
    // Adding width to dependencies ensures observer restarts if width changes,
    // which might affect text wrapping.
  }, [index, setSize, width]);

  const message = finalMessages[index];
  
  // Safety check to prevent errors with undefined messages
  if (!message) {
    console.warn(`Message at index ${index} is undefined`);
    return null;
  }
  
  // Determine if this message is currently streaming based on:
  // 1. Is it an assistant message
  // 2. Is it the last message
  // 3. Is the app currently waiting for response
  const isLastMessage = index === finalMessages.length - 1;
  const isStreaming = message.role === 'assistant' && 
                      isLastMessage && 
                      isWaitingForResponse;

  // Separate height from other styles provided by react-window
  const { height, ...restStyle } = style;

  return (
    // Apply position/width styles, but NOT the height from react-window
    <div style={restStyle} className={styles.messageRow} ref={rowRef}>
      <ChatMessage
        message={message}
        isStreaming={isStreaming}
      />
    </div>
  );
});
Row.displayName = 'MessageListRow';

/**
 * Virtualized list of chat messages with optimized rendering
 * @param {Object} props - Component props
 * @param {Array} props.messages - Array of message objects
 * @param {string} props.error - Error message to display
 * @returns {JSX.Element} - Rendered component
 */
const MessageList = forwardRef(({ messages, error }, ref) => {
  const { isWaitingForResponse } = useChat();
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const listRef = useRef(null);
  const outerListRef = useRef(null);
  const sizeMap = useRef({}); // To store measured heights
  const [listWidth, setListWidth] = useState(0); // Track width for observer re-run

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
  
  // Function for Row component to report its size
  const setSize = useCallback((index, height) => {
    const currentHeight = sizeMap.current[index];
    // Only update and reset if the height is different and listRef is available
    // Add a small tolerance (e.g., 1px) to prevent infinite loops from fractional pixel changes
    if (listRef.current && (!currentHeight || Math.abs(currentHeight - height) > 1)) {
      sizeMap.current = { ...sizeMap.current, [index]: height };
      // Recompute row heights and positions below the updated row
      listRef.current.resetAfterIndex(index);
    }
  }, []); // Empty dependency array - function doesn't change

  // Updated getItemHeight to use measured sizes
  const getItemHeight = useCallback((index) => {
    // Return measured height or a default estimate
    return sizeMap.current[index] || 70; // 70 is an arbitrary initial estimate
  }, []); // Empty dependency array
  
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
  }, [finalMessages, shouldAutoScroll]);
  
  // Handle scroll events to determine if we should auto-scroll
  const handleScroll = ({ scrollOffset, scrollUpdateWasRequested }) => {
    if (!scrollUpdateWasRequested && outerListRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = outerListRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };
  
  // Prepare data for Row component
  const itemData = useMemo(() => ({
    finalMessages,
    setSize,
    width: listWidth, // Pass width to Row
    isWaitingForResponse // Pass waiting state for streaming detection
  }), [finalMessages, setSize, listWidth, isWaitingForResponse]);

  return (
    <div 
      className={styles.messageListContainer} 
      aria-live="polite"
      aria-relevant="additions text"
    >
      {/* Virtualized message list */}
      <AutoSizer>
        {({ height, width }) => {
          // Update listWidth state when AutoSizer provides it
          // Use timeout to avoid state update during render
          if (width > 0 && width !== listWidth) {
             setTimeout(() => setListWidth(width), 0);
          }
          return (
            <VariableSizeList
              ref={listRef}
              outerRef={outerListRef}
              height={height}
              width={width}
              itemCount={finalMessages.length}
              itemSize={getItemHeight} // Use the updated function
              itemData={itemData} // Pass data to Row component
              onScroll={handleScroll}
              overscanCount={3}
              aria-label="Chat messages"
              children={Row} /* Pass Row component directly */
            />
          );
        }}
      </AutoSizer>
      
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
          <ArrowDownIcon size={16} className={styles.scrollIcon} />
        </button>
      )}
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList; 