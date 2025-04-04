import React, { memo, useState, useEffect, useRef, Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatControls.module.css';
// Restore necessary icons
import { TrashIcon, DownloadIcon, StopIcon, ChevronUpIcon, GearIcon, PlusIcon } from '@primer/octicons-react';

// Restore lazy loads
const ThemeToggle = lazy(() => import('../../common/ThemeToggle'));
const ApiStatus = lazy(() => import('../../common/ApiStatus'));

/**
 * Chat control buttons - Stop button always visible when generating,
 * other actions are in a pop-up menu triggered by ChevronUpIcon on mobile.
 * @param {Object} props - Component props
 * @param {Function} props.onStopGeneration - Stop generation function
 * @param {boolean} props.isGenerating - Whether AI is generating a response
 * @param {Function} props.onReset - Clear chat function
 * @param {Function} props.onDownload - Download chat function
 * @param {boolean} props.hasMessages - Whether there are messages in the chat
 * @param {Function} [props.onNewChat] - Function to call for New Chat
 * @param {Function} [props.onToggleSettings] - Function to call for Settings
 * @returns {JSX.Element} - Rendered component
 */
const ChatControls = memo(({ 
  onStopGeneration, 
  isGenerating, 
  // Restore props
  onReset, 
  onDownload, 
  hasMessages, 
  onNewChat, 
  onToggleSettings
}) => {
  // Restore state and refs
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Restore toggle and effect
  const toggleMenu = (e) => {
    e.stopPropagation();
    setIsMenuOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if ( menuRef.current && !menuRef.current.contains(event.target) &&
           buttonRef.current && !buttonRef.current.contains(event.target) ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuItemClick = (actionFn) => {
    if (actionFn) actionFn();
    setIsMenuOpen(false);
  };

  return (
    <div className={styles.controls}>
      {/* Stop generation button - Renders if isGenerating */}
      {isGenerating && (
        <button
          className={`${styles.controlButton} ${styles.stopButton}`}
          onClick={onStopGeneration}
          aria-label="Stop generation"
          title="Stop generation"
        >
          <StopIcon size={16} className={styles.controlIcon} />
        </button>
      )}

      {/* "More Actions" Button + Menu (Button hidden on Desktop via CSS) */}
      <div className={styles.moreActionsContainer}> 
        <button
          ref={buttonRef}
          className={`${styles.controlButton} ${styles.moreActionsButton}`}
          onClick={toggleMenu}
          aria-haspopup="true"
          aria-expanded={isMenuOpen}
          aria-label="More actions"
          title="More actions"
        >
          <ChevronUpIcon size={16} className={styles.controlIcon} />
        </button>

        {isMenuOpen && (
          <div ref={menuRef} className={styles.actionsMenu}>
            {/* New Chat */}
            <button
              className={styles.menuItem}
              onClick={() => handleMenuItemClick(onNewChat)}
              disabled={isGenerating}
              title="Start a new chat"
            >
              <PlusIcon size={16} />
            </button>
            {/* Download Chat */}
             <button
               className={styles.menuItem}
               onClick={() => handleMenuItemClick(onDownload)}
               disabled={!hasMessages || isGenerating}
               title="Download chat history"
             >
               <DownloadIcon size={16} />
             </button>
            {/* Clear Chat */}
             <button
               className={styles.menuItem}
               onClick={() => handleMenuItemClick(onReset)}
               disabled={!hasMessages || isGenerating}
               title="Clear chat history"
             >
               <TrashIcon size={16} />
             </button>
            {/* Theme Toggle */}
            <div className={styles.menuItem} title="Toggle light/dark theme">
              <Suspense fallback={null}><ThemeToggle /></Suspense>
            </div>
            {/* Settings */}
            <button
              className={styles.menuItem}
              onClick={() => handleMenuItemClick(onToggleSettings)}
              title="Open settings panel"
            >
              <GearIcon size={16} />
            </button>
            {/* API Status - Title handled by ApiStatus component */}
            <div 
              className={`${styles.menuItem} ${styles.apiStatusMenuItem}`}
              role="button"
              onClick={() => {/* ApiStatus handles its own click */}}
            >
               <Suspense fallback={null}> 
                 <ApiStatus isMenu={true} />
               </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ChatControls.propTypes = {
  onStopGeneration: PropTypes.func.isRequired,
  isGenerating: PropTypes.bool,
  // Restore prop types
  onReset: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  hasMessages: PropTypes.bool,
  onNewChat: PropTypes.func,
  onToggleSettings: PropTypes.func,
};

ChatControls.displayName = 'ChatControls';

export default ChatControls; 