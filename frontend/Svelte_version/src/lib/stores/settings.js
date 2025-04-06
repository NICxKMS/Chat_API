import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Default settings
const DEFAULT_SETTINGS = {
  streamingEnabled: true,
  metricsEnabled: true,
  fontSize: 'medium', // small, medium, large
  codeBlockTheme: 'dark-plus', // Syntax highlighting theme
  showTimestamps: true,
  apiResponseFormat: 'markdown' // markdown, text, code
};

// Create a function to initialize the settings store
function createSettingsStore() {
  // Load settings from localStorage if available
  let initialSettings = DEFAULT_SETTINGS;
  
  if (browser) {
    try {
      const savedSettings = localStorage.getItem('chatSettings');
      if (savedSettings) {
        initialSettings = {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(savedSettings)
        };
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    }
  }
  
  const { subscribe, set, update } = writable(initialSettings);
  
  return {
    subscribe,
    
    // Update a single setting
    updateSetting: (key, value) => {
      update(settings => {
        const updatedSettings = { ...settings, [key]: value };
        
        // Save to localStorage
        if (browser) {
          try {
            localStorage.setItem('chatSettings', JSON.stringify(updatedSettings));
          } catch (error) {
            console.error('Error saving settings to localStorage:', error);
          }
        }
        
        return updatedSettings;
      });
    },
    
    // Update multiple settings at once
    updateSettings: (newSettings) => {
      update(settings => {
        const updatedSettings = { ...settings, ...newSettings };
        
        // Save to localStorage
        if (browser) {
          try {
            localStorage.setItem('chatSettings', JSON.stringify(updatedSettings));
          } catch (error) {
            console.error('Error saving settings to localStorage:', error);
          }
        }
        
        return updatedSettings;
      });
    },
    
    // Reset settings to defaults
    resetSettings: () => {
      set(DEFAULT_SETTINGS);
      
      if (browser) {
        try {
          localStorage.setItem('chatSettings', JSON.stringify(DEFAULT_SETTINGS));
        } catch (error) {
          console.error('Error saving settings to localStorage:', error);
        }
      }
    }
  };
}

// Create and export the settings store
export const settings = createSettingsStore();