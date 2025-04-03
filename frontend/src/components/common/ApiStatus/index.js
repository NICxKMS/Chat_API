import React, { memo } from 'react';
import { useApi } from '../../../contexts/ApiContext';
import styles from './ApiStatus.module.css';

/**
 * Component to display API connection status
 * @returns {JSX.Element} - Rendered component
 */
const ApiStatus = memo(() => {
  const { apiStatus, checkApiStatus } = useApi();
  const { online, checking } = apiStatus;
  
  // Status CSS class based on connection state
  const statusClass = online ? styles.online : styles.offline;
  
  // Status text to display
  const statusText = online ? 'Online' : 'Offline';
  
  // Handle refresh click
  const handleRefresh = () => {
    checkApiStatus();
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <div className={`${styles.indicator} ${statusClass} ${checking ? styles.checking : ''}`} />
        <span className={styles.text}>{statusText}</span>
      </div>
      
      <button 
        className={styles.refreshButton}
        onClick={handleRefresh}
        aria-label="Refresh API connection status"
        title="Refresh API connection status"
      >
        <RefreshIcon className={styles.refreshIcon} />
      </button>
    </div>
  );
});

// SVG Refresh icon as a component
const RefreshIcon = ({ className }) => (
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
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

// Display name for debugging
ApiStatus.displayName = 'ApiStatus';

export default ApiStatus; 