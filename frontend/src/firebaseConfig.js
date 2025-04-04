import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Fetch Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  // measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID // Optional
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
    // For example, show an error message to the user
    app = null;
    auth = null;
  }
} else {
  console.warn(
    "Firebase configuration environment variables are missing. " +
    "Please set REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_AUTH_DOMAIN, " +
    "REACT_APP_FIREBASE_PROJECT_ID, and REACT_APP_FIREBASE_APP_ID in your .env file."
  );
  app = null;
  auth = null;
}

export { auth, app }; // Export auth and potentially app if needed elsewhere 