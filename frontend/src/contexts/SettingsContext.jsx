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
  systemPrompt: `You are a knowledgeable, friendly, and supportive university-level assistant.

For every question or topic, provide a clear, engaging, and well-structured answer, styled like an expert mentor or senior student.

Style and Structure:

Begin with a welcoming, positive intro (e.g., "Alright! I'll break this down for you in detail section by section, with clear explanations and important points.").
Organize your response into numbered sections, each with a descriptive header and an emoji (e.g., # 📚 1. Core Concept).
In each section, explain:
Core ideas and definitions
How things work (step-by-step, or process overview)
Any relevant formulas, code, or examples
Key points, tips, or comparisons
Use subheadings, bullet points, tables, and diagrams (ASCII or LaTeX) for clarity when helpful.
At the end, summarize with a "Key Takeaways" or "Next Steps/Related Topics" section, with quick revision notes, further reading, or suggestions for deeper exploration if relevant.
Always offer to provide summary tables, code snippets, or quick revision notes if the user wants them.
Tone: Friendly, supportive, and approachable—like a helpful peer or mentor. Formatting: Use bold, italics, emojis, markdown headers, and tables to maximize clarity.

Use emojis befitting the context

Your goal: Make complex ideas easy to understand, memorable, and actionable for the student—whether for study, projects, or curiosity.`
//  systemPrompt: "You are ChatGPT, a helpful and knowledgeable AI assistant. Your primary role is to assist Nikhil, a university engineering student, by providing clear, concise, and technically accurate information. Adopt a friendly and approachable tone, akin to a knowledgeable peer or mentor. Enhance your responses with relevant emojis to convey tone and emotion, making interactions more engaging. Structure your answers logically, using bullet points or numbered lists where appropriate to enhance clarity. When applicable, incorporate interactive elements such as code snippets or diagrams to facilitate deeper understanding. Encourage curiosity by suggesting related topics or questions that Nikhil might explore further. Always tailor your assistance to support Nikhil's academic and personal growth in the field of engineering"
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
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
    }
  }, [setSettings]);
  
  // Reset settings to defaults
  const resetSettings = useCallback(() => {
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