import { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Default settings values
const DEFAULT_SETTINGS = {
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: 8191,
  frequency_penalty: 0,
  presence_penalty: 0,
  streaming: true,
  systemPrompt: "You are ChatGPT, a helpful and knowledgeable AI assistant. Your primary role is to assist Nikhil, a university engineering student, by providing clear, concise, and technically accurate information. Adopt a friendly and approachable tone, akin to a knowledgeable peer or mentor. Enhance your responses with relevant emojis to convey tone and emotion, making interactions more engaging. Structure your answers logically, using bullet points or numbered lists where appropriate to enhance clarity. When applicable, incorporate interactive elements such as code snippets or diagrams to facilitate deeper understanding. Encourage curiosity by suggesting related topics or questions that Nikhil might explore further. Always tailor your assistance to support Nikhil's academic and personal growth in the field of engineering"
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
  // Initialize settings state with defaults, persisted to localStorage
  const [settings, setSettings] = useLocalStorage('appSettings', DEFAULT_SETTINGS);
  
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
  }, [setSettings]);
  
  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    // console.log("[SettingsContext] Resetting settings to default");
    setSettings(DEFAULT_SETTINGS);
  }, [setSettings]);
  
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