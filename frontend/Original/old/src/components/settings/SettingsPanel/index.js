import { memo, lazy } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useModel } from '../../../contexts/ModelContext';
import styles from './SettingsPanel.module.css';

// Lazy load settings controls for performance
const SettingsSlider = lazy(() => import('../SettingsSlider'));
const SettingsToggle = lazy(() => import('../SettingsToggle'));

/**
 * Panel for adjusting chat settings
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {Function} props.onClose - Function to close the panel
 * @returns {JSX.Element} - Rendered component
 */
const SettingsPanel = memo(({ isOpen, onClose }) => {
  const { settings, updateSetting, shouldRestrictTemperature } = useSettings();
  const { selectedModel } = useModel();
  
  // Check if temperature should be restricted based on model
  const isTemperatureRestricted = shouldRestrictTemperature(selectedModel);
  
  return (
    <div className={`${styles.settingsPanel} ${isOpen ? styles.open : ''}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>Settings</h2>
        <button 
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close settings"
        >
          <CloseIcon className={styles.closeIcon} />
        </button>
      </div>
      
      <div className={styles.content}>
        <Suspense fallback={<div className={styles.settingsPlaceholder} />}>
          {/* Temperature slider */}
          <SettingsSlider 
            id="temperature"
            label="Temperature"
            value={settings.temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={value => updateSetting('temperature', value)}
            disabled={isTemperatureRestricted}
            tooltip={isTemperatureRestricted 
              ? "This model requires temperature set to 1.0" 
              : "Controls randomness: Lower values are more deterministic, higher values more creative"}
          />
          
          {/* Top-P slider */}
          <SettingsSlider 
            id="top_p"
            label="Top P"
            value={settings.top_p}
            min={0}
            max={1}
            step={0.05}
            onChange={value => updateSetting('top_p', value)}
            tooltip="Nucleus sampling: Only consider tokens with this top probability mass"
          />
          
          {/* Max tokens slider */}
          <SettingsSlider 
            id="max_tokens"
            label="Max Tokens"
            value={settings.max_tokens}
            min={100}
            max={4000}
            step={100}
            onChange={value => updateSetting('max_tokens', value)}
            tooltip="Maximum number of tokens to generate"
          />
          
          {/* Frequency penalty slider */}
          <SettingsSlider 
            id="frequency_penalty"
            label="Frequency Penalty"
            value={settings.frequency_penalty}
            min={0}
            max={2}
            step={0.1}
            onChange={value => updateSetting('frequency_penalty', value)}
            tooltip="Penalize repeated tokens: Higher values reduce repetition"
          />
          
          {/* Presence penalty slider */}
          <SettingsSlider 
            id="presence_penalty"
            label="Presence Penalty"
            value={settings.presence_penalty}
            min={0}
            max={2}
            step={0.1}
            onChange={value => updateSetting('presence_penalty', value)}
            tooltip="Penalize tokens that already appeared: Higher values encourage more diverse topics"
          />
        </Suspense>
      </div>
    </div>
  );
});

// Close icon component
const CloseIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Display name for debugging
SettingsPanel.displayName = 'SettingsPanel';

export default SettingsPanel; 