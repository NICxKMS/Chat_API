import React from 'react';
import PropTypes from 'prop-types';
import { PlusIcon, XIcon, KebabHorizontalIcon, ImageIcon, SearchIcon, LightBulbIcon } from '@primer/octicons-react';
import styles from './ChatInputActionRow.module.css';

const ChatInputActionRow = ({
  isMobile = false,
  isEditing = false,
  disabled = false,
  selectedModel = null,
  onNewChat,
  onUploadClick,
  onCancelEdit,
  onToggleModelSelector,
  // Add props for Search/Reason/More buttons if implementing later
}) => {
  return (
    <div className={styles['ChatInput__actionRow']}>
      {/* Left side buttons */}
      <div className={styles['ChatInput__leftButtons']}>
        {/* Upload button */}
        <button
          className={styles['ChatInput__uploadButton']}
          onClick={onUploadClick} // Use prop
          disabled={disabled || !selectedModel?.capabilities?.includes('vision')} // Simplified logic
          aria-label={selectedModel?.capabilities?.includes('vision') ? "Upload images" : "Select a model with vision capabilities"}
          title={selectedModel?.capabilities?.includes('vision') ? "Upload images" : "Select a model with vision capabilities"}
          type="button"
        >
          <ImageIcon size={16} />
        </button>
        
        {/* Placeholder Buttons - Add onClick handlers later */}
        <button
          className={`${styles['ChatInput__textButton']} ${isMobile ? styles['ChatInput__iconOnlyButton'] : ''}`}
          aria-label="Search"
          title="Search (coming soon)"
          type="button"
          disabled={true} // Disable for now
        >
          <SearchIcon size={16} />
          {!isMobile && <span className={styles.buttonText}>Search</span>}
        </button>
        
        <button
          className={`${styles['ChatInput__textButton']} ${isMobile ? styles['ChatInput__iconOnlyButton'] : ''}`}
          aria-label="Reason mode"
          title="Reason mode (coming soon)"
          type="button"
          disabled={true} // Disable for now
        >
          <LightBulbIcon size={16} />
          {!isMobile && <span className={styles.buttonText}>Reason</span>}
        </button>
        
        <button
          className={styles['ChatInput__actionButton']}
          aria-label="More options"
          title="More options (coming soon)"
          type="button"
          disabled={true} // Disable for now
        >
          <KebabHorizontalIcon size={16} />
        </button>
      </div>
      
      {/* Right side buttons */}
      <div className={styles['ChatInput__rightButtons']}>
        {/* New chat button */}
        <button 
          className={styles['ChatInput__actionButton']}
          onClick={onNewChat}
          aria-label="New chat"
          title="New chat"
          type="button"
        >
          <PlusIcon size={16} />
        </button>
        
        {/* Cancel edit button */}
        {isEditing && (
          <button
            className={styles['ChatInput__uploadButton']} // Re-use style? Maybe rename this style
            onClick={onCancelEdit}
            aria-label="Cancel edit"
            title="Cancel edit (Esc)"
            type="button"
          >
            <XIcon size={16} />
          </button>
        )}
        
        {/* AI model button */}
        <button
          className={styles['ChatInput__modelButton']}
          onClick={onToggleModelSelector}
          aria-label="Select AI model"
          title="Select AI model"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* SVG content */}
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
  );
};

ChatInputActionRow.propTypes = {
  isMobile: PropTypes.bool,
  isEditing: PropTypes.bool,
  disabled: PropTypes.bool,
  selectedModel: PropTypes.object,
  onNewChat: PropTypes.func.isRequired,
  onUploadClick: PropTypes.func.isRequired,
  onCancelEdit: PropTypes.func.isRequired,
  onToggleModelSelector: PropTypes.func.isRequired,
};

export default React.memo(ChatInputActionRow); 