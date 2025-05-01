import { memo } from 'react';
import PropTypes from 'prop-types';
import styles from './SidebarToggle.module.css';

/**
 * Button to toggle the sidebar visibility
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the sidebar is open
 * @param {Function} props.onToggle - Function to toggle the sidebar
 * @returns {JSX.Element} - Rendered component
 */
const SidebarToggle = memo(({ isOpen, onToggle }) => {
  // Hide container smoothly when sidebar is open
  const containerClass = isOpen
    ? `${styles.SidebarToggle__container} ${styles['SidebarToggle__container--hidden']}`
    : styles.SidebarToggle__container;
  return (
    <div className={containerClass}>
      <button 
        className={`${styles.SidebarToggle__button} ${isOpen ? styles['SidebarToggle__button--active'] : ''}`}
        onClick={onToggle}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        title={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <div className={styles.SidebarToggle__hamburger}>
          <span className={styles.SidebarToggle__bar}></span>
          <span className={styles.SidebarToggle__bar}></span>
          <span className={styles.SidebarToggle__bar}></span>
        </div>
      </button>
    </div>
  );
});

// Display name for debugging
SidebarToggle.displayName = 'SidebarToggle';

// Define PropTypes
SidebarToggle.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default SidebarToggle; 