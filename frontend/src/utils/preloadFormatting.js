/**
 * Utility functions for preloading formatting-related components
 */
import {  PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from './performance';

// Phase 2: Basic Formatting Components - essential for initial rendering
export const basicFormattingImports = [
  () => import(/* webpackChunkName: "react-markdown" */ 'react-markdown'),
  () => import(/* webpackChunkName: "remark-gfm" */ 'remark-gfm'),
];

// Advanced Formatting Components - includes StreamingMessage and all its dependencies
export const advancedFormattingImports = [
  // StreamingMessage and its dependencies
  () => import(/* webpackChunkName: "streaming-message" */ '../components/chat/ChatMessage/StreamingMessage'),
  () => import(/* webpackChunkName: "syntax-highlighter-prism" */ 'react-syntax-highlighter/dist/esm/prism'),
  () => import(/* webpackChunkName: "prism-atom-dark" */ 'react-syntax-highlighter/dist/esm/styles/prism/atom-dark'),
  () => import(/* webpackChunkName: "prism-style" */ 'react-syntax-highlighter/dist/esm/styles/prism/prism'),
  () => import(/* webpackChunkName: "rehype-katex" */ 'rehype-katex'), 
  () => import(/* webpackChunkName: "katex-css" */ 'katex/dist/katex.min.css'), 
  () => import(/* webpackChunkName: "remark-emoji" */ 'remark-emoji'),
  () => import(/* webpackChunkName: "remark-math" */ 'remark-math'),
];

// Phase 2: Model Selector Components
export const modelSelectorImports = [
  () => import(/* webpackChunkName: "model-dropdown" */ '../components/models/ModelDropdown'),
  () => import(/* webpackChunkName: "model-item" */ '../components/models/ModelItem'),
  () => import(/* webpackChunkName: "model-search" */ '../components/models/ModelSearch'),
  () => import(/* webpackChunkName: "model-selector-button" */ '../components/models/ModelSelectorButton')
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