import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Use Vite's environment variables
// IMPORTANT: Ensure these are set in your .env file at the root of 'frontend-svelte'
// Example: VITE_FIREBASE_API_KEY=your_key
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Optional
};

// Basic validation
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(key => !import.meta.env[key]);

let app;
let auth;
let analytics = null; // Initialize analytics as null

if (missingEnvVars.length > 0) {
  console.warn(
    `Firebase initialization skipped. Missing environment variables: ${missingEnvVars.join(', ')}. ` +
    `Please set these in your .env file in the 'frontend-svelte' directory.`
  );
  app = null;
  auth = null;
} else {
  try {
    // Initialize Firebase only if it hasn't been initialized yet
    // This prevents errors during hot module replacement (HMR)
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log("Firebase initialized successfully.");
    } else {
      app = getApp(); // Get the already initialized app
      console.log("Firebase already initialized.");
    }

    auth = getAuth(app);

    // Initialize Analytics only if supported by the browser environment
    isSupported().then((supported) => {
      if (supported && app) {
        analytics = getAnalytics(app);
        console.log("Firebase Analytics initialized.");
      } else {
        console.log("Firebase Analytics is not supported in this environment.");
      }
    });

  } catch (error) {
    console.error("Firebase initialization failed:", error);
    app = null;
    auth = null;
    analytics = null;
  }
}

// Export the initialized services
export { app, auth, analytics }; 