import { lazy } from 'react';

// Settings components with explicit chunk names for better tracking and bundling
export const SettingsPanel = lazy(() => import(/* webpackChunkName: "settings-panel" */ '../components/settings/SettingsPanel'));
export const ThemeToggle = lazy(() => import(/* webpackChunkName: "settings-theme" */ '../components/common/ThemeToggle'));

// Add other settings-related components
// export const ApiSettings = lazy(() => import(/* webpackChunkName: "settings-api" */ '../components/settings/ApiSettings'));
// export const UserSettings = lazy(() => import(/* webpackChunkName: "settings-user" */ '../components/settings/UserSettings'));

// Bundle for preloading
export const settingsComponents = [
  () => import(/* webpackChunkName: "settings-panel" */ '../components/settings/SettingsPanel'),
  () => import(/* webpackChunkName: "settings-theme" */ '../components/common/ThemeToggle')
]; 