import { forwardRef, useState, useMemo, memo, useEffect } from 'react';
import styles from './MessageList.module.css';
import { useChatState } from '../../../contexts/ChatStateContext';
import ChatMessage from '../ChatMessage';
import ImageOverlay from '../../common/ImageOverlay';
import PropTypes from 'prop-types';
import { processMessageContent } from '../../../utils/messageHelpers';

/**
 * Simple message list without virtualization
 * @param {Object} props - Component props
 * @param {Array} props.messages - Array of message objects
 * @param {string} props.error - Error message to display
 * @param {Function} props.onEditMessage - Function to handle message edit requests
 * @returns {JSX.Element} - Rendered component
 */
const MessageList = forwardRef(({ messages, error, onEditMessage }, ref) => {
  const { isWaitingForResponse } = useChatState();
  // Local state for dynamic auth values
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [idToken, setIdToken] = useState(() => localStorage.getItem('idToken'));

  const [overlayImageSrc, setOverlayImageSrc] = useState(null);

  // Dynamically import Firebase auth only if a token is already cached
  useEffect(() => {
    if (!idToken) return;
    let unsubscribe;
    (async () => {
      const { getFirebaseAuth } = await import('../../../firebaseConfig');
      const { onAuthStateChanged } = await import('firebase/auth');
      const auth = getFirebaseAuth();
      if (!auth) return;
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setAvatarUrl(user.photoURL || null);
          try {
            const token = await user.getIdToken();
            setIdToken(token);
          } catch {
            setIdToken(null);
          }
        } else {
          setAvatarUrl(null);
          setIdToken(null);
        }
      });
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [idToken]);

  // Combine regular messages with error content (if any)
  const finalMessages = useMemo(() => {
    const result = [...messages];
    
    // Add error message if any
    if (error) {
      const errorTimestamp = Date.now();
      result.push({
        id: errorTimestamp,
        role: 'error',
        content: error,
        timestamp: errorTimestamp
      });
    }
    
    return result;
  }, [messages, error]);

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
        className={styles.MessageList} 
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
            <div key={messageKey} className={styles.MessageList__messageRow}>
              {/* Render images first if it's a user message with images */}
              {message.role === 'user' && images.length > 0 && (
                <div className={styles.MessageList__imageContainer}>
                  {images.map((image, imgIndex) => (
                    <img 
                      key={`${messageKey}-img-${imgIndex}`}
                      src={image.url}
                      alt={image.alt || `Uploaded image ${imgIndex + 1}`}
                      className={`${styles.MessageList__messageImage} ${styles.MessageList__clickableImage}`}
                      onClick={() => handleImageClick(image.url)}
                    />
                  ))}
                </div>
              )}
              {/* Render ChatMessage if there's text content or it's not a user message */}
              {(text || message.role !== 'user') && (
                <ChatMessage
                  message={message}
                  overrideContent={text || undefined}
                  isStreaming={isStreaming}
                  onEditMessage={message.role === 'user' ? onEditMessage : undefined}
                  avatarUrl={message.role === 'user' && idToken ? avatarUrl : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Render the overlay component */}
      {overlayImageSrc && (
        <ImageOverlay
          src={overlayImageSrc}
          alt="Image preview"
          onClose={handleCloseOverlay}
        />
      )}
    </>
  );
});

MessageList.displayName = 'MessageList';

MessageList.propTypes = {
  messages: PropTypes.array.isRequired,
  error: PropTypes.string,
  onEditMessage: PropTypes.func
};

export default memo(MessageList); 