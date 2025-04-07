import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Helper function to get theme from localStorage or system preference (client-side only)
const getClientThemePreference = () => {
  if (!browser) return 'dark'; // Should not be called server-side, but safety first
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    return savedTheme === 'light' ? 'light' : 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Initialize store with a static default. Actual value set client-side in onMount.
const theme = writable('dark'); // Default to dark, avoids top-level browser API access

// Function to toggle theme
const toggleTheme = () => {
  theme.update(currentTheme => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    if (browser) {
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newTheme);
    }
    return newTheme;
  });
};

// Function to apply the theme class and sync store on initial client load
const applyInitialTheme = () => {
    if (browser) {
        const initialClientTheme = getClientThemePreference();
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(initialClientTheme);
        // Sync the store with the actual client-side theme
        theme.set(initialClientTheme);
    }
};

export { theme, toggleTheme, applyInitialTheme }; 