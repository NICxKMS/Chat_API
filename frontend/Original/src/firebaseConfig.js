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

let app = null;
let auth = null;

export const initializeFirebase = () => {
  if (app) return { app, auth };

  if (
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  ) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      console.log("Firebase initialized successfully.");
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      app = null;
      auth = null;
    }
  } else {
    console.warn(
      "Firebase configuration environment variables are missing. " +
      "Please set REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_AUTH_DOMAIN, " +
      "REACT_APP_FIREBASE_PROJECT_ID, and REACT_APP_FIREBASE_APP_ID in your .env file."
    );
  }
  
  return { app, auth };
};

export const getFirebaseAuth = () => {
  if (!auth) {
    const { auth: newAuth } = initializeFirebase();
    return newAuth;
  }
  return auth;
};

export const getFirebaseApp = () => {
  if (!app) {
    const { app: newApp } = initializeFirebase();
    return newApp;
  }
  return app;
}; 