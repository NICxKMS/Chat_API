import { lazy } from 'react';

// Model selection components with explicit chunk names
export const ModelDropdown = lazy(() => import(/* webpackChunkName: "model-dropdown" */ '../components/models/ModelDropdown'));
// export const ModelCard = lazy(() => import(/* webpackChunkName: "model-card" */ '../components/models/ModelCard'));
// export const ModelConfig = lazy(() => import(/* webpackChunkName: "model-config" */ '../components/models/ModelConfig'));

// Bundle for preloading
export const modelComponents = [
  () => import(/* webpackChunkName: "model-dropdown" */ '../components/models/ModelDropdown')
]; 