import { memo, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatControls.module.css';
import { useSettings } from '../../../contexts/SettingsContext';

// Restore lazy loads
const ThemeToggle = lazy(() => import('../../common/ThemeToggle'));

/**
 * Chat control buttons
 * @param {Object} props - Component props
 * @param {boolean} props.isGenerating - Whether AI is generating a response
 * @param {Function} props.onReset - Clear chat function
 * @param {Function} props.onDownload - Download chat function
 * @param {boolean} props.hasMessages - Whether there are messages in the chat
 * @param {Function} [props.onNewChat] - Function to call for New Chat
 * @param {Function} [props.onToggleSettings] - Function to call for Settings
 * @returns {JSX.Element} - Rendered component
 */
const ChatControls = memo(({ 
  isGenerating, 
  onReset, 
  onDownload, 
  hasMessages, 
  onNewChat, 
  onToggleSettings
}) => {
  // Get settings to check if streaming is enabled
  const { settings } = useSettings();
  
  return (
    <div className={styles.controls}>
      {/* Streaming Indicator */}
      {settings.streaming && (
        <div className={styles.streamingIndicator} title="Streaming is on">
          <span className={styles.streamingDot}></span>
        </div>
      )}
      
      {/* Mobile menu removed */}
    </div>
  );
});

ChatControls.propTypes = {
  isGenerating: PropTypes.bool,
  onReset: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  hasMessages: PropTypes.bool,
  onNewChat: PropTypes.func,
  onToggleSettings: PropTypes.func,
};

ChatControls.displayName = 'ChatControls';

export default ChatControls; 