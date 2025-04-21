import { memo } from 'react';
import { PlusIcon, GearIcon } from '@primer/octicons-react';
import { useAuth } from '../../../contexts/AuthContext';
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
 * @param {Function} [props.onNewChat] - Handler for new chat button click
 * @param {Function} [props.onToggleSettings] - Handler for settings button click
 * @returns {JSX.Element} - Rendered sidebar
 */
const Sidebar = memo(({ className = '', onNewChat, onToggleSettings }) => {
  const { currentUser, isAuthenticated } = useAuth();
  
  const userName = currentUser?.displayName || currentUser?.email || 'Sir';
  
  // Handle button clicks with fallbacks
  const handleNewChat = (e) => {
    e.preventDefault();
    if (onNewChat) {
      onNewChat();
    } else {
      console.warn('New chat handler not provided');
    }
  };

  const handleSettings = (e) => {
    e.preventDefault();
    if (onToggleSettings) {
      onToggleSettings();
    } else {
      console.warn('Settings handler not provided');
    }
  };

  return (
    <div className={`${styles.sidebar} ${className}`}>
      {/* Header with Title and Controls */}
      <div className={styles.header}>
        <h1 className={styles.title}>AI Chat</h1>
        <div className={styles.headerControls}>
          <button 
            className={`${styles.iconButton} ${styles.newChatButton}`}
            onClick={handleNewChat}
            aria-label="New chat"
            title="New chat"
          >
            <PlusIcon size={20} />
          </button>
          <button 
            className={`${styles.iconButton} ${styles.settingsButton}`}
            onClick={handleSettings}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon size={20} />
          </button>
        </div>
      </div>
      
      {/* Chat Session List */}
      <div className={styles.chatListContainer}>
        <ul className={styles.sessionList}>
          {sampleSessions.map(session => (
            <li key={session.id} className={styles.sessionItem}>
              <button className={styles.sessionButton} onClick={() => console.log('Load session:', session.id)}>
                <span className={styles.sessionTitle}>{session.title}</span>
                <span className={styles.sessionTimestamp}>{session.timestamp}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        {isAuthenticated ? (
          <div className={styles.userProfile}>
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt={`${userName}'s profile`}
                className={styles.userAvatar}
              />
            ) : (
              <div className={styles.userInitial}>
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={styles.userName}>{userName}</span>
          </div>
        ) : (
          <span className={styles.footerPlaceholderText}></span>
        )}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar; 