import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import chatStore from './chatStore.js';
import settingsStore from './settingsStore.js';
import { toggleTheme } from './themeStore.js';

// Define available keyboard shortcuts
const SHORTCUTS = {
  'n': { action: () => browser && chatStore.resetChat(), description: 'Start a new chat' },
  'e': { action: () => browser && chatStore.downloadChatHistory(), description: 'Export chat history' },
  'd': { action: () => browser && toggleTheme(), description: 'Toggle dark/light mode' },
  's': { action: () => browser && document.dispatchEvent(new CustomEvent('toggle-settings')), description: 'Toggle settings panel' },
  'm': { action: () => browser && document.dispatchEvent(new CustomEvent('toggle-model-selector')), description: 'Toggle model selector' },
  'Escape': { action: () => browser && document.dispatchEvent(new CustomEvent('close-all-panels')), description: 'Close all open panels' },
  '/': { action: () => browser && document.querySelector('textarea')?.focus(), description: 'Focus on chat input' },
};

// Store state
const createEnabledState = () => {
  const store = writable(true);
  return {
    ...store,
    toggle: () => store.update(value => !value)
  };
};

const createHelpVisibleState = () => {
  const store = writable(false);
  return {
    ...store,
    toggle: () => store.update(value => !value),
    close: () => store.set(false)
  };
};

const enabledState = createEnabledState();
const isHelpVisible = createHelpVisibleState();

// Initialize keyboard handler
const initKeyboardShortcuts = () => {
  if (!browser) {
    console.log('Not in browser environment, skipping keyboard shortcuts initialization');
    return null;
  }

  const handleKeyDown = (event) => {
    // Skip if shortcuts are disabled or in an input element
    const isEnabled = get(enabledState);
    if (!isEnabled || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      return;
    }

    // Handle Alt + / to show keyboard shortcuts help
    if (event.key === '/' && event.altKey) {
      event.preventDefault();
      isHelpVisible.toggle();
      return;
    }

    // Check for Alt + key combinations
    if (event.altKey && SHORTCUTS[event.key]) {
      event.preventDefault();
      SHORTCUTS[event.key].action();
    }

    // Check for Escape to close all panels (even if in an input)
    if (event.key === 'Escape' && SHORTCUTS[event.key]) {
      event.preventDefault();
      SHORTCUTS[event.key].action();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
};

// Public store interface
const keyboardShortcutsStore = {
  subscribe: enabledState.subscribe,
  isHelpVisible,
  shortcuts: SHORTCUTS,
  toggleShortcuts: enabledState.toggle,
  toggleHelpVisibility: isHelpVisible.toggle,
  closeHelp: isHelpVisible.close,
  initialize: initKeyboardShortcuts
};

export default keyboardShortcutsStore; 