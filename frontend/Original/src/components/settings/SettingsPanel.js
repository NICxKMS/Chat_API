import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCacheToggle } from '../../hooks/useCacheToggle';
import styles from './SettingsPanel.module.css';
import { IoMdClose } from 'react-icons/io';
import SettingsSwitch from './SettingsSwitch';

const SettingsPanel = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { cacheEnabled, toggleCache, refreshModels } = useCacheToggle();

  // Direct handler for input changes
  const handleChange = (event) => {
    const { name, value, type } = event.target;
    // Convert to number for range/number inputs
    const newValue = type === 'range' || type === 'number' ? Number(value) : value;
    updateSetting(name, newValue);
  };

  // Use CSS transitions based on isOpen prop instead of returning null
  // if (!isOpen) {
  //   return null; 
  // }

  return (
    <div 
      className={`${styles.panelOverlay} ${isOpen ? styles.panelOverlayOpen : ''}`}
      onClick={onClose} 
      aria-hidden={!isOpen}
    >
      <div 
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className={styles.header}>
          <h2 id="settings-title">Settings</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close settings">
            <IoMdClose />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Adjust global model parameters for chat responses.
          </p>

          {/* Streaming Toggle */}
          <div className={styles.settingItem}>
            <SettingsSwitch
              id="streaming"
              label="Enable Streaming"
              isChecked={settings.streaming}
              onChange={(value) => updateSetting('streaming', value)}
              tooltip="Enable streaming responses as they are generated"
            />
            <p className={styles.descriptionText}>Receive chat responses in real-time as they are generated.</p>
          </div>

          {/* Model Cache Toggle */}
          <div className={styles.settingItem}>
            <SettingsSwitch
              id="modelCache"
              label="Enable Model Caching"
              isChecked={cacheEnabled}
              onChange={toggleCache}
              tooltip="Cache model data locally to improve loading times"
            />
            <p className={styles.descriptionText}>Store model data in your browser to reduce API calls and improve loading times.</p>
            <button 
              onClick={refreshModels} 
              className={`${styles.resetButton} ${styles.refreshButton}`}
              style={{ marginTop: '8px', padding: '4px 8px' }}
              disabled={!cacheEnabled}
            >
              Refresh Model Data
            </button>
          </div>

          {/* Map over settings object to create controls */}
          {Object.entries(settings).map(([key, value]) => {
            // Skip streaming setting as it's handled above
            if (key === 'streaming') return null;
            
            // Define input properties based on the setting key
            let inputProps = {
              type: 'number', // Default to number
              min: undefined,
              max: undefined,
              step: undefined,
              className: styles.inputNumber,
            };
            let label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Simple title case
            let description = '';

            switch (key) {
              case 'temperature':
                inputProps = { ...inputProps, type: 'range', min: 0, max: 2, step: 0.01, className: styles.inputRange };
                description = "Controls randomness (0=deterministic, 2=very random).";
                break;
              case 'max_tokens':
                inputProps = { ...inputProps, min: 1, max: 8192, step: 1 }; // Allow wider range
                 description = "Max response length.";
                break;
              case 'top_p':
                inputProps = { ...inputProps, type: 'range', min: 0, max: 1, step: 0.01, className: styles.inputRange };
                 description = "Nucleus sampling threshold.";
                break;
              case 'frequency_penalty':
              case 'presence_penalty':
                inputProps = { ...inputProps, type: 'range', min: -2, max: 2, step: 0.01, className: styles.inputRange };
                 description = `Penalty for ${key === 'frequency_penalty' ? 'repeated' : 'present'} tokens.`;
                break;
              default:
                // Skip unknown settings or handle differently
                return null;
            }

            return (
              <div key={key} className={styles.settingItem}>
                <div className={styles.labelRow}>
                  <label htmlFor={key} className={styles.label}>{label}</label>
                  {/* Display value next to label */}
                  <span className={styles.valueDisplay}>
                    {typeof value === 'number' ? value.toFixed(inputProps.step < 1 ? 2 : 0) : value}
                  </span>
                </div>
                <input
                  id={key}
                  name={key}
                  value={value}
                  onChange={handleChange}
                  {...inputProps} // Spread type, min, max, step, className
                />
                {description && <p className={styles.descriptionText}>{description}</p>}
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <button onClick={resetSettings} className={styles.resetButton}>
            Reset Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel; 