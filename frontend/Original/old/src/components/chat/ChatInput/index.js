import { useState, useRef, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { PlusIcon, PaperAirplaneIcon, XIcon, CheckIcon, GlobeIcon, KebabHorizontalIcon, ImageIcon } from '@primer/octicons-react';
import styles from './ChatInput.module.css';

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
  isStreaming = false
}) => {
  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isEditing = !!editingMessage;
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  
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
      handleSend();
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

  // Send message and reset input
  const handleSend = () => {
    // Ensure there's either text or images to send, and not disabled
    const hasText = message.trim().length > 0;
    // In edit mode, we only support editing text, not adding images
    const hasImages = !isEditing && selectedImages.length > 0;
    if ((!hasText && !hasImages) || disabled || !selectedModel) return;

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
  
  // Determine placeholder text based on editing state
  const placeholderText = isEditing 
    ? 'Edit your message...' 
    : 'Ask anything';
  
  return (
    <div className={`${styles.inputContainer} ${isEditing ? styles.editing : ''}`}>
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
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.chatInput}
          placeholder={placeholderText}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || !selectedModel}
          rows={1}
          aria-label="Chat message input"
        />
        
        {/* Send button positioned inside the textarea */}
        <button
          className={styles.sendButtonInline}
          onClick={handleSend}
          disabled={(!message.trim() && selectedImages.length === 0) || disabled || !selectedModel}
          aria-label={isEditing ? "Save edit" : "Send message"}
          title={isEditing ? "Save edit (Enter)" : "Send message (Enter)"}
          type="button"
        >
          {isEditing ? 
            <CheckIcon size={21} /> : 
            <PaperAirplaneIcon size={21} />
          }
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
              onClick={triggerFileInput}
              disabled={disabled || !selectedModel?.capabilities?.includes('vision')}
              aria-label="Upload images"
              title={selectedModel?.capabilities?.includes('vision') ? "Upload images" : "Model doesn't support images"}
              type="button"
            >
              <ImageIcon size={16} />
            </button>
          )}
          
          <button
            className={styles.actionButton}
            aria-label="Search"
            title="Search"
            type="button"
          >
            <GlobeIcon size={16} />
          </button>
          
          <button
            className={`${styles.textButton} ${isMobile ? styles.iconOnlyButton : ''}`}
            aria-label="Reason mode"
            title="Reason mode"
            type="button"
          >
            {isMobile ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1C4.13438 1 1 4.13438 1 8C1 11.8656 4.13438 15 8 15C11.8656 15 15 11.8656 15 8C15 4.13438 11.8656 1 8 1ZM8.5 12.5H7.5V11.5H8.5V12.5ZM9.76562 8.14062L9.18125 8.74375C8.69687 9.2375 8.5 9.625 8.5 10.5H7.5V10.25C7.5 9.5875 7.69687 9 8.18125 8.50625L8.97188 7.68438C9.22188 7.44375 9.375 7.1125 9.375 6.75C9.375 6.0375 8.8125 5.475 8.1 5.475C7.3875 5.475 6.825 6.0375 6.825 6.75H5.825C5.825 5.48438 6.84688 4.475 8.1 4.475C9.35312 4.475 10.375 5.48438 10.375 6.75C10.375 7.29375 10.1438 7.79688 9.76562 8.14062Z" fill="currentColor" />
              </svg>
            ) : (
              "Reason"
            )}
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

      {/* Image Preview Area - hide when editing */}
      {!isEditing && selectedImages.length > 0 && (
        <div className={styles.imagePreviewContainer}>
          {selectedImages.map((image, index) => (
            <div key={index} className={styles.imagePreviewItem}>
              <img src={image.url} alt={`Preview ${image.name}`} className={styles.imagePreviewThumbnail} />
              <button
                className={styles.removeImageButton}
                onClick={() => removeImage(index)}
                aria-label={`Remove ${image.name}`}
                title={`Remove ${image.name}`}
                type="button"
              >
                <XIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ChatInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  selectedModel: PropTypes.object,
  isStaticLayout: PropTypes.bool,
  editingMessage: PropTypes.object,
  onCancelEdit: PropTypes.func,
  isStreaming: PropTypes.bool
};

ChatInput.displayName = 'ChatInput';

export default ChatInput; 