import { createContext, useContext, useState, useEffect } from 'react';
// Firebase is dynamically imported to avoid blocking initial bundle

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
    // Dynamically import Firebase auth functions
    const { getFirebaseAuth } = await import('../firebaseConfig');
    const { signOut: firebaseSignOut } = await import('firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized.");
      return;
    }
    try {
      await firebaseSignOut(auth);
      console.log("Sign out successful.");
    } catch (err) {
      console.error("Logout failed:", err);
      setError(err.message || 'Failed to logout.');
    }
  };

  // Effect to listen for Firebase auth state changes
  useEffect(() => {
    let unsubscribe;
    (async () => {
      // Dynamically import Firebase auth
      const { getFirebaseAuth } = await import('../firebaseConfig');
      const { onAuthStateChanged: firebaseOnAuthStateChanged } = await import('firebase/auth');
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
            setError(null); // Clear previous errors on successful login
            setIsLoggingIn(false); // Ensure login UI closes if open
            console.log("User signed in, token obtained.");
          } catch (err) {
            console.error("Failed to get ID token:", err);
            setError("Failed to get authentication token.");
            setIdToken(null);
            // Optionally sign out the user if token fetch fails critically
            const { signOut: firebaseSignOut } = await import('firebase/auth');
            await firebaseSignOut(auth);
          }
        } else {
          // User is signed out
          setIdToken(null);
          setIsLoggingIn(false); // Ensure login UI closes if open
          console.log("User signed out.");
        }
        setLoading(false); // Auth state determined
      });
    })();

    // Cleanup listener on component unmount
    return () => {
      console.log("Cleaning up Firebase onAuthStateChanged listener.");
      if (typeof unsubscribe === 'function') unsubscribe();
    };
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