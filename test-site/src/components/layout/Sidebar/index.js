import React, { memo, lazy, Suspense } from 'react';
import { useApi } from '../../../contexts/ApiContext';
import styles from './Sidebar.module.css';

// Lazily loaded components
const ModelDropdown = lazy(() => import('../../models/ModelDropdown'));
const ThemeToggle = lazy(() => import('../../common/ThemeToggle'));
const ApiStatus = lazy(() => import('../../common/ApiStatus'));

/**
 * Sidebar component containing model selection and app controls
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS class
 * @returns {JSX.Element} - Rendered sidebar
 */
const Sidebar = memo(({ className = '' }) => {
  const { apiUrl } = useApi();
  
  return (
    <div className={`${styles.sidebar} ${className}`}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI Chat</h1>
        
        <Suspense fallback={<div className={styles.statusPlaceholder} />}>
          <ApiStatus />
        </Suspense>
      </div>
      
      <div className={styles.apiInfo}>
        <span className={styles.apiLabel}>API URL:</span>
        <span className={styles.apiUrl}>{apiUrl}</span>
      </div>
      
      <div className={styles.modelContainer}>
        <Suspense fallback={<div className={styles.modelPlaceholder} />}>
          <ModelDropdown />
        </Suspense>
      </div>
      
      <div className={styles.footer}>
        <Suspense fallback={<div className={styles.themePlaceholder} />}>
          <ThemeToggle />
        </Suspense>
      </div>
    </div>
  );
});

// Display name for debugging
Sidebar.displayName = 'Sidebar';

export default Sidebar; 