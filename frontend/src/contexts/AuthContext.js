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
  const [isFirebaseReady, setIsFirebaseReady] = useState(false); 
  const { showToast } = useToast();

  useEffect(() => {
    if (loading) startAuthLoading(); else stopAuthLoading();
  }, [loading, startAuthLoading, stopAuthLoading]);

  const ensureFirebaseReady = useCallback(async () => {
    if (isFirebaseReady) return true;
    try {
      const { getFirebaseAuth } = await import(/* webpackChunkName: "firebase-config" */ '../firebaseConfig');
      const auth = getFirebaseAuth(); // This ensures initialization via firebaseConfig.js
      if (auth) {
        console.log("Firebase is ready through ensureFirebaseReady.");
        setIsFirebaseReady(true);
        return true;
      }
      throw new Error("Firebase Auth could not be initialized by ensureFirebaseReady");
    } catch (e) {
      console.error("Failed to ensure Firebase readiness:", e);
      setError(e.message || "Failed to initialize authentication service.");
      setIsFirebaseReady(false);
      showToast({ type: 'error', message: e.message || "Failed to initialize auth service." });
      return false;
    }
  }, [isFirebaseReady, showToast]);

  const login = useCallback(async () => {
    console.log("Login button clicked, setting isLoggingIn to true.");
    setIsLoggingIn(true);
    // Ensure Firebase is ready when login process starts, LoginModal might need it soon.
    await ensureFirebaseReady(); 
  }, [setIsLoggingIn, ensureFirebaseReady]);

  const logout = useCallback(async () => {
    const ready = await ensureFirebaseReady();
    if (!ready) {
      console.log("Firebase not ready, cannot logout.");
      showToast({ type: 'error', message: 'Authentication service not ready for logout.' });
      return;
    }
    const { getFirebaseAuth } = await import(/* webpackChunkName: "firebase-config" */ '../firebaseConfig');
    const { signOut: firebaseSignOut } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) {
      const msg = "Firebase not initialized for logout.";
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
  }, [ensureFirebaseReady, setError, showToast]);

  useEffect(() => {
    let unsubscribe = null;

    const initializeAuthListener = async () => {
      // Attempt to make Firebase ready if not already, e.g., for existing sessions
      const ready = await ensureFirebaseReady();
      if (!ready) {
        console.log("Firebase not ready, skipping auth listener setup.");
        return; // If still not ready, abort.
      }
      
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
            const token = await user.getIdToken();
            setIdToken(token);
            try { localStorage.setItem('idToken', token); } catch (e) { console.warn('Failed to cache idToken', e); }
            setError(null); 
            setIsLoggingIn(false); 
            console.log("User signed in, token obtained.");
          } catch (err) {
            console.error("Failed to get ID token:", err);
            const msg = "Failed to get authentication token.";
            setError(msg);
            showToast({ type: 'error', message: msg });
            setIdToken(null);
            try {
                const { signOut: firebaseSignOutFallback } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
                await firebaseSignOutFallback(auth);
            } catch (signOutError) {
                console.error("Fallback sign out failed:", signOutError);
            }
          }
        } else {
          setIdToken(null);
          try { localStorage.removeItem('idToken'); } catch (e) { console.warn('Failed to remove cached idToken', e); }
          setIsLoggingIn(false); 
          console.log("User signed out.");
        }
        setLoading(false); 
      });
    };

    initializeAuthListener();

    return () => {
      if (typeof unsubscribe === 'function') {
        console.log("Cleaning up Firebase onAuthStateChanged listener.");
        unsubscribe();
      }
    };
  }, [showToast, ensureFirebaseReady]); // ensureFirebaseReady is a dependency

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
    isFirebaseReady, // expose this if LoginModal needs to check it
    ensureFirebaseReady // Expose this if LoginModal needs to trigger/wait for it
  }), [currentUser, idToken, loading, error, login, logout, isLoggingIn, setIsLoggingIn, isFirebaseReady, ensureFirebaseReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 