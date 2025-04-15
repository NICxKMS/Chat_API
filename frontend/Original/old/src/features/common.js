import { lazy } from 'react';

// Common UI components with explicit chunk names
export const Spinner = lazy(() => import(/* webpackChunkName: "common-spinner" */ '../components/common/Spinner'));
export const MoreActions = lazy(() => import(/* webpackChunkName: "common-actions" */ '../components/common/MoreActions'));
// export const ErrorBoundary = lazy(() => import(/* webpackChunkName: "common-error" */ '../components/common/ErrorBoundary'));
// export const Modal = lazy(() => import(/* webpackChunkName: "common-modal" */ '../components/common/Modal'));

// Bundle for preloading critical common components
export const commonComponents = [
  () => import(/* webpackChunkName: "common-spinner" */ '../components/common/Spinner'),
  () => import(/* webpackChunkName: "common-actions" */ '../components/common/MoreActions')
]; 