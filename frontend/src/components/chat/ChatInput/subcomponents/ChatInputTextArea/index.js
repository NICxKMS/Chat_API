import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { PaperAirplaneIcon, CheckIcon } from '@primer/octicons-react';
import styles from './ChatInputTextArea.module.css';

const ChatInputTextArea = forwardRef(({
  value,
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  disabled = false,
  isEditing = false,
  isWaitingForResponse = false,
  selectedModel = null,
  onSendClick // Renamed from handleButtonClick for clarity
}, ref) => {
  
  const sendButtonIcon = () => {
    if (isWaitingForResponse) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        </svg>
      );
    }
    if (!selectedModel) {
      return (
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
      );
    }
    if (isEditing) {
      return <CheckIcon size={21} />;
    }
    return <PaperAirplaneIcon size={21} />;
  };
  
  const sendButtonLabel = isWaitingForResponse ? "Stop generation" 
                         : !selectedModel ? "Select model" 
                         : isEditing ? "Save edit" 
                         : "Send message";
                         
  const sendButtonTitle = isWaitingForResponse ? "Stop generation" 
                         : !selectedModel ? "Select a model" 
                         : isEditing ? "Save edit (Enter)" 
                         : "Send message (Enter)";

  return (
    <div className={`${styles['ChatInput__inputWrapper']} ${!selectedModel ? styles.noModelSelected : ''}`}>
      <textarea
        ref={ref} // Forwarded ref
        className={styles['ChatInput__chatInput']}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        disabled={disabled}
        rows={1}
        aria-label="Chat message input"
      />
      
      <button
        className={`${styles['ChatInput__sendButtonInline']} ${isWaitingForResponse ? styles['ChatInput__stopButton'] : ''} ${!selectedModel ? styles.noModelSelected : ''}`}
        onClick={onSendClick}
        // Disable logic simplified: disable if not waiting AND (no text OR disabled externally)
        disabled={!isWaitingForResponse && (!value?.trim() || disabled)}
        aria-label={sendButtonLabel}
        title={sendButtonTitle}
        type="button"
      >
        {sendButtonIcon()}
      </button>
    </div>
  );
});

ChatInputTextArea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onPaste: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  isEditing: PropTypes.bool,
  isWaitingForResponse: PropTypes.bool,
  selectedModel: PropTypes.object,
  onSendClick: PropTypes.func.isRequired,
};

ChatInputTextArea.displayName = 'ChatInputTextArea';

export default ChatInputTextArea; 