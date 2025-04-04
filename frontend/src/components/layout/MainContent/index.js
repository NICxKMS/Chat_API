import React, { lazy, Suspense } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import styles from './MainContent.module.css';

// Lazily loaded components
const ChatContainer = lazy(() => import('../../chat/ChatContainer'));
const SidebarToggle = lazy(() => import('../SidebarToggle'));

/**
 * Main content area component containing chat interface and settings
 * @param {Object} props - Component props
 * @param {boolean} props.isSidebarOpen - Whether the sidebar is open (mobile)
 * @param {Function} props.toggleSidebar - Function to toggle the sidebar (mobile)
 * @param {Object} props.selectedModel - The currently selected model object
 * @param {boolean} props.isLoadingModels - Whether models are currently loading
 * @param {Function} props.toggleModelSelector - Function to toggle the model dropdown/modal
 * @param {Function} props.onNewChat - Function to handle new chat
 * @returns {JSX.Element} - Rendered component
 */
const MainContent = ({ 
  isSidebarOpen, 
  toggleSidebar, 
  selectedModel,
  isLoadingModels,
  toggleModelSelector,
  /* Accept handlers */
  onNewChat, 
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
      
      {/* Chat area - Pass model button props down */}
      <Suspense fallback={<div className={styles.chatPlaceholder} />}>
        <ChatContainer 
          selectedModel={selectedModel}
          isLoadingModels={isLoadingModels}
          toggleModelSelector={toggleModelSelector}
          /* Pass handlers down */
          onNewChat={onNewChat}
        />
      </Suspense>
    </main>
  );
};

export default MainContent; 