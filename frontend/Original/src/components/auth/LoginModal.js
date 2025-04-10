import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getFirebaseAuth } from '../../firebaseConfig';
// Import Firebase auth functions using the correct paths
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  EmailAuthProvider, 
  GithubAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import styles from './LoginModal.module.css';
import Spinner from '../common/Spinner'; // Assuming a Spinner component exists

// Import icons using the correct paths
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import { IoMdClose } from "react-icons/io";
import { MdOutlineEmail } from "react-icons/md"; // Icon for email/pass

const LoginModal = ({ onClose }) => {
  const { setIsLoggingIn, error: authContextError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailPasswordMode, setIsEmailPasswordMode] = useState(true); // Default to Email/Password mode

  // Clear local error when auth context error changes (e.g., token fetch error)
  useEffect(() => {
    if (authContextError) {
      setError(authContextError);
    }
  }, [authContextError]);

  const handleSignIn = async (provider) => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized. Cannot sign in.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Add a timeout to handle popup blocking
      const popupTimeout = setTimeout(() => {
        if (isLoading) {
          setError('Popup blocked or timed out. Please allow popups for this site.');
          setIsLoading(false);
        }
      }, 10000); // 10 second timeout

      await signInWithPopup(auth, provider);
      clearTimeout(popupTimeout);
      console.log("Popup sign-in successful.");
    } catch (err) {
      console.error("Popup Sign-in Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('Popup sign-in cancelled by user.');
        closeModal();
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.log('Popup sign-in cancelled (multiple requests).');
        closeModal();
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked by browser. Please allow popups for this site.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized.");
      setIsLoading(false);
      return;
    }
    if (!email || !password) {
      setError("Please enter both email and password.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Email/Password sign-in successful.");
    } catch (err) {
      console.error("Email Sign-in Error:", err);
      let errorMessage = 'Failed to sign in with email.';
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not initialized.");
      setIsLoading(false);
      return;
    }
    if (!email || !password) {
      setError("Please enter both email and password.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("Email/Password sign-up successful.");
    } catch (err) {
      console.error("Email Sign-up Error:", err);
      let errorMessage = 'Failed to sign up with email.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled.';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    const googleProvider = new GoogleAuthProvider();
    handleSignIn(googleProvider);
  };

  const handleGithubSignIn = () => {
    const githubProvider = new GithubAuthProvider();
    handleSignIn(githubProvider);
  };

  const closeModal = () => {
    setIsLoading(false);
    setIsLoggingIn(false);
    if (onClose) onClose();
  };

  // For closing when clicking on the overlay background
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  // Add error boundary fallback
  if (error && error.includes('critical')) {
    return (
      <div className={styles.overlay} onClick={handleOverlayClick}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h2 className={styles.title}>Error</h2>
          <p className={styles.error}>{error}</p>
          <button className={styles.closeButton} onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={closeModal} aria-label="Close login">
          <IoMdClose />
        </button>
        <h2 className={styles.title}>Login / Sign Up</h2>
        <p className={styles.subtitle}>Choose a provider to continue</p>

        {isLoading && (
          <div className={`${styles.spinnerContainer} ${styles.fullHeightSpinner}`}>
            <Spinner size="large" />
            <p>Connecting...</p>
          </div>
        )}

        {!isLoading && (
          <form className={styles.emailForm} onSubmit={handleEmailSignIn}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.inputField}
              disabled={isLoading}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.inputField}
              disabled={isLoading}
            />
            <div className={styles.emailButtonContainer}>
              <button type="submit" className={styles.emailButton} disabled={isLoading}>
                Sign In
              </button>
              <button type="button" onClick={handleEmailSignUp} className={`${styles.emailButton} ${styles.signUpButton}`} disabled={isLoading}>
                Sign Up
              </button>
            </div>
          </form>
        )}

        {!isLoading && (
          <div className={styles.alternativeLoginContainer}>
            <p className={styles.alternativeLoginText}>Or sign in with</p>
            <div className={styles.providerIconContainer}>
              <button
                className={styles.providerIconButton}
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                title="Sign in with Google"
                aria-label="Sign in with Google"
              >
                <FcGoogle />
              </button>
              <button
                className={styles.providerIconButton}
                onClick={handleGithubSignIn}
                disabled={isLoading}
                title="Sign in with GitHub"
                aria-label="Sign in with GitHub"
              >
                <FaGithub />
              </button>
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.footerText}>
          By signing in, you agree to our imaginary Terms of Service.
        </p>
      </div>
    </div>
  );
};

export default LoginModal; 