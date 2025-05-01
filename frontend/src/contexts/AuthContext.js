import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { useLoading } from './LoadingContext';
// Firebase is dynamically imported to avoid blocking

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
  const [loading, setLoading] = useState(false); // Changed to false initially - we're proceeding anonymously
  // Sync with global loading context for auth
  const [, startAuthLoading, stopAuthLoading] = useLoading('auth');
  const [error, setError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // State to trigger login UI
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (loading) startAuthLoading(); else stopAuthLoading();
  }, [loading, startAuthLoading, stopAuthLoading]);

  const login = useCallback(async () => {
    console.log("Login button clicked, setting isLoggingIn to true.");
    setIsLoggingIn(true);
  }, [setIsLoggingIn]);

  const logout = useCallback(async () => {
    if (!isFirebaseInitialized) {
      console.log("Firebase not initialized yet, cannot logout.");
      return;
    }
    const { getFirebaseAuth } = await import(/* webpackChunkName: "firebase-config" */ '../firebaseConfig');
    const { signOut: firebaseSignOut } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) {
      const msg = "Firebase not initialized.";
      setError(msg);
      showToast({ type: 'error', message: msg });
      return;
    }
    try {
      await firebaseSignOut(auth);
      console.log("Sign out successful.");
    } catch (err) {
      console.error("Logout failed:", err);
      const msg = err.message || 'Failed to logout.';
      setError(msg);
      showToast({ type: 'error', message: msg });
    }
  }, [isFirebaseInitialized, setError]);

  // Effect to listen for Firebase auth state changes
  useEffect(() => {
    let unsubscribe = null;

    // Listen for the 'firebaseInitialized' event from App.js
    const handleFirebaseInit = () => {
      console.log("Received Firebase initialized event");
      setIsFirebaseInitialized(true);
      initializeAuthListener();
    };

    // Function to initialize auth listener
    const initializeAuthListener = async () => {
      setLoading(true);
      // Dynamically import Firebase auth
      const { getFirebaseAuth } = await import(/* webpackChunkName: "firebase-config" */ '../firebaseConfig');
      const { onAuthStateChanged: firebaseOnAuthStateChanged } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
      
      const auth = getFirebaseAuth();
      if (!auth) {
        console.warn("Auth service not available for onAuthStateChanged listener.");
        setLoading(false);
        return;
      }
      
      console.log("Setting up Firebase onAuthStateChanged listener.");
      unsubscribe = firebaseOnAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        if (user) {
          try {
            // Force refresh is false by default, gets cached token if available
            const token = await user.getIdToken();
            setIdToken(token);
            try { localStorage.setItem('idToken', token); } catch (e) { console.warn('Failed to cache idToken', e); }
            setError(null); // Clear previous errors on successful login
            setIsLoggingIn(false); // Ensure login UI closes if open
            console.log("User signed in, token obtained.");
          } catch (err) {
            console.error("Failed to get ID token:", err);
            const msg = "Failed to get authentication token.";
            setError(msg);
            showToast({ type: 'error', message: msg });
            setIdToken(null);
            // Optionally sign out the user if token fetch fails critically
            const { signOut: firebaseSignOut } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
            await firebaseSignOut(auth);
          }
        } else {
          // User is signed out
          setIdToken(null);
          try { localStorage.removeItem('idToken'); } catch (e) { console.warn('Failed to remove cached idToken', e); }
          setIsLoggingIn(false); // Ensure login UI closes if open
          console.log("User signed out.");
        }
        setLoading(false); // Auth state determined
      });
    };

    // Define a custom event for Firebase initialization
    window.addEventListener('firebaseInitialized', handleFirebaseInit);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('firebaseInitialized', handleFirebaseInit);
      if (typeof unsubscribe === 'function') {
      console.log("Cleaning up Firebase onAuthStateChanged listener.");
        unsubscribe();
      }
    };
  }, []);

  const value = useMemo(() => ({
    currentUser,
    idToken,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!currentUser && !!idToken,
    isLoggingIn,
    setIsLoggingIn,
    isFirebaseInitialized
  }), [currentUser, idToken, loading, error, login, logout, isLoggingIn, setIsLoggingIn, isFirebaseInitialized]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 