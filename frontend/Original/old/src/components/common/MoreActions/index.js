import { useState, useRef, useEffect } from 'react';
import styles from './MoreActions.module.css';

/**
 * More Actions component that shows/hides additional action buttons
 * @param {Object} props - Component props
 * @param {Array} props.actions - Array of action objects with { icon, label, onClick }
 * @returns {JSX.Element} - Rendered component
 */
const MoreActions = ({ actions = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };
  
  return (
    <div className={styles.moreActionsContainer} ref={menuRef}>
      <button 
        className={`${styles.moreButton} ${isOpen ? styles.active : ''}`}
        onClick={toggleMenu}
        aria-label={isOpen ? 'Close actions menu' : 'Open actions menu'}
        aria-expanded={isOpen}
      >
        <KebabHorizontalIcon size={20} className={styles.icon} />
      </button>
      
      <div className={`${styles.actionsMenu} ${isOpen ? styles.open : ''}`}>
        {actions.map((action, index) => (
          <button
            key={index}
            className={styles.actionButton}
            onClick={() => {
              action.onClick();
              setIsOpen(false);
            }}
            aria-label={action.label}
            style={{
              // Add staggered animation delay for each button
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
            }}
          >
            <span className={styles.actionIcon}>{action.icon}</span>
            <span className={styles.actionLabel}>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MoreActions; 