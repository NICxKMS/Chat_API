import './utils/polyfills';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/common/colors.css';
import './styles/common/tokens.css';
import './styles/theme.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { ToastProvider } from './contexts/ToastContext';
import { LoadingProvider } from './contexts/LoadingContext';
import GlobalLoadingIndicator from './components/common/GlobalLoadingIndicator';

// Set initial theme class on <body> so theme mappings (light-mode/dark-mode) take effect
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
// Apply body class for index.css mappings
document.body.classList.add(prefersDark ? 'dark-mode' : 'light-mode');
// Apply data-theme attribute for colors.css and theme.css dark mode overrides
document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

// Create root and render app with Suspense
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ToastProvider>
      <LoadingProvider>
        <Suspense fallback={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh' 
          }}>
            Loading...
          </div>
        }>
          <App />
        </Suspense>
        <GlobalLoadingIndicator />
      </LoadingProvider>
    </ToastProvider>
  </React.StrictMode>
);

// Report web vitals for performance monitoring
reportWebVitals(console.log);

// Register service worker for PWA support
serviceWorkerRegistration.register({
  onUpdate: registration => {
    // When new content is available, show a notification
    const waitingServiceWorker = registration.waiting;
    if (waitingServiceWorker) {
      waitingServiceWorker.addEventListener("statechange", event => {
        if (event.target.state === "activated") {
          window.location.reload();
        }
      });
      waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }
}); 