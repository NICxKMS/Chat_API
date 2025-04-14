import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Default settings values
const DEFAULT_SETTINGS = {
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: 8191,
  frequency_penalty: 0,
  presence_penalty: 0,
  streaming: true
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
    // Ensure the key is a valid setting we manage
    if (key in DEFAULT_SETTINGS) {
      // console.log(`[SettingsContext] Updating '${key}' from ${settings[key]} to ${value}`);
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
    }
  }, []);
  
  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    // console.log("[SettingsContext] Resetting settings to default");
    setSettings(DEFAULT_SETTINGS);
  }, []);
  
  // Check if temperature should be restricted based on model name/series
  const shouldRestrictTemperature = useCallback((model) => {
    if (!model) return false;
    
    // More explicit flag checking for temperature restriction
    // Check for specific model properties that indicate temperature restriction
    return (
      model.requiresFixedTemperature === true || 
      (model.properties && model.properties.includes('fixed_temperature')) ||
      (model.id && model.id.toLowerCase().startsWith('o')) ||
      (model.series && model.series.toLowerCase() === 'o-series')
    );
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
  
  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    settings,
    updateSetting,
    resetSettings,
    shouldRestrictTemperature,
    getModelAdjustedSettings
  }), [
    settings,
    updateSetting, 
    resetSettings, 
    shouldRestrictTemperature, 
    getModelAdjustedSettings
  ]);
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 