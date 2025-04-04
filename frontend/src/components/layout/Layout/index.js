import React, { lazy, Suspense, useState, useCallback } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import { useModel } from '../../../contexts/ModelContext';
import styles from './Layout.module.css';
import { PlusIcon, GearIcon, TrashIcon, DownloadIcon } from '@primer/octicons-react';

// Lazily loaded components for better initial load performance
const Sidebar = lazy(() => import('../Sidebar'));
const MainContent = lazy(() => import('../MainContent'));
// import ModelSelectorButton from '../../models/ModelSelectorButton'; // Remove this import
const ModelDropdown = lazy(() => import('../../models/ModelDropdown'));
const Spinner = lazy(() => import('../../common/Spinner')); // Import Spinner
const ThemeToggle = lazy(() => import('../../common/ThemeToggle')); // Import for floating icons
const ApiStatus = lazy(() => import('../../common/ApiStatus')); // Import for floating icons

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
    // TODO: Need actual implementation or state lift
  }, []);

  // Placeholder handlers for Reset/Download (NEED ACTUAL IMPLEMENTATION)
  const handleResetChat = useCallback(() => {
    console.warn("Reset Chat clicked - No implementation in Layout!");
    // TODO: Needs connection to chat logic (e.g., via context or state lift)
  }, []);

  const handleDownloadChat = useCallback(() => {
    console.warn("Download Chat clicked - No implementation in Layout!");
    // TODO: Needs connection to chat logic (e.g., via context or state lift)
  }, []);
  
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
      {/* Position the Model Selector Button above other content - REMOVED */}
      {/* <div className={styles.modelSelectorContainer}>
        <Suspense fallback={null}> 
          <ModelSelectorButton 
            selectedModelName={selectedModel?.name}
            onClick={toggleModelSelector}
            disabled={isLoadingModels} // Disable if models are loading
          />
        </Suspense>
      </div> */}

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
            // Pass only props needed BY the sidebar itself (if any remain)
            // onNewChat={handleNewChat} // Removed, handled by floating button
            // onToggleSettings={toggleSettings} // Removed, handled by floating button
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
          // Pass model button related props
          selectedModel={selectedModel}
          isLoadingModels={isLoadingModels}
          toggleModelSelector={toggleModelSelector}
          /* Pass handlers for menu */
          onNewChat={handleNewChat}
          onToggleSettings={toggleSettings}
          // Pass placeholder handlers (for now)
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

      {/* PERMANENT Floating Icons Container (Bottom Right) */}
      <div className={styles.floatingIconsContainer}> {/* Always rendered now */} 
        {/* New Chat Button */}
        <button 
          className={styles.floatingIconButton}
          onClick={handleNewChat}
          title="Start a new chat"
          aria-label="Start a new chat"
        >
          <PlusIcon size={20} />
        </button>
        {/* Download Button - ADDED */}
        <button 
          className={styles.floatingIconButton}
          onClick={handleDownloadChat} // Use placeholder handler
          title="Download chat history"
          aria-label="Download chat history"
          // TODO: Add disabled logic if needed (e.g., based on chat messages)
        >
          <DownloadIcon size={20} />
        </button>
        {/* Clear Chat Button - ADDED */}
        <button 
          className={styles.floatingIconButton}
          onClick={handleResetChat} // Use placeholder handler
          title="Clear chat history"
          aria-label="Clear chat history"
          // TODO: Add disabled logic if needed (e.g., based on chat messages)
        >
          <TrashIcon size={20} />
        </button>
        {/* Theme Toggle Button */}
        <Suspense fallback={null}> 
          <div className={styles.floatingIconButton}> 
            <ThemeToggle />
          </div>
        </Suspense>
        {/* Settings Button */}
        <button 
          className={styles.floatingIconButton}
          onClick={toggleSettings}
          title="Settings"
          aria-label="Open settings panel"
        >
          <GearIcon size={20} />
        </button>
        {/* API Status Removed from here */}
      </div>

      {/* Floating API Status (Bottom Left - Conditionally Visible) */}
      <div className={styles.apiStatusFloatingContainer}> {/* Visibility controlled by .sidebarHidden class */} 
        <Suspense fallback={null}>
          {/* You might want a different style than floatingIconButton */}
          {/* For now, wrap in div for positioning */}
          <div> 
            <ApiStatus isFloating={true} /> 
          </div>
        </Suspense>
      </div>
    </div>
  );
};

export default Layout; 