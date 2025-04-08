import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { PaperAirplaneIcon, PlusIcon, XIcon } from '@primer/octicons-react';
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
 * @returns {JSX.Element} - Rendered component
 */
const ChatInput = memo(({ onSendMessage, onNewChat, disabled = false, selectedModel, isStaticLayout = false }) => {
  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState([]); // State for selected image base64 URLs and names
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null); // Ref for the hidden file input
  
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

  // Send message and reset input
  const handleSend = () => {
    // Ensure there's either text or images to send, and not disabled
    const hasText = message.trim().length > 0;
    const hasImages = selectedImages.length > 0;
    if ((!hasText && !hasImages) || disabled || !selectedModel) return;

    // ALWAYS construct payload as an array of parts
    const contentPayload = [];

    if (hasText) {
      contentPayload.push({ type: 'text', text: message.trim() });
    }

    if (hasImages) {
      selectedImages.forEach(img => {
        // Ensure the image part structure is consistent if needed by the backend/parent
        contentPayload.push({ type: 'image_url', image_url: { url: img.url } });
      });
    }

    // Only call onSendMessage if payload is not empty
    if (contentPayload.length > 0) {
       onSendMessage(contentPayload);
    }

    setMessage('');
    setSelectedImages([]); // Clear selected images

    // Reset textarea height and focus
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
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
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/jpeg, image/png, image/gif, image/webp" // Specify accepted image types
        multiple // Allow multiple files
        onChange={handleImageSelection}
      />

       {/* Image upload button */}
      <button
        className={`${styles.actionButton} ${styles.uploadButton}`}
        onClick={triggerFileInput}
        disabled={disabled || !selectedModel?.capabilities?.includes('vision')}
        aria-label="Upload images"
        title={selectedModel?.capabilities?.includes('vision') ? "Upload images" : "Selected model does not support images"}
        type="button"
      >
         <PlusIcon size={18} /> {/* Or use a dedicated image/upload icon */}
      </button>

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
        disabled={(!message.trim() && selectedImages.length === 0) || disabled || !selectedModel}
        aria-label="Send message"
        type="button"
      >
        <PaperAirplaneIcon size={18} className={styles.sendIcon} />
      </button>

       {/* Image Preview Area */}
      {selectedImages.length > 0 && (
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
};

ChatInput.displayName = 'ChatInput';

export default ChatInput; 