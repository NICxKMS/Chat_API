import { lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import styles from './MainContent.module.css';

// Lazily loaded components
const ChatContainer = lazy(() => import(/* webpackChunkName: "chat-container" */ '../../chat/ChatContainer'));

/**
 * Main content area component containing chat interface and settings
 * @param {Object} props - Component props
 * @param {boolean} props.isSidebarOpen - Whether the sidebar is open (mobile)
 * @param {Function} props.toggleSidebar - Function to toggle the sidebar (mobile)
 * @param {Object} props.selectedModel - The currently selected model object
 * @param {boolean} props.isLoadingModels - Whether models are currently loading
 * @param {Function} props.toggleModelSelector - Function to toggle the model dropdown/modal
 * @param {Function} props.onToggleSettings - Function to handle settings toggle
 * @param {boolean} props.isSettingsOpen - Whether the settings panel is open
 * @param {boolean} props.isModelSelectorOpen - Whether the model selector is open
 * @returns {JSX.Element} - Rendered component
 */
const MainContent = ({ 
  isSidebarOpen, 
  selectedModel = null,
  toggleModelSelector,
  onToggleSettings,
  isSettingsOpen,
  isModelSelectorOpen
}) => {
  return (
    <main className={styles.MainContent}>
      {/* Removed full-screen model loading overlay; spinner moved to ModelSelectorButton */}
      
      {/* Chat area - Pass down remaining relevant props */}
      <Suspense fallback={<div className={styles.MainContent__chatPlaceholder} />}>
        <ChatContainer 
          selectedModel={selectedModel}
          toggleModelSelector={toggleModelSelector}
          onToggleSettings={onToggleSettings}
          isSidebarOpen={isSidebarOpen}
          isSettingsOpen={isSettingsOpen}
          isModelSelectorOpen={isModelSelectorOpen}
        />
      </Suspense>
    </main>
  );
};

MainContent.propTypes = {
  isSidebarOpen: PropTypes.bool.isRequired,
  toggleSidebar: PropTypes.func.isRequired,
  selectedModel: PropTypes.object, // Could refine shape if known
  toggleModelSelector: PropTypes.func.isRequired,
  onToggleSettings: PropTypes.func.isRequired,
  isSettingsOpen: PropTypes.bool.isRequired,
  isModelSelectorOpen: PropTypes.bool.isRequired
};

export default MainContent; 