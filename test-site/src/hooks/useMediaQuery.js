import { useState, useEffect } from 'react';

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

    // Create media query list
    const mediaQueryList = window.matchMedia(query);

    // Initial check
    setMatches(mediaQueryList.matches);

    // Define listener function
    const listener = (event) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
      return () => {
        mediaQueryList.removeEventListener('change', listener);
      };
    } 
    // Legacy support for older browsers (e.g., IE, older Safari)
    else if (mediaQueryList.addListener) {
      mediaQueryList.addListener(listener);
      return () => {
        mediaQueryList.removeListener(listener);
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
  return useMediaQuery('(max-width: 640px)');
};

export const useIsTablet = () => {
  return useMediaQuery('(min-width: 641px) and (max-width: 1023px)');
};

export const useIsDesktop = () => {
  return useMediaQuery('(min-width: 1024px)');
};

/**
 * Get a consistent breakpoint value across the app
 * @returns {{mobile: string, tablet: string, desktop: string}}
 */
export const useBreakpoints = () => {
  return {
    mobile: '640px',
    tablet: '1023px',
    desktop: '1024px'
  };
}; 