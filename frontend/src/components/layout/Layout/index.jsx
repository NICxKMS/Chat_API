import { lazy, useState, useCallback, Suspense } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import { useModel } from '../../../contexts/ModelContext';
import { useAuth } from '../../../contexts/AuthContext'; // Import useAuth
import { useTheme } from '../../../contexts/ThemeContext'; // Import ThemeContext
import { GearIcon, SignInIcon } from '@primer/octicons-react';
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

  // Lazy-load placeholder logic for AuthButton
  const [authLoaded, setAuthLoaded] = useState(false);
  const handleAuthPlaceholderClick = useCallback(() => {
    setAuthLoaded(true);
    login();
  }, [login]);

  // Determine layout classes based on state and viewport
  const isSidebarEffectivelyHidden = isDesktop && !isSidebarOpen;
  const layoutClasses = [
    styles.Layout,
    isSidebarEffectivelyHidden ? styles['Layout--sidebarCompact'] : '', // Handles transform
    !isDesktop && isSidebarOpen ? styles['Layout--sidebarOpenMobile'] : '', // Mobile slide-in
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {/* Mobile Actions Container (Top Right) */}
      <div className={styles.Layout__mobileActionsContainer}>
        <div className={styles.Layout__mobileActions}>
          {/* Theme Toggle */}
          <Suspense fallback={null}>
            <ThemeToggle />
          </Suspense>
          
          {/* Auth Button placeholder: show generic icon, load AuthButton on click */}
          {authLoaded ? (
            <Suspense fallback={
              <button className={styles.Layout__mobileActionButton} disabled aria-label="Loading Authentication">
                <SignInIcon size={20} />
              </button>
            }>
              <AuthButton 
                isAuthenticated={isAuthenticated}
                onLogin={login}
                onLogout={logout}
                userName={currentUser?.displayName || currentUser?.email || 'User'}
                isLoading={authLoading}
                currentUser={currentUser}
              />
            </Suspense>
          ) : (
            <button
              className={styles.Layout__mobileActionButton}
              onClick={handleAuthPlaceholderClick}
              aria-label="Login"
              title="Login or Sign Up"
            >
              <SignInIcon size={20} />
            </button>
          )}
          
          {/* Settings Button */}
          <button 
            className={styles.Layout__mobileActionButton} 
            onClick={toggleSettings}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon size={20} />
          </button>
          
          {/* More Actions Menu - Now pass only additional actions */}
          <MoreActions 
            triggerButtonClassName={styles.Layout__mobileActionButton}
            actions={ // Pass only the mobile-specific actions now
              isDesktop ? [] : [
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
              ]
            }
          />
        </div>
      </div>

      {/* Sidebar Toggle (floating) - only when sidebar is closed */}
      {!isSidebarOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <SidebarToggle
            isOpen={isSidebarOpen}
            onToggle={toggleSidebar}
          />
        </Suspense>
      )}

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
      {isSidebarOpen && (
        <div className={styles.Layout__sidebarContainer}>
          <Suspense fallback={<div className={styles.Layout__sidebarPlaceholder} />}>
            <Sidebar 
              onToggleSettings={toggleSettings}
              onToggleSidebar={toggleSidebar}
            />
          </Suspense>
        </div>
      )}
      
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
            onToggleSettings={toggleSettings}
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
      {/* Always mount SettingsPanel to enable CSS transitions on open/close */}
      <Suspense fallback={null}>
        <SettingsPanel 
          isOpen={isSettingsOpen} 
          onClose={toggleSettings} 
        />
      </Suspense>
    </div>
  );
};

export default Layout; 