import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { IoMdClose } from 'react-icons/io';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import Spinner from '../common/Spinner';
import styles from './LoginModal.module.css';
// Assuming a Spinner component exists

// Import icons using the correct paths
// Icon for email/pass

const LoginModal = ({ onClose }) => {
  const { setIsLoggingIn, error: authContextError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Clear local error when auth context error changes (e.g., token fetch error)
  useEffect(() => {
    if (authContextError) {
      setError(authContextError);
    }
  }, [authContextError]);

  const handleSignIn = async (provider) => {
    // Dynamically import Firebase auth to defer load
    const { getFirebaseAuth } = await import(/* webpackChunkName: "firebase-config" */ '../../firebaseConfig');
    const { signInWithPopup } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized. Cannot sign in.");
      return;
    }
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged in AuthContext will handle the rest (closing modal, setting user state)
      console.log("Popup sign-in successful.");
    } catch (err) {
      console.error("Popup Sign-in Error:", err);
      // Customize error messages based on err.code
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('Popup sign-in cancelled by user.');
        // Close the modal as the user cancelled
        setIsLoggingIn(false);
        if (onClose) onClose();
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.log('Popup sign-in cancelled (multiple requests).');
        // Close the modal
        setIsLoggingIn(false);
        if (onClose) onClose();
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked by browser. Please allow popups for this site.');
        // Keep modal open to show the error in this case
        setIsLoading(false);
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
        // Keep modal open to show unexpected errors
        setIsLoading(false);
      }
    }
    // No finally block needed, loading is handled by success/error paths
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault(); // Prevent form submission reload
    const { getFirebaseAuth } = await import(/* webpackChunkName: "firebase-config" */ '../../firebaseConfig');
    const { signInWithEmailAndPassword } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized.");
      return;
    }
    if (!email || !password) {
        setError("Please enter both email and password.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged handles the rest
      console.log("Email/Password sign-in successful.");
    } catch (err) {
      console.error("Email Sign-in Error:", err);
      setError(err.message || 'Failed to sign in with email.');
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault(); // Prevent form submission reload
    const { getFirebaseAuth } = await import(/* webpackChunkName: "firebase-config" */ '../../firebaseConfig');
    const { createUserWithEmailAndPassword } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized.");
      return;
    }
    if (!email || !password) {
        setError("Please enter both email and password.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged handles the rest
      console.log("Email/Password sign-up successful.");
    } catch (err) {
      console.error("Email Sign-up Error:", err);
      setError(err.message || 'Failed to sign up with email.');
      setIsLoading(false);
    }
  };

  // Dynamically import GoogleAuthProvider to avoid bundling and missing reference
  const handleGoogleSignIn = async () => {
    const { GoogleAuthProvider } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
    const googleProvider = new GoogleAuthProvider();
    handleSignIn(googleProvider);
  };

  // Dynamically import GithubAuthProvider to avoid missing reference
  const handleGithubSignIn = async () => {
    const { GithubAuthProvider } = await import(/* webpackChunkName: "firebase-auth" */ 'firebase/auth');
    const githubProvider = new GithubAuthProvider();
    handleSignIn(githubProvider);
  };

  const closeModal = () => {
    // Only close if not currently in the middle of a sign-in attempt
    if (!isLoading) {
      setIsLoggingIn(false);
      if (onClose) onClose();
    }
  };

  return (
    <div className={styles.LoginModal} onClick={closeModal}>
      <div className={styles.LoginModal__modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.LoginModal__closeButton} onClick={closeModal} aria-label="Close login">
          <IoMdClose />
        </button>
        <h2 className={styles.LoginModal__title}>Login / Sign Up</h2>
        <p className={styles.LoginModal__subtitle}>Choose a provider to continue</p>

        {isLoading && (
          <div className={styles.LoginModal__spinnerContainer}> {/* Make spinner take full height when loading */}
            <Spinner size="large" />
            <p>Connecting...</p>
          </div>
        )}

        {!isLoading && (
          // Email/Password form is now the default content when not loading
          <form className={styles.LoginModal__emailForm} onSubmit={handleEmailSignIn}> {/* Added onSubmit */} 
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.LoginModal__inputField}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.LoginModal__inputField}
            />
            <div className={styles.LoginModal__emailButtonContainer}>
              <button type="submit" className={styles.LoginModal__emailButton} disabled={isLoading}>
                Sign In
              </button>
              <button type="button" onClick={handleEmailSignUp} className={`${styles.LoginModal__emailButton} ${styles.LoginModal__signUpButton}`} disabled={isLoading}>
                Sign Up
              </button>
            </div>
          </form>
        )}

        {/* Alternative Sign-in Providers (Icons) - Shown below email form when not loading */}
        {!isLoading && (
          <div className={styles.LoginModal__alternativeLoginContainer}>
            <p className={styles.LoginModal__alternativeLoginText}>Or sign in with</p>
            <div className={styles.LoginModal__providerIconContainer}>
              <button
                className={styles.LoginModal__providerIconButton}
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                title="Sign in with Google"
                aria-label="Sign in with Google"
              >
                <FcGoogle />
              </button>
              <button
                className={styles.LoginModal__providerIconButton}
                onClick={handleGithubSignIn}
                disabled={isLoading}
                title="Sign in with GitHub"
                aria-label="Sign in with GitHub"
              >
                <FaGithub />
              </button>
              {/* Add other provider icons here if needed */}
            </div>
          </div>
        )}

        {error && <p className={styles.LoginModal__error}>{error}</p>}

        <p className={styles.LoginModal__footerText}>
          By signing in, you agree to our imaginary Terms of Service.
        </p>
      </div>
    </div>
  );
};

export default LoginModal; 