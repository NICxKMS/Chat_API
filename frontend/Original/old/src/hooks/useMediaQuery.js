import { useState, useEffect, useMemo } from 'react';

// Define breakpoint constants in a single source of truth
export const BREAKPOINTS = {
  mobile: '640px',
  tablet: '1023px',
  desktop: '1024px'
};

// Cached media query listeners
const mediaQueryListeners = new Map();

/**
 * Custom hook that returns true if the current viewport matches the provided media query
 * @param {string} query - Media query string e.g., "(max-width: 1024px)"
 * @returns {boolean} - True if the media query matches
 */
export const useMediaQuery = (query) => {
  // Initialize with the current match state
  const [matches, setMatches] = useState(() => {
    // Check for window to avoid SSR issues
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Avoid running in SSR context
    if (typeof window === 'undefined') {
      return undefined;
    }

    // Check if we already have a listener for this query
    if (!mediaQueryListeners.has(query)) {
      // Create media query list
      const mediaQueryList = window.matchMedia(query);
      
      // Create listener registry for this query
      mediaQueryListeners.set(query, {
        mediaQueryList,
        listeners: new Set()
      });
    }
    
    const queryData = mediaQueryListeners.get(query);
    const { mediaQueryList, listeners } = queryData;

    // Initial check
    setMatches(mediaQueryList.matches);

    // Define listener function
    const listener = (event) => {
      setMatches(event.matches);
    };
    
    // Add listener to registry
    listeners.add(listener);

    // Modern browsers
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
      return () => {
        mediaQueryList.removeEventListener('change', listener);
        listeners.delete(listener);
        
        // Clean up registry if no more listeners
        if (listeners.size === 0) {
          mediaQueryListeners.delete(query);
        }
      };
    } 
    // Legacy support for older browsers (e.g., IE, older Safari)
    else if (mediaQueryList.addListener) {
      mediaQueryList.addListener(listener);
      return () => {
        mediaQueryList.removeListener(listener);
        listeners.delete(listener);
        
        // Clean up registry if no more listeners
        if (listeners.size === 0) {
          mediaQueryListeners.delete(query);
        }
      };
    }

    return undefined;
  }, [query]);

  return matches;
};

/**
 * Pre-configured hooks for common breakpoints
 */
export const useIsMobile = () => {
  const query = useMemo(() => `(max-width: ${BREAKPOINTS.mobile})`, []);
  return useMediaQuery(query);
};

export const useIsTablet = () => {
  const query = useMemo(() => 
    `(min-width: calc(${BREAKPOINTS.mobile} + 1px)) and (max-width: ${BREAKPOINTS.tablet})`, []);
  return useMediaQuery(query);
};

export const useIsDesktop = () => {
  const query = useMemo(() => `(min-width: ${BREAKPOINTS.desktop})`, []);
  return useMediaQuery(query);
};

/**
 * Get a consistent breakpoint value across the app
 * @returns {{mobile: string, tablet: string, desktop: string}}
 */
export const useBreakpoints = () => {
  return BREAKPOINTS;
}; 