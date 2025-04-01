import React, { lazy, Suspense, useState, useCallback } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import styles from './MainContent.module.css';

// Lazily loaded components
const ChatContainer = lazy(() => import('../../chat/ChatContainer'));
const SettingsPanel = lazy(() => import('../../settings/SettingsPanel'));
const SidebarToggle = lazy(() => import('../SidebarToggle'));

/**
 * Main content area component containing chat interface and settings
 * @returns {JSX.Element} - Rendered component
 */
const MainContent = () => {
  const isDesktop = useIsDesktop();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Toggle settings panel
  const toggleSettings = useCallback(() => {
    setIsSettingsOpen(prev => !prev);
  }, []);
  
  // Toggle sidebar on mobile
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);
  
  return (
    <main className={styles.mainContent}>
      {/* Sidebar toggle button (mobile only) */}
      {!isDesktop && (
        <Suspense fallback={<div className={styles.togglePlaceholder} />}>
          <SidebarToggle
            isOpen={isSidebarOpen}
            onToggle={toggleSidebar}
          />
        </Suspense>
      )}
      
      {/* Chat area */}
      <Suspense fallback={<div className={styles.chatPlaceholder} />}>
        <ChatContainer 
          toggleSettings={toggleSettings}
        />
      </Suspense>
      
      {/* Settings panel (slide in from right) */}
      <Suspense fallback={null}>
        <SettingsPanel 
          isOpen={isSettingsOpen}
          onClose={toggleSettings}
        />
      </Suspense>
      
      {/* Sidebar overlay for mobile */}
      {!isDesktop && isSidebarOpen && (
        <div 
          className={styles.sidebarOverlay}
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </main>
  );
};

export default MainContent; 