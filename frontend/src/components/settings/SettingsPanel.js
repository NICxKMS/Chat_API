import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCacheToggle } from '../../hooks/useCacheToggle';
import { useAuth } from '../../contexts/AuthContext';
import { BooleanControl, SettingsSlider, SettingsGroup, TextAreaControl } from './index';
import { 
  IconSlider, 
  IconStream, 
  IconCache, 
  IconOutput, 
  IconRepeat, 
  IconClose, 
  IconRefresh
} from './icons';
import { IconSystem } from './icons.js';
import styles from './SettingsPanel.module.css';

/**
 * Main settings panel component 
 * Provides UI for adjusting application settings
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the panel is visible
 * @param {Function} props.onClose - Function to call to close the panel
 * @returns {JSX.Element} - Rendered component
 */
const SettingsPanel = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { cacheEnabled, toggleCache, refreshModels } = useCacheToggle();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [animateItems, setAnimateItems] = useState(false);
  
  // Get the default user name to use consistently throughout the app
  const userName = currentUser?.displayName || currentUser?.email || 'Sir';
  
  // Animation handling
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setAnimateItems(true), 300);
      return () => clearTimeout(timer);
    } else {
      setAnimateItems(false);
      setTimeout(() => setActiveTab('general'), 300);
    }
  }, [isOpen]);

  // Setting configuration
  const settingConfig = useMemo(() => ({
    temperature: { 
      id: 'temperature',
      label: 'Temperature',
      type: 'slider', 
      min: 0, 
      max: 2, 
      step: 0.01,
      allowDirectInput: true,
      description: "Controls text randomness. Lower values make responses more focused and deterministic, higher values more creative.",
      tab: 'generation'
    },
    top_p: { 
      id: 'top_p',
      label: 'Top P',
      type: 'slider', 
      min: 0, 
      max: 2, 
      step: 0.01,
      allowDirectInput: true,
      description: "Nucleus sampling parameter. Higher values consider more token options, lower values focus on most likely tokens.", 
      tab: 'generation'
    },
    max_tokens: { 
      id: 'max_tokens',
      label: 'Maximum Length',
      type: 'slider', 
      min: 1000, 
      max: 2000000, 
      step: 512,
      allowDirectInput: true,
      description: "Maximum number of tokens in model responses. Higher values allow longer outputs.",
      tab: 'output'
    },
    frequency_penalty: { 
      id: 'frequency_penalty',
      label: 'Frequency Penalty',
      type: 'slider', 
      min: 0, 
      max: 2, 
      step: 0.1,
      allowDirectInput: true,
      description: "Discourages repetition of the same words and phrases. Higher values produce more varied text.",
      tab: 'repetition'
    },
    presence_penalty: { 
      id: 'presence_penalty',
      label: 'Presence Penalty',
      type: 'slider', 
      min: 0, 
      max: 2, 
      step: 0.1,
      allowDirectInput: true,
      description: "Encourages the model to talk about new topics. Higher values discourage repeating themes.",
      tab: 'repetition'
    },
    streaming: {
      id: 'streaming',
      label: 'Enable Streaming',
      type: 'boolean',
      description: "Receive responses in real-time as they're generated instead of waiting for the complete reply.",
      tab: 'general'
    },
    systemPrompt: {
      id: 'systemPrompt',
      label: 'System Prompt',
      type: 'textarea',
      description: "Default instructions given to the AI at the start of every conversation. Used to guide the AI's behavior and capabilities.",
      placeholder: "You are a helpful AI assistant...",
      tab: 'system'
    }
  }), []);

  // Tab definitions
  const tabs = [
    { id: 'general', label: 'General', icon: <IconStream /> },
    { id: 'system', label: 'System', icon: <IconSystem /> },
    { id: 'generation', label: 'Generation', icon: <IconSlider /> },
    { id: 'output', label: 'Output', icon: <IconOutput /> },
    { id: 'repetition', label: 'Repetition', icon: <IconRepeat /> }
  ];

  // Render a setting control based on its type
  const renderSettingControl = useCallback((settingId) => {
    const config = settingConfig[settingId];
    if (!config) return null;
    
    let value = settings[settingId];
    const itemClass = `${styles.settingItem} ${animateItems ? styles.animate : ''}`;
    
    // If this is the system prompt, customize it with the user's name
    if (settingId === 'systemPrompt') {
      // Don't modify the actual stored settings, just what's displayed
      value = value.replace(/Nikhil/g, userName);
    }
    
    switch (config.type) {
      case 'boolean':
        return (
          <div key={config.id} className={itemClass}>
            <BooleanControl
              id={config.id}
              label={config.label}
              isChecked={value}
              onChange={val => updateSetting(config.id, val)}
              tooltip={config.description}
            />
          </div>
        );
        
      case 'slider':
        return (
          <div key={config.id} className={itemClass}>
            <SettingsSlider
              id={config.id}
              label={config.label}
              value={value}
              min={config.min}
              max={config.max}
              step={config.step}
              onChange={val => updateSetting(config.id, val)}
              tooltip={config.description}
              allowDirectInput={config.allowDirectInput}
            />
          </div>
        );
        
      case 'textarea':
        return (
          <div key={config.id} className={itemClass}>
            <TextAreaControl
              id={config.id}
              label={config.label}
              value={value}
              onChange={(val) => {
                if (config.id === 'systemPrompt') {
                  const standardizedVal = val.replace(new RegExp(userName, 'g'), 'Nikhil');
                  updateSetting(config.id, standardizedVal);
                } else {
                  updateSetting(config.id, val);
                }
              }}
              tooltip={config.description}
              placeholder={config.placeholder}
            />
          </div>
        );
        
      default:
        return null;
    }
  }, [settingConfig, settings, animateItems, userName, updateSetting]);
  
  // Compute active settings for the current tab and memoize
  const activeSettings = useMemo(
    () => Object.keys(settingConfig).filter(
      key => settingConfig[key].tab === activeTab
    ),
    [activeTab, settingConfig]
  );
  // Memoize the rendered settings components to avoid inline maps on each render
  const renderedSettings = useMemo(
    () => activeSettings.map((settingId, index) => (
      <div key={settingId} style={{ animationDelay: `${index * 50}ms` }}>
        {renderSettingControl(settingId)}
      </div>
    )),
    [activeSettings, renderSettingControl]
  );

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`${styles['SettingsPanel__overlay']} ${isOpen ? styles['SettingsPanel__overlay--open'] : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Settings panel */}
      <div 
        className={`${styles.SettingsPanel} ${isOpen ? styles['SettingsPanel--open'] : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="settings-title" className={styles.title}>Settings</h2>
          
          {/* User Profile Section */}
          {currentUser && (
            <div className={styles.userProfile}>
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={`${userName}'s profile`}
                  className={styles.userAvatar}
                />
              ) : (
                <div className={styles.userInitial}>
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={styles.userName}>{userName}</span>
            </div>
          )}
          
          <button 
            onClick={onClose} 
            className={styles.closeButton} 
            aria-label="Close settings"
            title="Close settings"
          >
            <IconClose />
          </button>
        </div>
        
        {/* Tab navigation */}
        <div className={styles.tabsContainer}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
              title={tab.label}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>
        
        {/* Content area */}
        <div className={styles.content}>
          {/* Conditional rendering based on active tab */}
          {activeTab === 'general' && (
            <SettingsGroup title="General Settings">
              {/* Custom toggle for streaming */}
              {renderSettingControl('streaming')}
              
              {/* Model cache section */}
              <div className={`${styles.settingItem} ${animateItems ? styles.animate : ''}`} style={{ animationDelay: '100ms' }}>
                <div className={styles.settingHeader}>
                  <div className={styles.headingWithIcon}>
                    <IconCache />
                    <label className={styles.settingLabel}>Model Caching</label>
                  </div>
                </div>
                <BooleanControl
                  id="modelCache"
                  label="Enable Model Cache"
                  isChecked={cacheEnabled}
                  onChange={toggleCache}
                  tooltip="Store model data in your browser to reduce API calls and improve loading times."
                />
                <button 
                  onClick={refreshModels} 
                  className={styles.refreshButton}
                  disabled={!cacheEnabled}
                >
                  <IconRefresh /> Refresh Model Data
                </button>
              </div>
            </SettingsGroup>
          )}
          
          {/* Other tabs */}
          {activeTab !== 'general' && (
            <SettingsGroup title={`${tabs.find(t => t.id === activeTab)?.label} Settings`}>
              {renderedSettings}
            </SettingsGroup>
          )}
        </div>
        
        {/* Footer */}
        <div className={styles.footer}>
          <button 
            onClick={resetSettings} 
            className={styles.resetButton}
            aria-label="Reset all settings to default values"
          >
            Reset to Defaults
          </button>
          <button 
            onClick={onClose} 
            className={styles.applyButton}
            aria-label="Save settings and close panel"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel; 