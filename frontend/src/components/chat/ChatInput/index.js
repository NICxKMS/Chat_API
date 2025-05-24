import { useState, useRef, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatInput.module.css';
import { useChatState } from '../../../contexts/ChatStateContext';
import { useChatControl } from '../../../contexts/ChatControlContext';

// Import sub-components
import ImagePreviewList from './subcomponents/ImagePreviewList';
import ChatInputTextArea from './subcomponents/ChatInputTextArea';
import ChatInputActionRow from './subcomponents/ChatInputActionRow';

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
 * Auto-resizing chat input component (Refactored)
 */
const ChatInput = memo(({ 
  disabled = false, 
  selectedModel = null, 
  isStaticLayout = false,
  editingMessage = null,
  onCancelEdit = () => {},
  isStreaming = false,
  toggleModelSelector = () => {},
  onFocus = () => {},
  isInitialChat = false,
  onSendMessage,
}) => {
  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isEditing = !!editingMessage;
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const { isWaitingForResponse } = useChatState();
  const { stopGeneration, newChat } = useChatControl();
  const [inputError, setInputError] = useState(null);
  const errorTimeoutRef = useRef(null); // Ref to manage error timeout
  
  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);
  
  // Set message/images when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      let textContent = '';
      const images = [];
      if (typeof editingMessage.content === 'string') {
        textContent = editingMessage.content;
      } else if (Array.isArray(editingMessage.content)) {
        editingMessage.content.forEach(part => {
          if (part.type === 'text') textContent += part.text || '';
          if (part.type === 'image_url' && part.image_url?.url) {
            images.push({ name: '', url: part.image_url.url });
          }
        });
      }
      setMessage(textContent);
      setSelectedImages(images);
      setTimeout(() => textareaRef.current?.focus(), 0);
    } else {
      // Clear state if exiting edit mode (e.g., via prop change)
      setMessage('');
      setSelectedImages([]);
    }
  }, [editingMessage]);
  
  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight + 2, 200);
    textarea.style.height = `${newHeight}px`;
    const inputContainer = textarea.closest(`.${styles.ChatInput}`);
    if (inputContainer) {
      inputContainer.style.setProperty('--textarea-height', `${newHeight}px`); // Use CSS var
    }
  }, []);
  
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  // Mobile keyboard detection (Keep this logic here as it affects body class)
  useEffect(() => {
    if (!isMobile) return;
    const detectKeyboard = () => {
      const isKeyboard = window.innerHeight < window.outerHeight * 0.75;
      document.body.classList.toggle('keyboard-open', isKeyboard);
    };
    const handleFocus = () => {
      if (isMobile) {
        document.body.classList.add('keyboard-open');
        window.addEventListener('resize', detectKeyboard);
      }
      if (onFocus) onFocus();
    };
    const handleBlur = () => {
      if (isMobile) {
        document.body.classList.remove('keyboard-open');
        window.removeEventListener('resize', detectKeyboard);
      }
    };
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
      document.body.classList.remove('keyboard-open'); // Cleanup on unmount
    };
  }, [isMobile, onFocus]);

  // Helper to show error message temporarily
  const showError = useCallback((message) => {
    setInputError(message);
    // Clear previous timeout if any
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    // Set new timeout to clear error
    errorTimeoutRef.current = setTimeout(() => {
      setInputError(null);
      errorTimeoutRef.current = null;
    }, 3000); // Show error for 3 seconds
  }, []);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Event Handlers
  
  const handleChange = useCallback((e) => {
    setMessage(e.target.value);
  }, []);

  const prepareAndSendMessage = useCallback(() => {
    const hasText = message.trim().length > 0;
    const hasImages = selectedImages.length > 0;
    if ((!hasText && !hasImages) || disabled) return;

    if (!selectedModel && toggleModelSelector) {
      toggleModelSelector();
      return;
    }

    const contentPayload = [];
    if (hasText) contentPayload.push({ type: 'text', text: message.trim() });
    if (hasImages) selectedImages.forEach(img => contentPayload.push({ type: 'image_url', image_url: { url: img.url } }));

    if (contentPayload.length > 0) {
      onSendMessage(contentPayload, isEditing ? editingMessage : null);
    }

    setMessage('');
    setSelectedImages([]);
    if (isEditing && onCancelEdit) onCancelEdit();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height immediately
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [message, selectedImages, disabled, selectedModel, toggleModelSelector, onSendMessage, isEditing, editingMessage, onCancelEdit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isWaitingForResponse) prepareAndSendMessage(); // Call renamed handler
    } else if (isEditing && e.key === 'Escape') {
      e.preventDefault();
      if (onCancelEdit) onCancelEdit(); // Use onCancelEdit prop
      setMessage(''); // Also clear message state
      setSelectedImages([]);
    }
  }, [isWaitingForResponse, prepareAndSendMessage, isEditing, onCancelEdit]);

  const handleImageSelection = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    const MAX_IMAGES = 5;
    if (selectedImages.length + files.length > MAX_IMAGES) {
      showError(`Max ${MAX_IMAGES} images allowed.`); // Use showError
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      const imagePromises = files.map(async (file) => {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} invalid type.`);
        const MAX_SIZE_MB = 5;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`${file.name} > ${MAX_SIZE_MB}MB.`);
        const base64 = await readFileAsBase64(file);
        return { name: file.name, url: base64 };
      });
      const newImages = await Promise.all(imagePromises);
      setSelectedImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      console.error("Image processing error:", error);
      showError(`Image error: ${error.message}`); // Use showError
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedImages.length, showError]);

  const handlePaste = useCallback(async (e) => {
    if (isEditing) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    const MAX_IMAGES = 5;
    if (selectedImages.length + imageItems.length > MAX_IMAGES) {
      showError(`Max ${MAX_IMAGES} images allowed.`); // Use showError
      return;
    }
    try {
      const imagePromises = imageItems.map(async (item) => {
        const file = item.getAsFile();
        const MAX_SIZE_MB = 5;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Pasted image > ${MAX_SIZE_MB}MB.`);
        const base64 = await readFileAsBase64(file);
        return { name: 'pasted-' + Date.now(), url: base64 };
      });
      const newImages = await Promise.all(imagePromises);
      if (newImages.length > 0) {
         setSelectedImages((prev) => [...prev, ...newImages]);
         e.preventDefault(); // Prevent pasting as text
      }
    } catch (error) {
      console.error("Paste processing error:", error);
      showError(`Paste error: ${error.message}`); // Use showError
    }
  }, [isEditing, selectedImages.length, showError]);

  const removeImage = useCallback((indexToRemove) => {
    setSelectedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  }, []);

  const triggerFileInput = useCallback(() => {
    // Logic for triggering file input based on model selection
    if (!selectedModel && toggleModelSelector) {
      toggleModelSelector();
    } else if (selectedModel?.capabilities?.includes('vision')) {
       fileInputRef.current?.click();
    } else {
      showError('Select a model with vision capabilities to upload images.'); // Use showError
    }
  }, [selectedModel, toggleModelSelector, showError]);

  const handleCancelEdit = useCallback(() => {
    if (onCancelEdit) onCancelEdit();
    setMessage('');
    setSelectedImages([]);
  }, [onCancelEdit]);

  const handleStop = useCallback(() => {
    stopGeneration();
  }, [stopGeneration]);

  // Wrapper for the inline send/stop button click
  const handleInlineSendClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWaitingForResponse) {
      handleStop();
    } else {
      prepareAndSendMessage(); // Call renamed handler
    }
    if (isMobile && textareaRef.current) textareaRef.current.blur();
  }, [isWaitingForResponse, handleStop, prepareAndSendMessage, isMobile]);

  // Render Logic
  
  const placeholderText = isEditing 
    ? 'Edit your message...' 
    : isWaitingForResponse
      ? 'Type your next message while waiting...'
      : 'Ask anything';

  return (
    <>
      {/* Image Previews */} 
      <ImagePreviewList images={selectedImages} onRemoveImage={removeImage} />

      <div className={[
          styles.ChatInput, 
          isEditing ? styles['ChatInput--editing'] : '', 
          isWaitingForResponse ? styles['ChatInput--waitingForResponse'] : '', 
          isMobile ? styles['ChatInput__mobileView'] : '',
          isMobile ? (isInitialChat ? styles['ChatInput--mobileInitial'] : styles['ChatInput--mobileWithMessages']) : '',
        ].filter(Boolean).join(' ')}
      >
        {/* Inline Error Message */} 
        {inputError && (
          <div className={styles.ChatInput__error} role="alert">
            {inputError}
          </div>
        )}

        {/* Hidden file input */} 
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/jpeg, image/png, image/gif, image/webp"
          multiple
          onChange={handleImageSelection}
        />

        {/* Text Area and Inline Button */} 
        <ChatInputTextArea 
           ref={textareaRef}
           value={message}
           onChange={handleChange}
           onKeyDown={handleKeyDown}
           onPaste={handlePaste}
           placeholder={placeholderText}
           disabled={disabled}
           isEditing={isEditing}
           isWaitingForResponse={isWaitingForResponse}
           selectedModel={selectedModel}
           onSendClick={handleInlineSendClick}
        />
        
        {/* Action Button Row */} 
        <ChatInputActionRow 
           isMobile={isMobile}
           isEditing={isEditing}
           disabled={disabled}
           selectedModel={selectedModel}
           onNewChat={newChat}
           onUploadClick={triggerFileInput}
           onCancelEdit={handleCancelEdit}
           onToggleModelSelector={toggleModelSelector}
        />
      </div>
    </>
  );
});

// Display name
ChatInput.displayName = 'ChatInput';

// PropTypes
ChatInput.propTypes = {
  disabled: PropTypes.bool,
  selectedModel: PropTypes.shape({ // Define model shape if needed
    // Add specific model properties here if known/required
    id: PropTypes.string,
    name: PropTypes.string,
    // ... other properties
  }), 
  isStaticLayout: PropTypes.bool,
  editingMessage: PropTypes.shape({ // Define message shape for editing
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    content: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.shape({ // Support complex content
        type: PropTypes.string.isRequired,
        text: PropTypes.string,
        image_url: PropTypes.shape({
          url: PropTypes.string.isRequired
        })
      }))
    ]).isRequired
  }),
  onCancelEdit: PropTypes.func,
  isStreaming: PropTypes.bool,
  toggleModelSelector: PropTypes.func,
  onFocus: PropTypes.func,
  isInitialChat: PropTypes.bool,
  onSendMessage: PropTypes.func.isRequired,
};

export default ChatInput; 