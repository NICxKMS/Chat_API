import React, { memo, lazy, Suspense } from 'react';
// No change needed for useApi, remove if ApiStatus doesn't need it later
// import { useApi } from '../../../contexts/ApiContext'; 
import styles from './Sidebar.module.css';
import { GearIcon, PlusIcon } from '@primer/octicons-react'; // Assuming icon library

// Lazily loaded components
// const ModelDropdown = lazy(() => import('../../models/ModelDropdown')); // Removed - Now triggered from Layout
const ThemeToggle = lazy(() => import('../../common/ThemeToggle'));
const ApiStatus = lazy(() => import('../../common/ApiStatus'));
// Settings button needs toggle function passed as prop
// const SettingsButton = lazy(() => import('../../common/SettingsButton')); 

// Sample data for past chat sessions
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
 * @param {Function} [props.onNewChat] - Function to call when New Chat is clicked
 * @param {Function} [props.onToggleSettings] - Function to toggle settings panel
 * @param {boolean} [props.isCompact] - Indicates if the sidebar is in compact mode
 * @returns {JSX.Element} - Rendered sidebar
 */
const Sidebar = memo(({ className = '', onNewChat, onToggleSettings, isCompact }) => {
  // API URL removed from here
  // const { apiUrl } = useApi(); 
  
  return (
    <div className={`${styles.sidebar} ${className} ${isCompact ? styles.compact : ''}`}>
      {/* Combined Header */}
      <div className={styles.header}>
        {/* Only show title if not compact */}
        {!isCompact && <h1 className={styles.title}>AI Chat</h1>}
        <button 
          className={`${styles.iconButton} ${styles.newChatButton}`}
          onClick={onNewChat} 
          title="Start a new chat"
          aria-label="Start a new chat"
        >
          <PlusIcon size={16} />
          {/* Only show text if not compact */}
          {!isCompact && <span>New Chat</span>}
        </button>
      </div>
      
      {/* Chat Session List */}
      <div className={styles.chatListContainer}>
        {!isCompact ? (
          <ul className={styles.sessionList}>
            {sampleSessions.map(session => (
              <li key={session.id} className={styles.sessionItem}>
                <button className={styles.sessionButton} onClick={() => console.log('Load session:', session.id)}>
                  <span className={styles.sessionTitle}>{session.title}</span>
                  <span className={styles.sessionTimestamp}>{session.timestamp}</span>
                </button>
              </li>
            ))
            }
          </ul>
        ) : (
          // Optionally show icons only or tooltips when compact
          <div className={styles.compactSessionList}>
             {sampleSessions.map(session => (
               <button key={session.id} className={`${styles.iconButton} ${styles.compactSessionButton}`} title={session.title} onClick={() => console.log('Load session:', session.id)}>
                 {/* Placeholder icon - replace with relevant one */} 
                 <span>{session.title.charAt(0)}</span>
               </button>
             ))}
          </div>
        )}
      </div>

      {/* Model Selection Removed from here */}
      {/* <div className={styles.modelContainer}> ... </div> */}
      
      {/* Footer with controls */}
      <div className={styles.footer}>
        {/* ApiStatus moved here */}
        <Suspense fallback={<div className={styles.statusPlaceholder} />}>
          <ApiStatus />
        </Suspense>
        <Suspense fallback={<div className={styles.themePlaceholder} />}>
          <ThemeToggle />
        </Suspense>
        {/* Settings Button - Needs onToggleSettings prop */}
        {onToggleSettings && (
          <button 
            className={styles.iconButton} 
            onClick={onToggleSettings}
            title="Settings"
            aria-label="Open settings panel"
          >
            <GearIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
});

// Display name for debugging
Sidebar.displayName = 'Sidebar';

export default Sidebar; 