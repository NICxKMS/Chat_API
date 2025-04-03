import React, { memo } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import styles from './ChatControls.module.css';
// Import appropriate icons
import { TrashIcon, DownloadIcon, StopIcon } from '@primer/octicons-react'; 

/**
 * Chat control buttons (clear, download, stop generation)
 * @param {Object} props - Component props
 * @param {Function} props.onReset - Clear chat function
 * @param {Function} props.onDownload - Download chat function
 * @param {Function} props.onStopGeneration - Stop generation function
 * @param {boolean} props.isGenerating - Whether AI is generating a response
 * @param {boolean} props.hasMessages - Whether there are messages in the chat
 * @param {boolean} [props.isStaticLayout=false] - Whether controls are in the static empty state layout
 * @returns {JSX.Element} - Rendered component
 */
const ChatControls = memo(({ 
  onReset, 
  onDownload, 
  onStopGeneration, 
  isGenerating, 
  hasMessages, 
  isStaticLayout = false // Destructure new prop with default
}) => {
  return (
    <div className={styles.controls}>
      {/* Clear chat button - Hide if static layout */}
      {!isStaticLayout && (
        <button
          className={`${styles.controlButton} ${styles.clearButton}`}
          onClick={onReset}
          disabled={!hasMessages || isGenerating}
          aria-label="Clear chat history"
          title="Clear chat history"
        >
          <TrashIcon size={16} className={styles.controlIcon} />
        </button>
      )}
      
      {/* Download chat button - Hide if static layout */}
      {!isStaticLayout && (
        <button
          className={`${styles.controlButton} ${styles.downloadButton}`}
          onClick={onDownload}
          disabled={!hasMessages || isGenerating}
          aria-label="Download chat history"
          title="Download chat history"
        >
          <DownloadIcon size={16} className={styles.controlIcon} />
        </button>
      )}
      
      {/* Stop generation button - only visible during generation (regardless of layout) */}
      {isGenerating && (
        <button
          className={`${styles.controlButton} ${styles.stopButton}`}
          onClick={onStopGeneration}
          aria-label="Stop generation"
          title="Stop generation"
        >
          <StopIcon size={16} className={styles.controlIcon} />
        </button>
      )}
    </div>
  );
});

ChatControls.propTypes = {
  onReset: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onStopGeneration: PropTypes.func.isRequired,
  isGenerating: PropTypes.bool,
  hasMessages: PropTypes.bool,
  isStaticLayout: PropTypes.bool, // Add prop type
};

// SVG icons removed, using imported icons now

// Display name for debugging
ChatControls.displayName = 'ChatControls';

export default ChatControls; 