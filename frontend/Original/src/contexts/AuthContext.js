import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Import Firebase auth service (ensure firebaseConfig.js runs first)
import { getFirebaseAuth } from '../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true); // Still true initially
  const [error, setError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // State to trigger login UI

  const login = async () => {
    // This function now simply signals the intent to log in.
    // The actual login mechanism (popup, redirect) will be handled
    // by a dedicated Login component/page triggered by isLoggingIn state.
    console.log("Login button clicked, setting isLoggingIn to true.");
    setIsLoggingIn(true);
  };

  const logout = async () => {
    // Use Firebase signOut
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized.");
      return;
    }
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setting user/token to null and loading to false
      console.log("Sign out successful.");
    } catch (err) {
      console.error("Logout failed:", err);
      setError(err.message || 'Failed to logout.');
      // Reset state manually on error?
      // setCurrentUser(null);
      // setIdToken(null);
      // setLoading(false); // Or rely on onAuthStateChanged?
    }
  };

  // Effect to listen for Firebase auth state changes
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      console.warn("Auth service not available for onAuthStateChanged listener.");
      setLoading(false); // Stop loading if Firebase isn't initialized
      return;
    }

    console.log("Setting up Firebase onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // Force refresh is false by default, gets cached token if available
          const token = await user.getIdToken();
          setIdToken(token);
          setError(null); // Clear previous errors on successful login
          setIsLoggingIn(false); // Ensure login UI closes if open
          console.log("User signed in, token obtained.");
        } catch (err) {
          console.error("Failed to get ID token:", err);
          setError("Failed to get authentication token.");
          setIdToken(null);
          // Optionally sign out the user if token fetch fails critically
          await signOut(auth); 
        }
      } else {
        // User is signed out
        setIdToken(null);
        setIsLoggingIn(false); // Ensure login UI closes if open
        console.log("User signed out.");
      }
      setLoading(false); // Auth state determined
    });

    // Cleanup listener on component unmount
    return () => {
      console.log("Cleaning up Firebase onAuthStateChanged listener.");
      unsubscribe();
    }
  }, []);

  const value = {
    currentUser,
    idToken,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!currentUser && !!idToken, // Use state directly
    isLoggingIn, // Expose state to trigger login UI
    setIsLoggingIn // Allow login UI to close itself
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 