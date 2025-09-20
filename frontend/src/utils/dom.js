/**
 * DOM Manipulation Utilities
 * Centralized utilities for common DOM operations
 */

/**
 * Safely add CSS class to body element
 * @param {string} className - Class name to add
 */
export const addBodyClass = (className) => {
  if (typeof document !== 'undefined' && className) {
    document.body.classList.add(className);
  }
};

/**
 * Safely remove CSS class from body element
 * @param {string} className - Class name to remove
 */
export const removeBodyClass = (className) => {
  if (typeof document !== 'undefined' && className) {
    document.body.classList.remove(className);
  }
};

/**
 * Toggle CSS class on body element
 * @param {string} className - Class name to toggle
 * @param {boolean} force - Force add/remove (optional)
 */
export const toggleBodyClass = (className, force = undefined) => {
  if (typeof document !== 'undefined' && className) {
    if (force !== undefined) {
      document.body.classList.toggle(className, force);
    } else {
      document.body.classList.toggle(className);
    }
  }
};

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export const copyToClipboard = async (text) => {
  if (!text) return false;
  
  try {
    // Modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Create and trigger file download
 * @param {string} content - File content
 * @param {string} filename - Filename for download
 * @param {string} mimeType - MIME type (default: text/plain)
 */
export const downloadFile = (content, filename, mimeType = 'text/plain') => {
  if (typeof document === 'undefined') return;
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
};

/**
 * Scroll element into view with smooth behavior
 * @param {HTMLElement} element - Element to scroll to
 * @param {Object} options - Scroll options
 */
export const scrollIntoView = (element, options = {}) => {
  if (!element) return;
  
  const defaultOptions = {
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest'
  };
  
  element.scrollIntoView({ ...defaultOptions, ...options });
};

/**
 * Check if element is in viewport
 * @param {HTMLElement} element - Element to check
 * @param {number} threshold - Threshold for visibility (0-1)
 * @returns {boolean} - Whether element is visible
 */
export const isElementInViewport = (element, threshold = 0) => {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;
  
  const verticalVisible = rect.top <= windowHeight * (1 - threshold) && 
                         rect.bottom >= windowHeight * threshold;
  const horizontalVisible = rect.left <= windowWidth * (1 - threshold) && 
                           rect.right >= windowWidth * threshold;
  
  return verticalVisible && horizontalVisible;
};

/**
 * Get scroll position of container or window
 * @param {HTMLElement} container - Container element (optional, defaults to window)
 * @returns {Object} - Scroll position {x, y}
 */
export const getScrollPosition = (container = null) => {
  if (container) {
    return {
      x: container.scrollLeft,
      y: container.scrollTop
    };
  }
  
  return {
    x: window.pageXOffset || document.documentElement.scrollLeft,
    y: window.pageYOffset || document.documentElement.scrollTop
  };
};

/**
 * Check if user is at bottom of scrollable container
 * @param {HTMLElement} container - Scrollable container
 * @param {number} threshold - Threshold in pixels from bottom
 * @returns {boolean} - Whether user is at bottom
 */
export const isAtBottom = (container, threshold = 10) => {
  if (!container) return false;
  
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - scrollTop - clientHeight < threshold;
};

/**
 * Debounced resize observer
 * @param {HTMLElement} element - Element to observe
 * @param {Function} callback - Callback function
 * @param {number} delay - Debounce delay in ms
 * @returns {Function} - Cleanup function
 */
export const observeResize = (element, callback, delay = 100) => {
  if (!element || !ResizeObserver) return () => {};
  
  let timeoutId;
  const debouncedCallback = (entries) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(entries), delay);
  };
  
  const observer = new ResizeObserver(debouncedCallback);
  observer.observe(element);
  
  return () => {
    clearTimeout(timeoutId);
    observer.disconnect();
  };
};

/**
 * Focus trap utility for modals and dialogs
 * @param {HTMLElement} container - Container element to trap focus within
 * @returns {Function} - Cleanup function
 */
export const createFocusTrap = (container) => {
  if (!container) return () => {};
  
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleTabKey = (event) => {
    if (event.key !== 'Tab') return;
    
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleTabKey);
  
  // Focus first element initially
  if (firstElement) {
    firstElement.focus();
  }
  
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
};
