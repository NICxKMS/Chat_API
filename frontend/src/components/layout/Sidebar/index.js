import React, { memo, lazy, Suspense } from 'react';
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
 * // Removed onNewChat, onToggleSettings props
 * @returns {JSX.Element} - Rendered sidebar
 */
const Sidebar = memo(({ className = '' }) => {
  
  return (
    <div className={`${styles.sidebar} ${className}`}>
      {/* Header - Only Title */} 
      <div className={styles.header}>
        <h1 className={styles.title}>AI Chat</h1>
        {/* Remove New Chat Button */}
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

      {/* Footer - Now Empty or for other future items */}
      <div className={styles.footer}>
        {/* Remove ApiStatus */}
        {/* Remove ThemeToggle */}
        {/* Remove Settings Button */}
        {/* Add a placeholder or style the empty footer if needed */}
         <span className={styles.footerPlaceholderText}></span> 
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar; 