/**
 * Utility functions for preloading formatting-related components
 */
import {  PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './performance';

// Phase 2: Basic Formatting Components
export const basicFormattingImports = [
  () => import('../components/chat/ChatMessage/StreamingMessage'),
  () => import('react-markdown'),
  () => import('remark-gfm'),
  () => import('remark-emoji'),
  () => import('rehype-raw'),
];

// Background Load: Advanced Formatting Components
export const advancedFormattingImports = [
  () => import('react-syntax-highlighter/dist/esm/prism'),
  () => import('react-syntax-highlighter/dist/esm/styles/prism/atom-dark'),
  () => import('react-syntax-highlighter/dist/esm/styles/prism/prism'),
  () => import('rehype-katex'), 
  () => import('katex/dist/katex.min.css'), 
  // () => import('react-katex'),
];

// Phase 2: Model Selector Components
export const modelSelectorImports = [
  () => import('../components/models/ModelDropdown'),
  () => import('../components/models/ModelItem'),
  () => import('../components/models/ModelSearch'),
  () => import('../components/models/ModelSelectorButton')
];

// Removed preloadFormattingComponents and preloadFormattingComponentsIdle functions
// Loading logic will be handled directly in App.js

// Keep performance monitoring utilities if they are used elsewhere,
// but the specific measurement logic tied to the removed functions is gone.
// Export constants if needed elsewhere
export { PERFORMANCE_MARKS, PERFORMANCE_MEASURES };

// Example of how you might export all imports if needed elsewhere,
// but individual phase arrays are likely more useful now.
const formattingUtils = {
  basicFormattingImports,
  advancedFormattingImports,
  modelSelectorImports
};

export default formattingUtils; 