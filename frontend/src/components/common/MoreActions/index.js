import { useState, useRef, useEffect } from 'react';
import { KebabHorizontalIcon } from '@primer/octicons-react';
import '../../../styles/common/buttons.css';
import styles from './MoreActions.module.css';

/**
 * More Actions component that shows/hides additional action buttons
 * @param {Object} props - Component props
 * @param {Array} props.actions - Array of action objects with { icon, label, onClick }
 * @param {string} [props.triggerButtonClassName='circleActionButton'] - Optional class for the trigger button
 * @returns {JSX.Element} - Rendered component
 */
const MoreActions = ({ actions = [], triggerButtonClassName = 'circleActionButton' }) => {
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
        className={`${triggerButtonClassName} ${isOpen ? styles.open : ''}`}
        onClick={toggleMenu}
        aria-label={isOpen ? 'Close actions menu' : 'Open actions menu'}
        aria-expanded={isOpen}
      >
        <KebabHorizontalIcon size={20} />
      </button>
      
      <div className={`${styles.actionsMenu} ${isOpen ? styles.open : ''}`}>
        {actions.map((action, index) => (
          <button
            key={index}
            className={styles.actionButton}
            onClick={action.onClick}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MoreActions;