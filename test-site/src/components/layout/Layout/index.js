import React, { lazy, Suspense, useState, useCallback } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import { useModel } from '../../../contexts/ModelContext';
import styles from './Layout.module.css';

// Lazily loaded components for better initial load performance
const Sidebar = lazy(() => import('../Sidebar'));
const MainContent = lazy(() => import('../MainContent'));
const ModelSelectorButton = lazy(() => import('../../models/ModelSelectorButton'));
const ModelDropdown = lazy(() => import('../../models/ModelDropdown'));
const Spinner = lazy(() => import('../../common/Spinner')); // Import Spinner

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

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Toggle settings panel - passed down from MainContent originally, now managed here
  const toggleSettings = useCallback(() => {
    setIsSettingsOpen(prev => !prev);
  }, []);

  const toggleModelSelector = useCallback(() => {
    setIsModelSelectorOpen(prev => !prev);
  }, []);

  // Placeholder for new chat functionality
  const handleNewChat = useCallback(() => {
    console.log("New Chat clicked!");
    // TODO: Implement new chat logic (e.g., reset chat context, assign new ID)
  }, []);
  
  // Determine layout classes based on state and viewport
  const layoutClasses = [
    styles.layout,
    isDesktop ? (isSidebarOpen ? '' : styles.sidebarCompact) : '', // Compact class for desktop
    !isDesktop && isSidebarOpen ? styles.sidebarOpenMobile : '' // Open class for mobile
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {/* Position the Model Selector Button above other content */}
      <div className={styles.modelSelectorContainer}>
        <Suspense fallback={null}> 
          <ModelSelectorButton 
            selectedModelName={selectedModel?.name}
            onClick={toggleModelSelector}
            disabled={isLoadingModels} // Disable if models are loading
          />
        </Suspense>
      </div>

      {/* Conditionally render the ModelDropdown as a modal/overlay */}
      {isModelSelectorOpen && (
        <Suspense fallback={
          <div className={styles.modalOverlay}>
            <Spinner size="large" /> {/* Use Spinner in modal fallback */} 
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
            // Pass isCompact prop if Sidebar needs to adjust its content
            isCompact={isDesktop && !isSidebarOpen} 
          onNewChat={handleNewChat} // Pass new chat handler
          onToggleSettings={toggleSettings} // Pass settings toggle handler
        /> 
      </Suspense>
      </div>
      
      {/* Main content container */}
      <div className={styles.mainContentContainer}>
      <Suspense fallback={<div className={styles.contentPlaceholder} />}>
        <MainContent 
            // Pass toggleSidebar for mobile button
          isSidebarOpen={isSidebarOpen} 
          toggleSidebar={toggleSidebar} 
          // Pass settings state and toggle function to MainContent
          isSettingsOpen={isSettingsOpen} 
          toggleSettings={toggleSettings}
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
    </div>
  );
};

export default Layout; 