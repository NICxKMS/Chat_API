import { writable } from 'svelte/store';

export const sidebarVisible = writable(true);
export const chatInputVisible = writable(true);
export const settingsVisible = writable(false);
export const theme = writable('light');

// Subscribe to theme changes to update the document class
theme.subscribe(value => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', value === 'dark');
  }
}); 