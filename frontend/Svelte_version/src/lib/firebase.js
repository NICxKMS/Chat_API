import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Fetch Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Optional
};

// Basic validation to ensure environment variables are set
let app;
let auth;

if (
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
) {
  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);

    // Initialize Firebase Authentication and get a reference to the service
    auth = getAuth(app);
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    // Handle initialization error appropriately in your app
    app = null;
    auth = null;
  }
} else {
  console.warn(
    "Firebase configuration environment variables are missing. " +
    "Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, " +
    "VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID in your .env file."
  );
  app = null;
  auth = null;
}

export { auth, app }; // Export auth and potentially app if needed elsewhere