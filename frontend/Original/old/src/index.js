import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Preloading resources hint for browsers that support it
// Note: These will be used by webpack during build
import(/* webpackPrefetch: true */ './features/layout');
import(/* webpackPrefetch: true */ './features/common');

/**
 * Custom loading component with minimal UI
 */
const LoadingApp = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    color: 'var(--text-color)',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }}>
    Loading application...
  </div>
);

// Create root and render app with Suspense for top-level code splitting
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={<LoadingApp />}>
      <App />
    </Suspense>
  </React.StrictMode>
);

// Report web vitals for performance monitoring
reportWebVitals(console.log);

// Unregister service worker to prevent 404 errors
// You can re-enable this later by generating proper service worker files
serviceWorkerRegistration.unregister(); 