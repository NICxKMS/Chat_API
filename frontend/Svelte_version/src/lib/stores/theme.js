import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Theme options
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Initialize with system theme or saved preference
function createThemeStore() {
  // Check for stored theme preference
  const initialTheme = browser && localStorage.getItem('theme') 
    ? localStorage.getItem('theme') 
    : THEMES.SYSTEM;
    
  const { subscribe, set, update } = writable(initialTheme);

  return {
    subscribe,
    setTheme: (theme) => {
      set(theme);
      if (browser) {
        localStorage.setItem('theme', theme);
      }
    },
    toggleTheme: () => {
      update(current => {
        const newTheme = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        if (browser) {
          localStorage.setItem('theme', newTheme);
        }
        return newTheme;
      });
    }
  };
}

// Create the theme store
export const theme = createThemeStore();

// Create a derived store for the actual theme value (resolving system preference)
export const resolvedTheme = derived(
  theme,
  ($theme, set) => {
    if ($theme === THEMES.SYSTEM) {
      if (browser) {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        set(prefersDark ? THEMES.DARK : THEMES.LIGHT);
        
        // Watch for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
          set(e.matches ? THEMES.DARK : THEMES.LIGHT);
        };
        
        mediaQuery.addEventListener('change', handleChange);
        
        return () => {
          mediaQuery.removeEventListener('change', handleChange);
        };
      }
      // Default to light if not in browser
      set(THEMES.LIGHT);
    } else {
      set($theme);
    }
  },
  THEMES.LIGHT // Default initial value before the derived store updates
);

// Apply theme to document when the resolved theme changes
if (browser) {
  resolvedTheme.subscribe(($resolvedTheme) => {
    if ($resolvedTheme === THEMES.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });
}