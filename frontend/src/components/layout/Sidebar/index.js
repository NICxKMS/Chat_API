import { memo } from 'react';
import PropTypes from 'prop-types';
import { PlusIcon, GearIcon, ChevronLeftIcon } from '@primer/octicons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useChatControl } from '../../../contexts/ChatControlContext';
import styles from './Sidebar.module.css';
// Remove unused icons if PlusIcon/GearIcon only used for floating buttons
// import { GearIcon, PlusIcon } from '@primer/octicons-react'; 

// Remove imports for components moved out
// const ThemeToggle = lazy(() => import('../../common/ThemeToggle'));
// const ApiStatus = lazy(() => import('../../common/ApiStatus'));

// Sample data (keep for now)
const sampleSessions = [
  { id: 'session-1', title: 'LLM Explanation Chat', timestamp: '2 hours ago' },
  { id: 'session-2', title: 'React Component Refactoring', timestamp: 'Yesterday' },
  { id: 'session-3', title: 'CSS Grid Layout Ideas', timestamp: 'Mar 30' },
  { id: 'session-4', title: 'Python Script Debugging', timestamp: 'Mar 28' },
];

/**
 * Sidebar component containing app controls and chat session list
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS class
 * @param {Function} [props.onToggleSettings] - Handler for settings button click
 * @param {Function} [props.onToggleSidebar] - Handler for sidebar toggle button click
 * @returns {JSX.Element} - Rendered sidebar
 */
const Sidebar = memo(({ className = '', onToggleSettings = () => console.warn('Settings handler not provided to Sidebar'), onToggleSidebar = () => console.warn('Sidebar toggle handler not provided to Sidebar') }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const { newChat } = useChatControl();
  
  const userName = currentUser?.displayName || currentUser?.email || 'Sir';
  
  // Handle button clicks with fallbacks
  const handleNewChat = (e) => {
    e.preventDefault();
    newChat();
  };

  const handleSettings = (e) => {
    e.preventDefault();
    onToggleSettings();
  };

  return (
    <div className={`${styles.Sidebar} ${className}`}>
      {/* Header with Title and Controls */}
      <div className={styles.Sidebar__header}>
        <h1 className={styles.Sidebar__title}>AI Chat</h1>
        <div className={styles.Sidebar__headerControls}>
          <button 
            className={`${styles.Sidebar__iconButton} ${styles['Sidebar__iconButton--newChat']}`}
            onClick={handleNewChat}
            aria-label="New chat"
            title="New chat"
          >
            <PlusIcon size={20} />
          </button>
          <button 
            className={`${styles.Sidebar__iconButton} ${styles['Sidebar__iconButton--settings']}`}
            onClick={handleSettings}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon size={20} />
          </button>
          <button
            className={styles.Sidebar__iconButton}
            onClick={onToggleSidebar}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <ChevronLeftIcon size={20} />
          </button>
        </div>
      </div>
      
      {/* Chat Session List */}
      <div className={styles.Sidebar__chatListContainer}>
        <ul className={styles.Sidebar__sessionList}>
          {sampleSessions.map(session => (
            <li key={session.id} className={styles.Sidebar__sessionItem}>
              <button className={styles.Sidebar__sessionButton} onClick={() => console.log('Load session:', session.id)}>
                <span className={styles.Sidebar__sessionTitle}>{session.title}</span>
                <span className={styles.Sidebar__sessionTimestamp}>{session.timestamp}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className={styles.Sidebar__footer}>
        {isAuthenticated ? (
          <div className={styles.Sidebar__userProfile}>
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt={`${userName}'s profile`}
                className={styles.Sidebar__userAvatar}
              />
            ) : (
              <div className={styles.Sidebar__userInitial}>
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={styles.Sidebar__userName}>{userName}</span>
          </div>
        ) : (
          <span className={styles.footerPlaceholderText}></span>
        )}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

// Define PropTypes
Sidebar.propTypes = {
  className: PropTypes.string,
  onToggleSettings: PropTypes.func,
  onToggleSidebar: PropTypes.func
};

export default Sidebar; 