import { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { KebabHorizontalIcon, PlusIcon, TrashIcon, DownloadIcon } from '@primer/octicons-react';
import { useChatControl } from '../../../contexts/ChatControlContext';
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
  const { newChat, resetChat, downloadChat } = useChatControl();
  
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
  
  // Combine standard actions from context with custom actions from props
  const allActions = useMemo(() => [
    // Standard Actions
    {
      icon: <PlusIcon size={16} />,
      label: 'New Chat',
      onClick: newChat
    },
    {
      icon: <TrashIcon size={16} />,
      label: 'Reset Chat',
      onClick: resetChat
    },
    {
      icon: <DownloadIcon size={16} />,
      label: 'Download Chat',
      onClick: downloadChat
    },
    // Custom actions passed via props
    ...actions
  ], [newChat, resetChat, downloadChat, actions]);
  
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
      
      <div 
        className={`${styles.actionsMenu} ${isOpen ? styles.open : ''}`}
        role="menu"
      >
        {allActions.map((action, index) => (
          <button
            key={index}
            className={styles.actionButton}
            role="menuitem"
            onClick={() => {
              if (action.onClick) action.onClick();
              setIsOpen(false);
            }}
            aria-label={action.label}
            style={{
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

// Define PropTypes for the component
MoreActions.propTypes = {
  actions: PropTypes.arrayOf(PropTypes.shape({
    icon: PropTypes.node.isRequired,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired
  })),
  triggerButtonClassName: PropTypes.string
};