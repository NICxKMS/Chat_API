import { lazy } from 'react';

// Layout components with explicit chunk names for better tracking and bundling
export const Layout = lazy(() => import(/* webpackChunkName: "layout-main" */ '../components/layout/Layout'));
export const Sidebar = lazy(() => import(/* webpackChunkName: "layout-sidebar" */ '../components/layout/Sidebar'));
export const MainContent = lazy(() => import(/* webpackChunkName: "layout-content" */ '../components/layout/MainContent'));
export const SidebarToggle = lazy(() => import(/* webpackChunkName: "layout-toggle" */ '../components/layout/SidebarToggle'));

// Add other layout-related components here if needed

// Bundle for preloading the core layout
export const layoutComponents = [
  () => import(/* webpackChunkName: "layout-main" */ '../components/layout/Layout'),
  () => import(/* webpackChunkName: "layout-sidebar" */ '../components/layout/Sidebar'),
  () => import(/* webpackChunkName: "layout-content" */ '../components/layout/MainContent'),
  () => import(/* webpackChunkName: "layout-toggle" */ '../components/layout/SidebarToggle')
]; 