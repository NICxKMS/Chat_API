import { lazy, useState, useCallback, Suspense } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import { useModel } from '../../../contexts/ModelContext';
import { useChatState } from '../../../contexts/ChatStateContext';
import { useChatControl } from '../../../contexts/ChatControlContext';
import { useAuth } from '../../../contexts/AuthContext'; // Import useAuth
import { useTheme } from '../../../contexts/ThemeContext'; // Import ThemeContext
import { GearIcon, PlusIcon, TrashIcon, DownloadIcon } from '@primer/octicons-react';
import styles from './Layout.module.css';
// Import icons using the correct paths
// Import only the specific icons needed


// Lazily loaded components - Prefetch hints removed for manual loading
const Sidebar = lazy(() => import(/* webpackChunkName: "layout-sidebar" */ '../Sidebar'));
const MainContent = lazy(() => import(/* webpackPreload: true, webpackChunkName: "layout-main" */ '../MainContent'));
const ModelDropdown = lazy(() => import(/* webpackChunkName: "models-dropdown" */ '../../models/ModelDropdown'));
const Spinner = lazy(() => import(/* webpackChunkName: "common-spinner" */ '../../common/Spinner'));
const ThemeToggle = lazy(() => import(/* webpackChunkName: "common-theme" */ '../../common/ThemeToggle'));
const SettingsPanel = lazy(() => import(/* webpackChunkName: "settings-panel" */ '../../settings/SettingsPanel'));
const SidebarToggle = lazy(() => import(/* webpackChunkName: "layout-sidebar-toggle" */ '../SidebarToggle'));
const MoreActions = lazy(() => import(/* webpackChunkName: "common-more-actions" */ '../../common/MoreActions'));
const AuthButton = lazy(() => import(/* webpackChunkName: "auth-button" */ '../../auth/AuthButton'));

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
  const { chatHistory } = useChatState();
  const { clearChat, downloadChatHistory } = useChatControl();
  const { currentUser, isAuthenticated, login, logout, loading: authLoading } = useAuth(); // Get auth context
  const { theme, toggleTheme } = useTheme(); // Get theme context

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
    // Close sidebar on mobile after starting new chat
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
    
    // Clear chat history if there are messages
    if (chatHistory.length > 0) {
      clearChat();
    }
  }, [isDesktop, chatHistory.length, clearChat]);

  // Implement reset chat functionality
  const handleResetChat = useCallback(() => {
    if (chatHistory.length === 0) return;
    
    if (window.confirm('Are you sure you want to clear the current chat?')) {
      clearChat();
      
      // Show confirmation to the user
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = 'var(--hover)';
      notification.style.color = 'var(--text)';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '8px';
      notification.style.zIndex = '9999';
      notification.textContent = 'Chat has been cleared';
      document.body.appendChild(notification);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }
  }, [chatHistory.length, clearChat]);

  // Implement download chat functionality
  const handleDownloadChat = useCallback(() => {
    if (chatHistory.length === 0) return;
    try {
      downloadChatHistory();
      
      // Show confirmation to the user (especially useful for mobile)
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = 'var(--hover)';
      notification.style.color = 'var(--text)';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '8px';
      notification.style.zIndex = '9999';
      notification.textContent = 'Chat downloaded successfully';
      document.body.appendChild(notification);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    } catch (error) {
      console.error("Error downloading chat:", error);
      alert("Failed to download chat. Please try again.");
    }
  }, [chatHistory.length, downloadChatHistory]);
  
  // Determine layout classes based on state and viewport
  const isSidebarEffectivelyHidden = isDesktop && !isSidebarOpen;
  const layoutClasses = [
    styles.Layout,
    isSidebarEffectivelyHidden ? styles.sidebarCompact : '', // Handles transform
    !isDesktop && isSidebarOpen ? styles.sidebarOpenMobile : '', // Mobile slide-in
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
              currentUser={currentUser}
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
            triggerButtonClassName={styles.mobileActionButton}
            actions={[
              // Always included actions
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
              },
              // Mobile-specific actions (will only be visible on mobile)
              ...(isDesktop ? [] : [
                // Theme toggle action
                {
                  icon: theme === 'dark' ? <span style={{ fontSize: '16px' }}>☀️</span> : <span style={{ fontSize: '16px' }}>🌙</span>,
                  label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
                  onClick: toggleTheme
                },
                // Settings action
                {
                  icon: <GearIcon size={16} />,
                  label: 'Settings',
                  onClick: toggleSettings
                },
                // Login/Logout action
                {
                  icon: isAuthenticated ? <span style={{ fontSize: '16px' }}>👤</span> : <span style={{ fontSize: '16px' }}>🔑</span>,
                  label: isAuthenticated ? `Logout (${currentUser?.displayName || currentUser?.email || 'User'})` : 'Login',
                  onClick: isAuthenticated ? logout : login
                }
              ])
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
        <div className={styles.Layout__modalOverlay} onClick={toggleModelSelector}>
          <div className={styles.Layout__modalContent} onClick={(e) => e.stopPropagation()}>
            <Suspense fallback={<LoadingFallback />}>
              <ModelDropdown onClose={toggleModelSelector} /> 
            </Suspense>
          </div>
        </div>
      )}

      {/* Sidebar container */}
      <div className={styles.Layout__sidebarContainer}>
        <Suspense fallback={<div className={styles.Layout__sidebarPlaceholder} />}>
          <Sidebar 
            onNewChat={handleNewChat}
            onToggleSettings={toggleSettings}
          />
        </Suspense>
      </div>
      
      {/* Main content container */}
      <div className={styles.Layout__mainContentContainer}>
        <Suspense fallback={<div className={styles.Layout__contentPlaceholder} />}>
          <MainContent 
            isSidebarOpen={isSidebarOpen} 
            toggleSidebar={toggleSidebar} 
            isSettingsOpen={isSettingsOpen} 
            toggleSettings={toggleSettings}
            selectedModel={selectedModel}
            isLoadingModels={isLoadingModels}
            toggleModelSelector={toggleModelSelector}
            isModelSelectorOpen={isModelSelectorOpen}
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
          className={`${styles.Layout__overlay} ${styles['Layout__overlay--visible']}`}
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