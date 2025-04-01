import React, { lazy, Suspense } from 'react';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import styles from './Layout.module.css';

// Lazily loaded components for better initial load performance
const Sidebar = lazy(() => import('../Sidebar'));
const MainContent = lazy(() => import('../MainContent'));

/**
 * Layout component that handles responsive design
 * @returns {JSX.Element} - Rendered layout
 */
const Layout = () => {
  const isDesktop = useIsDesktop();
  
  return (
    <div className={styles.layout}>
      {/* Sidebar - hidden by default on mobile */}
      <Suspense fallback={<div className={styles.sidebarPlaceholder} />}>
        <Sidebar className={isDesktop ? '' : styles.hiddenMobile} />
      </Suspense>
      
      {/* Main content */}
      <Suspense fallback={<div className={styles.contentPlaceholder} />}>
        <MainContent />
      </Suspense>
    </div>
  );
};

export default Layout; 