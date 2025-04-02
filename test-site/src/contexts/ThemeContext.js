import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Create theme context
const ThemeContext = createContext();

// Custom hook for using theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or default to 'dark'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  // Toggle between light and dark themes
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  // Apply theme class to body element
  useEffect(() => {
    document.body.classList.remove('light-mode', 'dark-mode');
    document.body.classList.add(`${theme}-mode`);
  }, [theme]);

  // Context value - memoized to prevent unnecessary re-renders
  const value = useMemo(() => ({
    theme,
    toggleTheme,
    isDark: theme === 'dark'
  }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 