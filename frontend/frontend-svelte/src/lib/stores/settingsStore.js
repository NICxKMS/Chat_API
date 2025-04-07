// src/lib/stores/settingsStore.js
import { writable, derived } from 'svelte/store';

// Default settings values
const DEFAULT_SETTINGS = {
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: 2000,
  frequency_penalty: 0,
  presence_penalty: 0,
  streaming: false // Default to false based on context
};

// --- Internal Writable Store ---
const settings = writable({ ...DEFAULT_SETTINGS });

// --- Actions ---

/**
 * Updates a specific setting value.
 * @param {keyof DEFAULT_SETTINGS} key - The setting key to update.
 * @param {any} value - The new value for the setting.
 */
const updateSetting = (key, value) => {
  settings.update(currentSettings => {
    if (key in DEFAULT_SETTINGS) {
      console.log(`[SettingsStore] Updating '${key}' from ${currentSettings[key]} to ${value}`);
      // Basic type coercion/validation might be added here if needed
      // e.g., ensure numbers are numbers, boolean is boolean
      let processedValue = value;
      if (typeof DEFAULT_SETTINGS[key] === 'number') {
        processedValue = parseFloat(value);
        if (isNaN(processedValue)) processedValue = DEFAULT_SETTINGS[key]; // Fallback to default if parse fails
      } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
        processedValue = Boolean(value);
      }
       // Add specific range checks if necessary (e.g., temperature 0-2)
      if (key === 'temperature') processedValue = Math.max(0, Math.min(2, processedValue));
      if (key === 'top_p') processedValue = Math.max(0, Math.min(1, processedValue));
      if (key === 'max_tokens') processedValue = Math.max(1, Math.floor(processedValue)); // Ensure positive integer
      // Add checks for frequency/presence penalty if needed (-2.0 to 2.0 usually)

      return {
        ...currentSettings,
        [key]: processedValue
      };
    }
    return currentSettings; // Return unchanged if key is invalid
  });
};

/** Resets all settings to their default values. */
const resetSettings = () => {
  console.log("[SettingsStore] Resetting settings to default");
  settings.set({ ...DEFAULT_SETTINGS });
};


// --- Helper Functions (Internal - used by derived store) ---

/**
 * Checks if the temperature should be restricted for a given model.
 * Mimics the logic from the original context.
 * @param {object | null} model - The model object (needs id, series, properties, or requiresFixedTemperature).
 * @returns {boolean} - True if temperature should be restricted.
 */
const _shouldRestrictTemperature = (model) => {
    if (!model) return false;
    // Check specific model properties/flags indicating temperature restriction
    return (
      model.requiresFixedTemperature === true ||
      (model.properties && model.properties.includes('fixed_temperature')) ||
      (model.id && model.id.toLowerCase().startsWith('o')) || // Assuming 'o' prefix implies restriction
      (model.series && model.series.toLowerCase() === 'o-series')
    );
};

// --- Derived Store for Public Interface ---

/**
 * Provides access to settings state and actions.
 * Includes a method to get settings potentially adjusted for a specific model.
 */
const settingsStore = derived(settings, $settings => ({
    settings: $settings,
    updateSetting,
    resetSettings,

    /**
     * Returns the current settings, potentially overriding temperature
     * if the provided model requires it.
     * @param {object | null} model - The model object to check against.
     * @returns {object} - The effective settings object.
     */
    getModelAdjustedSettings: (model) => {
        if (_shouldRestrictTemperature(model)) {
            console.log(`[SettingsStore] Adjusting temperature to 1.0 for model: ${model?.id}`);
            return {
                ...$settings,
                temperature: 1.0
            };
        }
        return $settings;
    },

     /**
      * Helper function exposed for UI elements (like sliders) that might need
      * to know if temperature adjustment is active for the *current* model.
      * @param {object | null} model - The model object to check against.
      * @returns {boolean}
      */
     shouldRestrictTemperature: (model) => _shouldRestrictTemperature(model)
}));

export default settingsStore;