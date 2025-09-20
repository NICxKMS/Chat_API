import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Hook for handling click outside events
 * @param {Function} handler - Function to call when clicked outside
 * @param {Array} deps - Dependencies for the handler
 * @returns {Object} - Ref to attach to the element
 */
export const useClickOutside = (handler, deps = []) => {
  const ref = useRef();
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [...deps, handler]);
  
  return ref;
};

/**
 * Hook for handling resize events
 * @param {Function} handler - Function to call on resize
 * @param {Array} deps - Dependencies for the handler
 */
export const useResize = (handler, deps = []) => {
  const handlerRef = useRef(handler);
  
  // Update ref when handler changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  
  useEffect(() => {
    const handleResize = (event) => handlerRef.current(event);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, deps);
};

/**
 * Hook for handling keyboard events
 * @param {Function} handler - Function to call on key press
 * @param {Array} keys - Array of keys to listen for (e.g., ['Escape', 'Enter'])
 * @param {Object} options - Options for event handling
 */
export const useKeyboard = (handler, keys = [], options = {}) => {
  const { target = document, preventDefault = false } = options;
  
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (keys.length === 0 || keys.includes(event.key)) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
      }
    };
    
    target.addEventListener('keydown', handleKeyDown);
    return () => target.removeEventListener('keydown', handleKeyDown);
  }, [handler, keys, target, preventDefault]);
};

/**
 * Hook for handling escape key specifically
 * @param {Function} handler - Function to call when escape is pressed
 * @param {boolean} enabled - Whether the handler is enabled
 */
export const useEscapeKey = (handler, enabled = true) => {
  useKeyboard(
    useCallback((event) => {
      if (enabled) handler(event);
    }, [handler, enabled]),
    ['Escape']
  );
};

/**
 * Hook for handling mobile detection with resize
 * @param {number} breakpoint - Breakpoint for mobile detection (default: 600)
 * @returns {boolean} - Whether current viewport is mobile
 */
export const useMobileDetection = (breakpoint = 600) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);
  
  useResize(
    useCallback(() => {
      setIsMobile(window.innerWidth <= breakpoint);
    }, [breakpoint])
  );
  
  return isMobile;
};

/**
 * Hook for handling focus and blur events with cleanup
 * @param {Object} element - Element ref to attach events to
 * @param {Function} onFocus - Focus handler
 * @param {Function} onBlur - Blur handler
 * @param {Array} deps - Dependencies
 */
export const useFocusBlur = (elementRef, onFocus, onBlur, deps = []) => {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const handleFocus = (event) => onFocus && onFocus(event);
    const handleBlur = (event) => onBlur && onBlur(event);
    
    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);
    
    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
    };
  }, [elementRef, onFocus, onBlur, ...deps]);
};
