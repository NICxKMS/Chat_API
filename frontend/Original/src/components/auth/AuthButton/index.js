import React, { memo } from 'react';
import { SignInIcon, SignOutIcon } from '@primer/octicons-react';
import styles from './AuthButton.module.css';

/**
 * Auth button component for login/logout
 * @param {Object} props - Component props
 * @param {boolean} props.isAuthenticated - Whether the user is authenticated
 * @param {Function} props.onLogin - Function to handle login
 * @param {Function} props.onLogout - Function to handle logout
 * @param {string} props.userName - User's display name or email
 * @param {boolean} props.isLoading - Whether authentication is in progress
 * @returns {JSX.Element} - Rendered component
 */
const AuthButton = memo(({ 
  isAuthenticated, 
  onLogin, 
  onLogout, 
  userName,
  isLoading 
}) => {
  return (
    <div className={styles.authButtonContainer}>
      {isLoading ? (
        <button 
          className={styles.authButton} 
          disabled 
          title="Checking authentication..."
        >
          <div className={styles.spinner}></div>
        </button>
      ) : isAuthenticated ? (
        <button 
          className={styles.authButton}
          onClick={onLogout}
          title={`Logged in as ${userName}. Click to logout.`}
          aria-label="Logout"
        >
          <SignOutIcon size={20} />
        </button>
      ) : (
        <button 
          className={styles.authButton}
          onClick={onLogin}
          title="Login / Sign Up"
          aria-label="Login or Sign Up"
        >
          <SignInIcon size={20} />
        </button>
      )}
    </div>
  );
});

// Display name for debugging
AuthButton.displayName = 'AuthButton';

export default AuthButton;
