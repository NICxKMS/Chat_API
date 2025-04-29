import { lazy, Suspense } from 'react';
import styles from './MainContent.module.css';
import Spinner from '../../common/Spinner';

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
 * @param {Function} props.onNewChat - Function to handle new chat
 * @param {Function} props.onResetChat - Function to handle reset chat
 * @param {Function} props.onDownloadChat - Function to handle download chat
 * @param {Function} props.onToggleSettings - Function to handle settings toggle
 * @param {boolean} props.isSettingsOpen - Whether the settings panel is open
 * @param {boolean} props.isModelSelectorOpen - Whether the model selector is open
 * @returns {JSX.Element} - Rendered component
 */
const MainContent = ({ 
  isSidebarOpen, 
  toggleSidebar, 
  selectedModel,
  isLoadingModels,
  toggleModelSelector,
  onNewChat,
  onResetChat,
  onDownloadChat,
  onToggleSettings,
  isSettingsOpen,
  isModelSelectorOpen
}) => {
  return (
    <main className={styles.MainContent}>
      {/* Model Loading Indicator - shows only during initial model loading */}
      {isLoadingModels && (
        <div className={styles.MainContent__modelLoadingOverlay}>
          <div className={styles.MainContent__modelLoadingContent}>
            <Spinner size="medium" />
            <div className={styles.MainContent__modelLoadingText}>Loading models...</div>
          </div>
        </div>
      )}
      
      {/* Chat area - Pass all action handlers down */}
      <Suspense fallback={<div className={styles.MainContent__chatPlaceholder} />}>
        <ChatContainer 
          selectedModel={selectedModel}
          isLoadingModels={isLoadingModels}
          toggleModelSelector={toggleModelSelector}
          onNewChat={onNewChat}
          onResetChat={onResetChat}
          onDownloadChat={onDownloadChat}
          onToggleSettings={onToggleSettings}
          isSidebarOpen={isSidebarOpen}
          isSettingsOpen={isSettingsOpen}
          isModelSelectorOpen={isModelSelectorOpen}
        />
      </Suspense>
    </main>
  );
};

export default MainContent; 