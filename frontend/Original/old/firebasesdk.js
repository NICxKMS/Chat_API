// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBFfhhSVa6_gI1wfCCXqaSaFjG2mIIhNLY",
  authDomain: "unified-chat-api-auth.firebaseapp.com",
  projectId: "unified-chat-api-auth",
  storageBucket: "unified-chat-api-auth.firebasestorage.app",
  messagingSenderId: "710958124624",
  appId: "1:710958124624:web:2298e2b40dadf3c2b30b55",
  measurementId: "G-0DW60R47MS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);