import React, { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import { useModel } from '../../../contexts/ModelContext';
import { useChat } from '../../../contexts/ChatContext';
// Import useApi if needed for apiUrl, but not for status
// import { useApi } from '../../../contexts/ApiContext'; 
import { useAuth } from '../../../contexts/AuthContext'; // Import useAuth
import styles from './Layout.module.css';
// Import icons using the correct paths
import { PlusIcon, GearIcon, TrashIcon, DownloadIcon } from '@primer/octicons-react';
// Import only the specific icons needed
// const ApiStatus = lazy(() => import('../../common/ApiStatus')); // Removed
import { useSettings } from '../../../contexts/SettingsContext';
import { lazyLoad } from '../../../utils/lazyLoad'; // Assuming lazyLoad utility path

// Lazily loaded components with preload hints
const Sidebar = lazy(() => import(/* webpackPrefetch: true */ '../Sidebar'));
const MainContent = lazy(() => import(/* webpackPrefetch: true */ '../MainContent'));
// import ModelSelectorButton from '../../models/ModelSelectorButton'; // Remove this import
const ModelDropdown = lazy(() => import(/* webpackPrefetch: true */ '../../models/ModelDropdown'));
const Spinner = lazy(() => import(/* webpackPrefetch: true */ '../../common/Spinner'));
const ThemeToggle = lazy(() => import(/* webpackPrefetch: true */ '../../common/ThemeToggle'));
// Remove ApiStatus import
// const ApiStatus = lazy(() => import('../../common/ApiStatus')); // Removed
const SettingsPanel = lazy(() => import(/* webpackPrefetch: true */ '../../settings/SettingsPanel'));
const SidebarToggle = lazy(() => import(/* webpackPrefetch: true */ '../SidebarToggle'));
const MoreActions = lazy(() => import(/* webpackPrefetch: true */ '../../common/MoreActions'));
const AuthButton = lazy(() => import(/* webpackPrefetch: true */ '../../auth/AuthButton')); // Import AuthButton

// Loading fallback component
const LoadingFallback = () => (
  <div className={styles.loadingFallback}>
    <Spinner size="medium" />
  </div>
);

/**
 * Layout component that handles responsive design
 * @returns {JSX.Element} - Rendered layout
 */
const Layout = () => {
  const isDesktop = useIsDesktop();
  // Default sidebar to open on desktop, closed on mobile initially
  const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktop); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // State for settings panel
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false); // State for model selector visibility
  const { selectedModel, isLoadingModels } = useModel(); // Get model data
  const { chatHistory, resetChat, downloadChatHistory } = useChat();
  const { currentUser, isAuthenticated, login, logout, loading: authLoading } = useAuth(); // Get auth context

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Toggle settings panel - passed down from MainContent originally, now managed here
  const toggleSettings = useCallback(() => {
    // console.log("Toggling settings panel..."); // Add log
    setIsSettingsOpen(prev => {
      // console.log("Previous state:", prev, "New state:", !prev); // Log state change
      return !prev;
    });
  }, []);

  const toggleModelSelector = useCallback(() => {
    setIsModelSelectorOpen(prev => !prev);
  }, []);

  // Implement new chat functionality
  const handleNewChat = useCallback(() => {
    resetChat();
    // Close sidebar on mobile after starting new chat
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  }, [resetChat, isDesktop]);

  // Implement reset chat functionality
  const handleResetChat = useCallback(() => {
    if (chatHistory.length === 0) return;
    
    if (window.confirm('Are you sure you want to clear the current chat?')) {
      resetChat();
    }
  }, [chatHistory.length, resetChat]);

  // Implement download chat functionality
  const handleDownloadChat = useCallback(() => {
    if (chatHistory.length === 0) return;
    downloadChatHistory();
  }, [chatHistory.length, downloadChatHistory]);
  
  // Determine layout classes based on state and viewport
  const isSidebarEffectivelyHidden = isDesktop && !isSidebarOpen;
  const layoutClasses = [
    styles.layout,
    isSidebarEffectivelyHidden ? styles.sidebarCompact : '', // Handles transform
    !isDesktop && isSidebarOpen ? styles.sidebarOpenMobile : '', // Mobile slide-in
    isSidebarEffectivelyHidden ? styles.sidebarHidden : '' // Controls floating icon visibility
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {/* Mobile Actions Container (Top Right) */}
      <div className={styles.mobileActionsContainer}>
        <div className={styles.mobileActions}>
          {/* Theme Toggle */}
          <Suspense fallback={null}>
            <ThemeToggle />
          </Suspense>
          
          {/* Auth Button */}
          <Suspense fallback={null}>
            <AuthButton 
              isAuthenticated={isAuthenticated}
              onLogin={login}
              onLogout={logout}
              userName={currentUser?.displayName || currentUser?.email || 'User'}
              isLoading={authLoading}
            />
          </Suspense>
          
          {/* Settings Button */}
          <button 
            className={styles.mobileActionButton} 
            onClick={toggleSettings}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon size={20} />
          </button>
          
          {/* More Actions Menu */}
          <MoreActions 
            actions={[
              {
                icon: <PlusIcon size={16} />,
                label: 'New Chat',
                onClick: handleNewChat
              },
              {
                icon: <TrashIcon size={16} />,
                label: 'Reset Chat',
                onClick: handleResetChat
              },
              {
                icon: <DownloadIcon size={16} />,
                label: 'Download Chat',
                onClick: handleDownloadChat
              }
            ]}
          />
        </div>
      </div>

      {/* Sidebar Toggle */}
      <Suspense fallback={<LoadingFallback />}>
        <SidebarToggle
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
        />
      </Suspense>

      {/* Conditionally render the ModelDropdown as a modal/overlay */}
      {isModelSelectorOpen && (
        <Suspense fallback={
          <div className={styles.modalOverlay}>
            <Spinner size="large" />
          </div>
        }>
           <div className={styles.modalOverlay} onClick={toggleModelSelector}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <ModelDropdown /> 
            </div>
          </div>
        </Suspense>
      )}

      {/* Sidebar container */}
      <div className={styles.sidebarContainer}>
        <Suspense fallback={<div className={styles.sidebarPlaceholder} />}>
          <Sidebar 
            onNewChat={handleNewChat}
            onToggleSettings={toggleSettings}
          />
        </Suspense>
      </div>
      
      {/* Main content container */}
      <div className={styles.mainContentContainer}>
        <Suspense fallback={<div className={styles.contentPlaceholder} />}>
          <MainContent 
            isSidebarOpen={isSidebarOpen} 
            toggleSidebar={toggleSidebar} 
            isSettingsOpen={isSettingsOpen} 
            toggleSettings={toggleSettings}
            selectedModel={selectedModel}
            isLoadingModels={isLoadingModels}
            toggleModelSelector={toggleModelSelector}
            onNewChat={handleNewChat}
            onToggleSettings={toggleSettings}
            onResetChat={handleResetChat}
            onDownloadChat={handleDownloadChat}
          />
        </Suspense>
      </div>

      {/* Mobile overlay */}
      {!isDesktop && isSidebarOpen && (
        <div 
          className={`${styles.overlay} ${styles.overlayVisible}`}
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Conditionally render Settings Panel */} 
      {/* Always render Settings Panel for CSS transitions, control visibility via props/classes */}
      <Suspense fallback={null}> {/* No visible fallback needed */}
        <SettingsPanel 
          isOpen={isSettingsOpen} 
          onClose={toggleSettings} 
        /> 
      </Suspense>
    </div>
  );
};

export default Layout; 