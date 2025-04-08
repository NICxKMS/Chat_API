import React, { forwardRef, useEffect, useState, useRef, useMemo, memo } from 'react';
import ChatMessage from '../ChatMessage';
import ImageOverlay from '../../common/ImageOverlay';
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
  const [overlayImageSrc, setOverlayImageSrc] = useState(null);

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

  // Process message content to extract images and text
  const processMessageContent = (content) => {
    if (!content) return { images: [], text: content };
    
    // Handle array content (for messages with images)
    if (Array.isArray(content)) {
      const images = content
        .filter(part => part.type === 'image_url')
        .map(part => part.image_url.url);
      const text = content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(' ');
      return { images, text };
    }
    
    // Handle string content (regular text message)
    return { images: [], text: content };
  };

  // Handlers for overlay
  const handleImageClick = (src) => {
    setOverlayImageSrc(src);
  };

  const handleCloseOverlay = () => {
    setOverlayImageSrc(null);
  };

  return (
    <>
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
          
          // Process message content for images
          const { images } = processMessageContent(message.content);
          
          return (
            <div key={`${message.role}-${index}`} className={styles.messageRow}>
              {/* Render images first if it's a user message with images */}
              {message.role === 'user' && images.length > 0 && (
                <div className={styles.imageContainer}>
                  {images.map((imageUrl, imgIndex) => (
                    <img 
                      key={imgIndex}
                      src={imageUrl}
                      alt={`Uploaded image ${imgIndex + 1}`}
                      className={styles.messageImage}
                      onClick={() => handleImageClick(imageUrl)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </div>
              )}
              <ChatMessage
                message={message}
                isStreaming={isStreaming}
              />
            </div>
          );
        })}
      </div>
      
      <ImageOverlay src={overlayImageSrc} onClose={handleCloseOverlay} />
    </>
  );
});

MessageList.displayName = 'MessageList';

export default memo(MessageList); 