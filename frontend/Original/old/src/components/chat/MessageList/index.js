import { forwardRef, useState, useMemo, memo } from 'react';
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

  // Process message content to extract images and text in a single pass
  const processMessageContent = (content) => {
    if (!content) return { images: [], text: content };

    if (Array.isArray(content)) {
      const images = [];
      const texts = [];

      content.forEach(part => {
        if (part.type === 'image_url') {
          images.push({
            url: part.image_url.url,
            alt: part.image_url.alt || part.alt || null // Support both image_url.alt and top-level alt
          });
        }
        if (part.type === 'text') {
          texts.push(part.text);
        }
      });

      return { 
        images, 
        text: texts.join(' ') 
      };
    }

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
                              isWaitingForResponse &&
                              !message.metrics?.isComplete;
          
          // Process message content for images and text
          const { images, text } = processMessageContent(message.content);
          
          // Generate a unique key using timestamp if available, fallback to role-index
          const messageKey = message.timestamp 
            ? `${message.role}-${message.timestamp}-${index}`
            : `${message.role}-${index}`;
          
          return (
            <div key={messageKey} className={styles.messageRow}>
              {/* Render images first if it's a user message with images */}
              {message.role === 'user' && images.length > 0 && (
                <div className={styles.imageContainer}>
                  {images.map((image, imgIndex) => (
                    <img 
                      key={`${messageKey}-img-${imgIndex}`}
                      src={image.url}
                      alt={image.alt || `Uploaded image ${imgIndex + 1}`}
                      className={styles.messageImage}
                      onClick={() => handleImageClick(image.url)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </div>
              )}
              {/* Render ChatMessage if there's text content or it's not a user message */}
              {(text || message.role !== 'user') && (
                <ChatMessage
                  message={{ ...message, content: text || message.content }}
                  isStreaming={isStreaming}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Render the overlay component */}
      <ImageOverlay src={overlayImageSrc} onClose={handleCloseOverlay} />
    </>
  );
});

MessageList.displayName = 'MessageList';

export default memo(MessageList); 