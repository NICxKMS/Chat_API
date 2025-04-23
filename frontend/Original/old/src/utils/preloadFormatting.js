/**
 * Utility functions for preloading formatting-related components
 */
import { preloadComponents, preloadComponentsIdle } from './lazyLoad';
import { performanceMonitor, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './performance';

// Define formatting components to preload
export const formattingImports = [
  () => import('../components/chat/ChatMessage/StreamingMessage'),
  () => import('react-markdown'),
  () => import('react-syntax-highlighter'),
  () => import('react-syntax-highlighter/dist/esm/styles/prism'),
  () => import('remark-gfm'),
  () => import('remark-emoji'),
  () => import('rehype-raw'),
];

// Define model selector components to preload
export const modelSelectorImports = [
  () => import('../components/models/ModelDropdown'),
  () => import('../components/models/ModelItem'),
  () => import('../components/models/ModelSearch'),
  () => import('../components/models/ModelSelectorButton')
];

/**
 * Preload all formatting-related components eagerly
 * @returns {Promise} Promise that resolves when all components are loaded
 */
export const preloadFormattingComponents = () => {
  const startTime = performance.now();
  
  // First preload formatting components
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
      
      // Then preload model selector components
      const modelSelectorStartTime = performance.now();
      return preloadComponents(modelSelectorImports)
        .then(() => {
          performanceMonitor.mark(PERFORMANCE_MARKS.MODEL_SELECTOR_COMPONENTS_LOADED);
          performanceMonitor.measure(
            PERFORMANCE_MEASURES.MODEL_SELECTOR_LOAD_TIME,
            PERFORMANCE_MARKS.FORMATTING_COMPONENTS_LOADED,
            PERFORMANCE_MARKS.MODEL_SELECTOR_COMPONENTS_LOADED
          );
          const modelSelectorEndTime = performance.now();
          console.debug(`Model selector components preloaded in ${modelSelectorEndTime - modelSelectorStartTime}ms`);
        })
        .catch(error => {
          console.error('Error preloading model selector components:', error);
        });
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
  // Also preload model selector components in idle time after a small delay
  setTimeout(() => {
    preloadComponentsIdle(modelSelectorImports, timeout);
  }, 200);
};

// Export as default object
export default {
  preloadFormattingComponents,
  preloadFormattingComponentsIdle,
  formattingImports,
  modelSelectorImports
}; 