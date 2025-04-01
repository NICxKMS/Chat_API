import React, { createContext, useContext, useState, useCallback } from 'react';

// Default settings values
const DEFAULT_SETTINGS = {
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: 2000,
  frequency_penalty: 0,
  presence_penalty: 0,
  stream: true
};

// Create settings context
const SettingsContext = createContext();

// Custom hook for using settings
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Settings provider component
export const SettingsProvider = ({ children }) => {
  // Initialize settings state with defaults
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  // Handle individual setting updates
  const updateSetting = useCallback((key, value) => {
    if (key in DEFAULT_SETTINGS) {
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
    }
  }, []);
  
  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);
  
  // Check if temperature should be restricted based on model name/series
  const shouldRestrictTemperature = useCallback((model) => {
    if (!model) return false;
    
    const modelId = model.id?.toLowerCase() || '';
    const modelName = model.name?.toLowerCase() || '';
    const modelSeries = model.series?.toLowerCase() || '';
    
    // Check if model name or series starts with 'o'
    return modelId.startsWith('o') || 
           modelName.startsWith('o') || 
           modelSeries.startsWith('o');
  }, []);
  
  // Get current settings with potential model-specific overrides
  const getModelAdjustedSettings = useCallback((model) => {
    if (shouldRestrictTemperature(model)) {
      return {
        ...settings,
        temperature: 1.0
      };
    }
    return settings;
  }, [settings, shouldRestrictTemperature]);
  
  // Context value
  const value = {
    settings,
    updateSetting,
    resetSettings,
    shouldRestrictTemperature,
    getModelAdjustedSettings
  };
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 