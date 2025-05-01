import { useSettings } from '../contexts/SettingsContext';
import { useCacheToggle } from './useCacheToggle';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to provide consolidated settings control logic
 * @returns {Object} settings controller with settings, updateSetting, resetSettings, cacheEnabled, toggleCache, and currentUser
 */
export const useSettingsController = () => {
  const {
    settings,
    updateSetting,
    resetSettings,
    shouldRestrictTemperature,
    getModelAdjustedSettings
  } = useSettings();
  const { cacheEnabled, toggleCache } = useCacheToggle();
  const { currentUser } = useAuth();

  return {
    settings,
    updateSetting,
    resetSettings,
    shouldRestrictTemperature,
    getModelAdjustedSettings,
    cacheEnabled,
    toggleCache,
    currentUser
  };
}; 