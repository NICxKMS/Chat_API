import React from 'react';
import PropTypes from 'prop-types';
import { PlusIcon, DownloadIcon } from '@primer/octicons-react';
import styles from './SecondaryActions.module.css';

/**
 * Displays secondary action buttons below the chat input.
 */
const SecondaryActions = ({ onNewChat, onDownloadChat, canDownload }) => {
  return (
    <div className={styles.actionsContainer}>
      <button 
        className={`${styles.actionButton} ${styles.newChatButton}`}
        onClick={onNewChat}
        aria-label="Start new chat"
      >
        <PlusIcon size={14} /> New Chat
      </button>
      
      <button 
        className={`${styles.actionButton} ${styles.downloadButton}`}
        onClick={onDownloadChat}
        disabled={!canDownload} // Disable if no history to download
        aria-label="Download chat history"
      >
        <DownloadIcon size={14} /> Download
      </button>
    </div>
  );
};

SecondaryActions.propTypes = {
  /** Function to trigger a new chat */
  onNewChat: PropTypes.func.isRequired,
  /** Function to trigger chat download */
  onDownloadChat: PropTypes.func.isRequired,
  /** Whether downloading is currently possible (e.g., history exists) */
  canDownload: PropTypes.bool,
};

SecondaryActions.defaultProps = {
  canDownload: false,
};

export default SecondaryActions; 