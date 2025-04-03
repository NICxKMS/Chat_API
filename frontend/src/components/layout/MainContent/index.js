import React, { lazy, Suspense } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import styles from './MainContent.module.css';

// Lazily loaded components
const ChatContainer = lazy(() => import('../../chat/ChatContainer'));
const SettingsPanel = lazy(() => import('../../settings/SettingsPanel'));
const SidebarToggle = lazy(() => import('../SidebarToggle'));

/**
 * Main content area component containing chat interface and settings
 * @param {Object} props - Component props
 * @param {boolean} props.isSidebarOpen - Whether the sidebar is open (mobile)
 * @param {Function} props.toggleSidebar - Function to toggle the sidebar (mobile)
 * @param {boolean} props.isSettingsOpen - Whether the settings panel is open
 * @param {Function} props.toggleSettings - Function to toggle the settings panel
 * @returns {JSX.Element} - Rendered component
 */
const MainContent = ({ 
  isSidebarOpen, 
  toggleSidebar, 
  isSettingsOpen, // Receive from Layout 
  toggleSettings // Receive from Layout
}) => {
  // isDesktop hook is no longer needed here for conditional rendering
  // const isDesktop = useIsDesktop();
  
  return (
    <main className={styles.mainContent}>
      {/* Always render SidebarToggle - visibility can be handled by CSS if needed */}
      <Suspense fallback={<div className={styles.togglePlaceholder} />}>
        <SidebarToggle
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
        />
      </Suspense>
      
      {/* Chat area */}
      <Suspense fallback={<div className={styles.chatPlaceholder} />}>
        <ChatContainer />
      </Suspense>
      
      {/* Settings panel (slide in from right) - Pass state and close handler */}
      <Suspense fallback={null}>
        <SettingsPanel 
          isOpen={isSettingsOpen}
          onClose={toggleSettings} // Use toggleSettings from Layout as onClose
        />
      </Suspense>
    </main>
  );
};

export default MainContent; 