import { memo } from 'react';
import styles from './SidebarToggle.module.css';

/**
 * Button to toggle the sidebar visibility
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the sidebar is open
 * @param {Function} props.onToggle - Function to toggle the sidebar
 * @returns {JSX.Element} - Rendered component
 */
const SidebarToggle = memo(({ isOpen, onToggle }) => {
  return (
    <div className={styles.toggleContainer}>
      <button 
        className={`${styles.toggleButton} ${isOpen ? styles.active : ''}`}
        onClick={onToggle}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        title={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <div className={styles.hamburger}>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
        </div>
      </button>
    </div>
  );
});

// Display name for debugging
SidebarToggle.displayName = 'SidebarToggle';

export default SidebarToggle; 