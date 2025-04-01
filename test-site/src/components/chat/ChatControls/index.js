import React, { memo } from 'react';
import styles from './ChatControls.module.css';

/**
 * Chat control buttons (reset, download, settings, stop generation)
 * @param {Object} props - Component props
 * @param {Function} props.onReset - Reset chat function
 * @param {Function} props.onDownload - Download chat function
 * @param {Function} props.onSettings - Toggle settings function
 * @param {Function} props.onStopGeneration - Stop generation function
 * @param {boolean} props.isGenerating - Whether AI is generating a response
 * @param {boolean} props.hasMessages - Whether there are messages in the chat
 * @returns {JSX.Element} - Rendered component
 */
const ChatControls = memo(({ 
  onReset, 
  onDownload, 
  onSettings, 
  onStopGeneration, 
  isGenerating, 
  hasMessages 
}) => {
  return (
    <div className={styles.controls}>
      {/* Reset chat button */}
      <button
        className={`${styles.controlButton} ${styles.resetButton}`}
        onClick={onReset}
        disabled={!hasMessages || isGenerating}
        aria-label="Reset chat"
        title="Reset chat"
      >
        <ResetIcon className={styles.controlIcon} />
        <span className={styles.controlText}>Reset</span>
      </button>
      
      {/* Download chat button */}
      <button
        className={`${styles.controlButton} ${styles.downloadButton}`}
        onClick={onDownload}
        disabled={!hasMessages || isGenerating}
        aria-label="Download chat history"
        title="Download chat history"
      >
        <DownloadIcon className={styles.controlIcon} />
        <span className={styles.controlText}>Download</span>
      </button>
      
      {/* Settings button */}
      <button
        className={`${styles.controlButton} ${styles.settingsButton}`}
        onClick={onSettings}
        aria-label="Open settings"
        title="Open settings"
      >
        <SettingsIcon className={styles.controlIcon} />
        <span className={styles.controlText}>Settings</span>
      </button>
      
      {/* Stop generation button - only visible during generation */}
      {isGenerating && (
        <button
          className={`${styles.controlButton} ${styles.stopButton}`}
          onClick={onStopGeneration}
          aria-label="Stop generation"
          title="Stop generation"
        >
          <StopIcon className={styles.controlIcon} />
          <span className={styles.controlText}>Stop</span>
        </button>
      )}
    </div>
  );
});

// SVG icons as components for better performance
const ResetIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const DownloadIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const StopIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);

// Display name for debugging
ChatControls.displayName = 'ChatControls';

export default ChatControls; 