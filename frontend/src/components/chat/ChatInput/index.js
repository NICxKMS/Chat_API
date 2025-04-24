import { useState, useRef, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { PlusIcon, PaperAirplaneIcon, XIcon, CheckIcon,  KebabHorizontalIcon, ImageIcon,  SearchIcon, LightBulbIcon } from '@primer/octicons-react';
import styles from './ChatInput.module.css';
import { useChat } from '../../../contexts/ChatContext';

/**
 * Reads a file and returns its base64 representation.
 * @param {File} file - The file to read.
 * @returns {Promise<string>} A promise resolving with the base64 data URL.
 */
const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Auto-resizing chat input component with image upload support
 * @param {Object} props - Component props
 * @param {Function} props.onSendMessage - Function to handle message sending
 * @param {Function} props.onNewChat - Function to trigger a new chat
 * @param {boolean} [props.disabled=false] - Whether the input is disabled
 * @param {Object} [props.selectedModel] - Currently selected model
 * @param {boolean} [props.isStaticLayout=false] - Flag indicating if the layout is static (empty chat)
 * @param {Object} [props.editingMessage=null] - Message being edited, or null if not in edit mode
 * @param {Function} [props.onCancelEdit] - Function to cancel edit mode
 * @param {boolean} [props.isStreaming=false] - Flag indicating if the input is in streaming mode
 * @param {Function} [props.toggleModelSelector] - Function to toggle model selector
 * @param {Function} [props.onFocus] - Function to call when input is focused
 * @returns {JSX.Element} - Rendered component
 */
const ChatInput = memo(({ 
  onSendMessage, 
  onNewChat, 
  disabled = false, 
  selectedModel, 
  isStaticLayout = false,
  editingMessage = null,
  onCancelEdit,
  isStreaming = false,
  toggleModelSelector,
  onFocus
}) => {
  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isEditing = !!editingMessage;
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const { isWaitingForResponse, stopGeneration } = useChat();
  
  // Set up window resize listener to detect mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Focus input on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
  // Set message content when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      // Extract text content based on message structure
      let textContent = '';
      if (typeof editingMessage.content === 'string') {
        textContent = editingMessage.content;
      } else if (Array.isArray(editingMessage.content)) {
        // Extract text from multimodal content
        const textPart = editingMessage.content.find(part => part.type === 'text');
        if (textPart) {
          textContent = textPart.text || '';
        }
      }
      
      setMessage(textContent);
      // Focus on textarea with slight delay to ensure it's rendered
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    }
  }, [editingMessage]);
  
  // Auto-resize the textarea as content changes
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get proper scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight (content height) + some padding
    const newHeight = Math.min(textarea.scrollHeight + 2, 200);
    textarea.style.height = `${newHeight}px`;

    // Update the parent container
    const inputContainer = textarea.closest('.inputContainer') || textarea.closest(`.${styles.inputContainer}`);
    if (inputContainer) {
      // The ResizeObserver in ChatContainer will detect this height change
      inputContainer.style.height = 'auto';
    }
  }, []);
  
  // Update height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);
  
  // Handle message change
  const handleChange = (e) => {
    setMessage(e.target.value);
  };
  
  // Handle keydown events (Enter without Shift to send, Escape to cancel edit)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Only process if there is text and not waiting for a response
      if (!isWaitingForResponse && (message.trim() || selectedImages.length > 0)) {
        if (!selectedModel && toggleModelSelector) {
          // If no model is selected, show the model selector
          toggleModelSelector();
        } else {
          handleSend();
        }
      }
      // No action for Enter key while waiting for response
    } else if (isEditing && e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };
  
  // Function to handle image selection
  const handleImageSelection = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // Limit the number of images (e.g., to 5)
    const MAX_IMAGES = 5;
    if (selectedImages.length + files.length > MAX_IMAGES) {
      alert(`You can upload a maximum of ${MAX_IMAGES} images.`);
      // Clear the file input value to allow re-selection of the same file if needed
      if (fileInputRef.current) {
         fileInputRef.current.value = "";
      }
      return;
    }

    try {
      const imagePromises = files.map(async (file) => {
        // Basic validation (type and size)
        if (!file.type.startsWith('image/')) {
            throw new Error(`File ${file.name} is not a valid image type.`);
        }
        const MAX_SIZE_MB = 5; // Example: 5MB limit per image
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
             throw new Error(`File ${file.name} exceeds the ${MAX_SIZE_MB}MB size limit.`);
        }

        const base64 = await readFileAsBase64(file);
        return { name: file.name, url: base64 }; // Store name and base64 URL
      });

      const newImages = await Promise.all(imagePromises);
      setSelectedImages((prevImages) => [...prevImages, ...newImages]);
    } catch (error) {
      console.error("Error processing images:", error);
      alert(`Error processing images: ${error.message}`);
    }

    // Clear the file input value to allow re-selection of the same file if needed
     if (fileInputRef.current) {
         fileInputRef.current.value = "";
     }
  };

  // Handle clipboard paste events for images
  const handlePaste = async (e) => {
    if (isEditing) return; // Don't handle paste in edit mode
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    // Find image items in the clipboard
    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    
    // Limit the number of images (e.g., to 5)
    const MAX_IMAGES = 5;
    if (selectedImages.length + imageItems.length > MAX_IMAGES) {
      alert(`You can upload a maximum of ${MAX_IMAGES} images.`);
      return;
    }
    
    try {
      const imagePromises = imageItems.map(async (item) => {
        const file = item.getAsFile();
        // Basic validation (size)
        const MAX_SIZE_MB = 5; // Example: 5MB limit per image
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          throw new Error(`Pasted image exceeds the ${MAX_SIZE_MB}MB size limit.`);
        }
        
        const base64 = await readFileAsBase64(file);
        return { name: 'pasted-image-' + Date.now(), url: base64 };
      });
      
      const newImages = await Promise.all(imagePromises);
      setSelectedImages((prevImages) => [...prevImages, ...newImages]);
      
      // If a paste event is detected and handled as an image, prevent the default behavior
      // to avoid also pasting the image as text
      if (newImages.length > 0) {
        e.preventDefault();
      }
    } catch (error) {
      console.error("Error processing pasted images:", error);
      alert(`Error processing pasted images: ${error.message}`);
    }
  };

  // Function to remove an image
  const removeImage = (indexToRemove) => {
    setSelectedImages((prevImages) => prevImages.filter((_, index) => index !== indexToRemove));
  };

  // Trigger hidden file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    if (onCancelEdit) {
      onCancelEdit();
    }
    setMessage('');
  };

  // Stop the response generation
  const handleStop = () => {
    stopGeneration();
  };

  // Send message and reset input
  const handleSend = () => {
    // Ensure there's either text or images to send, and not disabled
    const hasText = message.trim().length > 0;
    // In edit mode, we only support editing text, not adding images
    const hasImages = !isEditing && selectedImages.length > 0;
    
    // If no model is selected but there's something to send, show model selector
    if ((!hasText && !hasImages) || disabled) return;
    
    // If no model is selected, show model selector
    if (!selectedModel && toggleModelSelector) {
      toggleModelSelector();
      return;
    }

    // ALWAYS construct payload as an array of parts
    const contentPayload = [];

    if (hasText) {
      contentPayload.push({ type: 'text', text: message.trim() });
    }

    if (hasImages) {
      selectedImages.forEach(img => {
        contentPayload.push({ type: 'image_url', image_url: { url: img.url } });
      });
    }

    // Only call onSendMessage if payload is not empty
    if (contentPayload.length > 0) {
      // If editing, pass the editing message as the second parameter  
      onSendMessage(contentPayload, isEditing ? editingMessage : null);
    }

    // Reset state AFTER sending
    setMessage('');
    setSelectedImages([]);
    
    // Exit edit mode if we were editing
    if (isEditing && onCancelEdit) {
      onCancelEdit();
    }

    // Reset textarea height and focus
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };
  
  // Handle button click for send or stop
  const handleButtonClick = (e) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (isWaitingForResponse) {
      handleStop();
    } else if (!selectedModel && (message.trim() || selectedImages.length > 0)) {
      // If no model is selected but there's content to send, show model selector
      if (toggleModelSelector) {
        toggleModelSelector();
      }
    } else {
      handleSend();
    }
    
    // On mobile, blur the input to hide the keyboard after sending
    if (isMobile && textareaRef.current) {
      textareaRef.current.blur();
    }
  };
  
  // Determine placeholder text based on editing state
  const placeholderText = isEditing 
    ? 'Edit your message...' 
    : isWaitingForResponse
      ? 'Type your next message while waiting...'
      : 'Ask anything';
  
  // Focus textarea and handle keyboard detection
  useEffect(() => {
    // This effect is for mobile keyboard detection
    if (!isMobile) return;
    
    // Set up event listeners for detecting virtual keyboard
    const detectKeyboard = () => {
      // Consider keyboard open if window height significantly decreases
      const isKeyboard = window.innerHeight < window.outerHeight * 0.75;
      
      // Add a class to the body element when keyboard is open
      if (isKeyboard) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    };
    
    const handleFocus = () => {
      if (isMobile) {
        document.body.classList.add('keyboard-open');
        
        // On some devices, we need to detect keyboard using window resizing
        window.addEventListener('resize', detectKeyboard);
      }
      
      // Call onFocus prop if provided
      if (onFocus) {
        onFocus();
      }
    };
    
    const handleBlur = () => {
      if (isMobile) {
        document.body.classList.remove('keyboard-open');
        window.removeEventListener('resize', detectKeyboard);
      }
    };
    
    // Capture ref value in closure to avoid stale ref in cleanup function
    const textarea = textareaRef.current;
    
    if (textarea) {
      textarea.addEventListener('focus', handleFocus);
      textarea.addEventListener('blur', handleBlur);
    }
    
    return () => {
      if (textarea) {
        textarea.removeEventListener('focus', handleFocus);
        textarea.removeEventListener('blur', handleBlur);
      }
      window.removeEventListener('resize', detectKeyboard);
    };
  }, [isMobile, textareaRef, onFocus]);
  
  // Auto-focus textarea when component mounts or app state changes
  useEffect(() => {
    // Focus the textarea when the component mounts
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
  return (
    <>
      {/* Image Previews Container - Moved outside inputContainer */}
      {selectedImages.length > 0 && (
        <div className={styles.imagePreviewContainer}>
          {selectedImages.map((image, index) => (
            <div key={index} className={styles.imagePreviewWrapper}>
              <img 
                src={image.url} 
                alt={`preview ${index}`} 
                className={styles.imagePreview} 
              />
              <button 
                className={styles.removeImageButton} 
                onClick={() => removeImage(index)}
                aria-label={`Remove image ${index + 1}`}
                title={`Remove image ${index + 1}`}
              >
                <XIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`${styles.inputContainer} ${isEditing ? styles.editing : ''} ${isWaitingForResponse ? styles.waitingForResponse : ''} ${isMobile ? styles.mobileView : ''}`}>
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/jpeg, image/png, image/gif, image/webp"
          multiple
          onChange={handleImageSelection}
        />

        {/* Text input area with send button inside */}
        <div className={`${styles.inputWrapper} ${!selectedModel ? styles.noModelSelected : ''}`}>
          <textarea
            ref={textareaRef}
            className={styles.chatInput}
            placeholder={placeholderText}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            rows={1}
            aria-label="Chat message input"
          />
          
          {/* Send/Stop button positioned inside the textarea */}
          <button
            className={`${styles.sendButtonInline} ${isWaitingForResponse ? styles.stopButton : ''} ${!selectedModel ? styles.noModelSelected : ''}`}
            onClick={handleButtonClick}
            disabled={(!isWaitingForResponse && ((!message.trim() && selectedImages.length === 0) || disabled))}
            aria-label={isWaitingForResponse ? "Stop generation" : !selectedModel ? "Select model" : isEditing ? "Save edit" : "Send message"}
            title={isWaitingForResponse ? "Stop generation" : !selectedModel ? "Select a model" : isEditing ? "Save edit (Enter)" : "Send message (Enter)"}
            type="button"
          >
            {isWaitingForResponse ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            ) : !selectedModel ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="2" height="2" fill="currentColor" />
                <rect x="7" y="3" width="2" height="2" fill="currentColor" />
                <rect x="11" y="3" width="2" height="2" fill="currentColor" />
                <rect x="3" y="7" width="2" height="2" fill="currentColor" />
                <rect x="7" y="7" width="2" height="2" fill="currentColor" />
                <rect x="11" y="7" width="2" height="2" fill="currentColor" />
                <rect x="3" y="11" width="2" height="2" fill="currentColor" />
                <rect x="7" y="11" width="2" height="2" fill="currentColor" />
                <rect x="11" y="11" width="2" height="2" fill="currentColor" />
              </svg>
            ) : isEditing ? (
              <CheckIcon size={21} />
            ) : (
              <PaperAirplaneIcon size={21} />
            )}
          </button>
        </div>
        
        {/* Buttons in a single row */}
        <div className={styles.actionRow}>
          {/* Left side buttons */}
          <div className={styles.leftButtons}>
            {/* Upload button (Only when not editing) - moved to left side */}
            {!isEditing && (
              <button
                className={styles.uploadButton}
                onClick={toggleModelSelector ? (selectedModel ? triggerFileInput : toggleModelSelector) : triggerFileInput}
                disabled={disabled}
                aria-label={selectedModel?.capabilities?.includes('vision') ? "Upload images" : "Select model for image upload"}
                title={selectedModel?.capabilities?.includes('vision') ? "Upload images" : "Select model for image upload"}
                type="button"
              >
                <ImageIcon size={16} />
              </button>
            )}
            
            <button
              className={`${styles.textButton} ${isMobile ? styles.iconOnlyButton : ''}`}
              aria-label="Search"
              title="Search"
              type="button"
            >
              <SearchIcon size={16} />
              {!isMobile && <span className={styles.buttonText}>Search</span>}
            </button>
            
            <button
              className={`${styles.textButton} ${isMobile ? styles.iconOnlyButton : ''}`}
              aria-label="Reason mode"
              title="Reason mode"
              type="button"
            >
              <LightBulbIcon size={16} />
              {!isMobile && <span className={styles.buttonText}>Reason</span>}
            </button>
            
            <button
              className={styles.actionButton}
              aria-label="More options"
              title="More options"
              type="button"
            >
              <KebabHorizontalIcon size={16} />
            </button>
          </div>
          
          {/* Right side buttons */}
          <div className={styles.rightButtons}>
            {/* New chat button - moved to right side */}
            <button 
              className={styles.actionButton}
              onClick={onNewChat}
              aria-label="New chat"
              title="New chat"
              type="button"
            >
              <PlusIcon size={16} />
            </button>
            
            {/* Cancel edit button (Only when editing) */}
            {isEditing && (
              <button
                className={styles.uploadButton}
                onClick={handleCancelEdit}
                aria-label="Cancel edit"
                title="Cancel edit (Esc)"
                type="button"
              >
                <XIcon size={16} />
              </button>
            )}
            
            {/* AI model button */}
            <button
              className={styles.modelButton}
              onClick={toggleModelSelector}
              aria-label="Select AI model"
              title="Select AI model"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="2" height="2" fill="currentColor" />
                <rect x="7" y="3" width="2" height="2" fill="currentColor" />
                <rect x="11" y="3" width="2" height="2" fill="currentColor" />
                <rect x="3" y="7" width="2" height="2" fill="currentColor" />
                <rect x="7" y="7" width="2" height="2" fill="currentColor" />
                <rect x="11" y="7" width="2" height="2" fill="currentColor" />
                <rect x="3" y="11" width="2" height="2" fill="currentColor" />
                <rect x="7" y="11" width="2" height="2" fill="currentColor" />
                <rect x="11" y="11" width="2" height="2" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
});

// PropTypes for documentation and type checking
ChatInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  selectedModel: PropTypes.object,
  isStaticLayout: PropTypes.bool,
  editingMessage: PropTypes.object,
  onCancelEdit: PropTypes.func,
  isStreaming: PropTypes.bool,
  toggleModelSelector: PropTypes.func,
  onFocus: PropTypes.func
};

export default ChatInput; 