import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettingsController } from '../../../hooks/useSettingsController';
import { BooleanControl, SettingsSlider, TextAreaControl } from '..';
import { IconSlider, IconStream, IconClose, IconSystem } from '../icons';
import styles from './SettingsPanel.module.css';
import { default as SettingsSidebarOverlay } from '../SettingsSidebarOverlay';
import { useIsSettingsMobile } from '../../../hooks/useMediaQuery';

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
  const { settings, updateSetting, resetSettings, cacheEnabled, toggleCache, clearModelCache, currentUser } = useSettingsController();
  const [activeTab, setActiveTab] = useState('general');
  const [animateItems, setAnimateItems] = useState(false);
  
  // Use media query hook for mobile detection
  const isMobile = useIsSettingsMobile();
  // Ensure activeTab is not 'general' on mobile
  useEffect(() => {
    if (isMobile && activeTab === 'general') {
      setActiveTab('advanced');
    }
  }, [isMobile, activeTab]);
  
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
  const tabs = useMemo(() => [
    { id: 'general', label: 'General', icon: <IconStream /> },
    { id: 'advanced', label: 'Advanced', icon: <IconSlider /> },
    { id: 'system', label: 'System', icon: <IconSystem /> }
  ], []);

  // Show only Advanced & System tabs on mobile
  const visibleTabs = useMemo(
    () => (isMobile ? tabs.filter(tab => tab.id !== 'general') : tabs),
    [isMobile, tabs]
  );

  // Render a setting control based on its type
  const renderSettingControl = useCallback((settingId) => {
    const config = settingConfig[settingId];
    if (!config) return null;
    
    let value = settings[settingId];
    const itemClass = `${styles.settingItem} ${animateItems ? styles.animate : ''} ${settingId === 'systemPrompt' ? styles.fullHeight : ''}`;
    
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
  

  // Memoize the rendered settings components to avoid inline maps on each render

  // Add model cache toggle control
  const renderCacheToggle = useCallback(() => {
    const itemClass = `${styles.settingItem} ${animateItems ? styles.animate : ''}`;
    return (
      <div key="cache" className={itemClass}>
        <BooleanControl
          id="cacheEnabled"
          label="Enable Model Cache"
          isChecked={cacheEnabled}
          onChange={() => toggleCache()}
          tooltip="Toggle model caching to speed up repeated requests"
        />
      </div>
    );
  }, [cacheEnabled, toggleCache, animateItems]);

  // Add delete cache button control
  const renderClearCache = useCallback(() => {
    const itemClass = `${styles.settingItem} ${animateItems ? styles.animate : ''}`;
    return (
      <div key="clearCache" className={itemClass}>
        <div className={styles.settingHeader}>
          <div className={styles.settingLabel}>Delete Model Cache</div>
          <button
            className={styles.resetButton}
            onClick={() => clearModelCache()}
            title="Delete the stored model cache from localStorage"
          >
            Delete Cache
          </button>
        </div>
        <div className={styles.settingDescription}>
          Deletes the saved model cache so that fresh data will be fetched on next load.
        </div>
      </div>
    );
  }, [clearModelCache, animateItems]);

  // Render controls based on activeTab, adjusting for mobile layout
  const renderTabContent = () => {
    if (activeTab === 'general') {
      // Desktop only
      return [
        renderSettingControl('streaming'),
        renderCacheToggle(),
        renderClearCache(),
        renderSettingControl('max_tokens')
      ];
    }
    if (activeTab === 'advanced') {
      const advancedControls = [
        renderSettingControl('temperature'),
        renderSettingControl('top_p'),
        renderSettingControl('frequency_penalty'),
        renderSettingControl('presence_penalty')
      ];
      if (isMobile) {
        // On mobile, include streaming and max_tokens
        return [
          renderSettingControl('streaming'),
          renderSettingControl('max_tokens'),
          ...advancedControls
        ];
      }
      return advancedControls;
    }
    if (activeTab === 'system') {
      const systemControls = [renderSettingControl('systemPrompt')];
      if (isMobile) {
        // On mobile, show clear cache and cache toggle above system prompt
        return [renderClearCache(), renderCacheToggle(), ...systemControls];
      }
      return systemControls;
    }
    return null;
  };

  return (
    <SettingsSidebarOverlay isOpen={isOpen} onClose={onClose}>
      {/* Header with title and close button */}
      <div className={styles.header}>
        <h2 id="settings-title" className={styles.title}>Settings</h2>
        <button onClick={onClose} className={styles.closeButton} aria-label="Close settings">
          <IconClose />
        </button>
      </div>

      {/* Body wrapper: vertical on desktop, horizontal on mobile */}
      <div className={styles.bodyWrapper}>
        {/* Minimal horizontal tabs (become vertical on desktop) */}
        <nav className={styles.navTabs} role="tablist">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.navTab} ${activeTab === tab.id ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              <div className={styles.navTabContent}>
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span className={styles.tabLabel}>{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>
        {/* Simple stacked controls for the active tab */}
        <div className={styles.controlsContainer} role="tabpanel">
          {renderTabContent()}
        </div>
      </div>

      {/* Footer actions */}
      <div className={styles.footer}>
        <button onClick={resetSettings} className={styles.resetButton}>Reset to Defaults</button>
        <button onClick={onClose} className={styles.resetButton}>Done</button>
      </div>
    </SettingsSidebarOverlay>
  );
};

export default SettingsPanel; 