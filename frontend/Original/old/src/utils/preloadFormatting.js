/**
 * Utility functions for preloading formatting-related components
 */
import { preloadComponents, preloadComponentsIdle } from './lazyLoad';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './performance';

// Define formatting components to preload
const formattingImports = [
  () => import('../components/chat/ChatMessage/StreamingMessage'),
  () => import('react-markdown'),
  () => import('react-syntax-highlighter'),
  () => import('react-syntax-highlighter/dist/esm/styles/prism'),
  () => import('remark-gfm'),
  () => import('remark-math'),
  () => import('remark-emoji'),
  () => import('rehype-katex'),
  () => import('rehype-raw'),
  () => import('rehype-sanitize')
];

/**
 * Preload all formatting-related components eagerly
 * @returns {Promise} Promise that resolves when all components are loaded
 */
export const preloadFormattingComponents = () => {
  const startTime = performance.now();
  return preloadComponents(formattingImports)
    .then(() => {
      performanceMonitor.mark(PERFORMANCE_MARKS.FORMATTING_COMPONENTS_LOADED);
      performanceMonitor.measure(
        PERFORMANCE_MEASURES.FORMATTING_LOAD_TIME,
        PERFORMANCE_MARKS.APP_START,
        PERFORMANCE_MARKS.FORMATTING_COMPONENTS_LOADED
      );
      const endTime = performance.now();
      console.debug(`Formatting components preloaded in ${endTime - startTime}ms`);
    })
    .catch(error => {
      console.error('Error preloading formatting components:', error);
    });
};

/**
 * Preload formatting components during idle time
 * @param {number} timeout - Timeout in ms
 */
export const preloadFormattingComponentsIdle = (timeout = 2000) => {
  preloadComponentsIdle(formattingImports, timeout);
};

// Export as default object
export default {
  preloadFormattingComponents,
  preloadFormattingComponentsIdle,
  formattingImports
}; 