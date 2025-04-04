import React, { useState, useEffect, useCallback, memo } from 'react';
import { useApi } from '../../../contexts/ApiContext';
import styles from './ApiStatus.module.css';
import { SyncIcon } from '@primer/octicons-react'; 

/**
 * Component to display API connection status
 * @returns {JSX.Element} - Rendered component
 */
const ApiStatus = memo(({ isFloating = false, isMenu = false }) => {
  const { apiUrl, checkApiStatus, apiStatus, lastChecked, isLoading } = useApi();

  // Attach refresh to main click handler
  const handleClick = useCallback((e) => {
    if (e) e.stopPropagation(); 
    checkApiStatus();
  }, [checkApiStatus]);

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    if (apiStatus === 'online') return 'API Online';
    if (apiStatus === 'offline') return 'API Offline';
    return 'API Status Unknown';
  };

  const statusText = getStatusText();
  const titleText = lastChecked
    ? `${statusText} (Last checked: ${new Date(lastChecked).toLocaleTimeString()})`
    : statusText;

  // Combine classes based on props
  const statusClasses = [
    styles.status,
    styles[apiStatus] || styles.unknown,
    isLoading ? styles.loading : '',
    isFloating ? styles.floating : '',
    isMenu ? styles.inMenu : '' // Add class for menu context
  ].filter(Boolean).join(' ');

  // Dynamic title for hover effect
  const hoverTitle = isMenu 
    ? `API Status: ${statusText}. Click to refresh.` 
    : titleText; // Use detailed text for non-menu title

  return (
    <div 
      className={statusClasses} 
      // Use common onClick handler, role/aria depend on context
      onClick={handleClick} 
      role={isMenu ? "button" : "status"} 
      tabIndex={isMenu ? 0 : -1} // Make focusable only if button
      aria-label={hoverTitle} // Use more descriptive aria-label
      title={hoverTitle} // Use dynamic title
    >
      <span className={styles.statusDot}></span>
      {/* Remove status text span entirely */}
      {/* Remove Refresh button entirely */}
      
      {/* Remove custom tooltip rendering */}
      {/* {!isMenu && showTooltip && (
         <Tooltip text={tooltipText} position="top" />
      )} */}
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