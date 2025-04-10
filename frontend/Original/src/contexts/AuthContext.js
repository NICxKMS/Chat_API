import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Import Firebase auth service (ensure firebaseConfig.js runs first)
import { getFirebaseAuth } from '../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn('useAuth used outside of AuthProvider - returning default values');
    return {
      currentUser: null,
      idToken: null,
      loading: false,
      error: null,
      login: () => {},
      logout: () => {},
      isAuthenticated: false,
      isLoggingIn: false,
      setIsLoggingIn: () => {}
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = useCallback(async () => {
    try {
      console.log("Login button clicked, setting isLoggingIn to true.");
      setIsLoggingIn(true);
      // Add a timeout to handle potential popup issues
      setTimeout(() => {
        if (isLoggingIn) {
          console.warn("Login process taking too long, resetting state");
          setIsLoggingIn(false);
        }
      }, 30000); // 30 second timeout
    } catch (err) {
      console.error("Error in login function:", err);
      setError("Failed to initiate login. Please try again.");
      setIsLoggingIn(false);
    }
  }, [isLoggingIn]);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      console.warn("Firebase not initialized during logout.");
      setError("Authentication service unavailable.");
      return;
    }
    try {
      await signOut(auth);
      console.log("Sign out successful.");
    } catch (err) {
      console.error("Logout failed:", err);
      setError(err.message || 'Failed to logout.');
      // Don't throw error, just log it and continue
    }
  }, []);

  // Effect to listen for Firebase auth state changes
  useEffect(() => {
    let unsubscribe = () => {};
    let mounted = true;
    let authStateChangeTimeout;

    const setupAuthListener = async () => {
      const auth = getFirebaseAuth();
      if (!auth) {
        console.warn("Auth service not available for onAuthStateChanged listener.");
        if (mounted) setLoading(false);
        return;
      }

      try {
        console.log("Setting up Firebase onAuthStateChanged listener.");
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!mounted) return;

          // Clear any existing timeout
          if (authStateChangeTimeout) {
            clearTimeout(authStateChangeTimeout);
          }

          try {
            setCurrentUser(user);
            if (user) {
              try {
                const token = await user.getIdToken();
                setIdToken(token);
                setError(null);
                setIsLoggingIn(false);
                console.log("User signed in, token obtained.");
              } catch (tokenErr) {
                console.error("Failed to get ID token:", tokenErr);
                setError("Failed to get authentication token.");
                setIdToken(null);
              }
            } else {
              setIdToken(null);
              setIsLoggingIn(false);
              console.log("User signed out.");
            }
          } catch (err) {
            console.error("Error in auth state change handler:", err);
            setError("Authentication error occurred.");
          } finally {
            if (mounted) setLoading(false);
          }
        }, (error) => {
          console.error("Auth state change error:", error);
          if (mounted) {
            setError("Authentication error: " + error.message);
            setLoading(false);
          }
        });

        // Set a timeout to handle potential auth state change issues
        authStateChangeTimeout = setTimeout(() => {
          if (mounted && loading) {
            console.warn("Auth state change taking too long, resetting loading state");
            setLoading(false);
          }
        }, 30000); // 30 second timeout

      } catch (err) {
        console.error("Error setting up auth listener:", err);
        if (mounted) {
          setError("Failed to initialize authentication.");
          setLoading(false);
        }
      }
    };

    setupAuthListener();

    return () => {
      mounted = false;
      if (authStateChangeTimeout) {
        clearTimeout(authStateChangeTimeout);
      }
      console.log("Cleaning up Firebase onAuthStateChanged listener.");
      unsubscribe();
    };
  }, [loading]);

  const value = {
    currentUser,
    idToken,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!currentUser && !!idToken,
    isLoggingIn,
    setIsLoggingIn
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 