import React, { memo } from 'react';
import styles from './SidebarToggle.module.css';

/**
 * Button to toggle the sidebar visibility on mobile
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the sidebar is open
 * @param {Function} props.onToggle - Function to toggle the sidebar
 * @returns {JSX.Element} - Rendered component
 */
const SidebarToggle = memo(({ isOpen, onToggle }) => {
  return (
    <button 
      className={`${styles.toggleButton} ${isOpen ? styles.active : ''}`}
      onClick={onToggle}
      aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      title={isOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      <div className={styles.toggleIcon}>
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </div>
    </button>
  );
});

// Display name for debugging
SidebarToggle.displayName = 'SidebarToggle';

export default SidebarToggle; 