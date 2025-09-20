import { useState, useCallback } from 'react';

/**
 * Custom hook for managing toggle state
 * @param {boolean} initialValue - Initial toggle state
 * @returns {[boolean, Function]} - Current state and toggle function
 */
export const useToggle = (initialValue = false) => {
  const [value, setValue] = useState(initialValue);
  
  const toggle = useCallback(() => setValue(prev => !prev), []);
  
  return [value, toggle];
};

/**
 * Custom hook for managing expandable state (alias for useToggle with true default)
 * @param {boolean} initialExpanded - Initial expanded state (defaults to true)
 * @returns {[boolean, Function]} - Current expanded state and toggle function
 */
export const useExpanded = (initialExpanded = true) => {
  return useToggle(initialExpanded);
};
