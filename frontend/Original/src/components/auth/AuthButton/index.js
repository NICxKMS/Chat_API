import React from 'react';
// Import icons using the correct paths
import { PersonIcon, SignOutIcon } from '@primer/octicons-react';
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
const AuthButton = ({ 
  isAuthenticated, 
  onLogin, 
  onLogout, 
  userName, 
  isLoading 
}) => {
  const handleClick = () => {
    if (isLoading) return;
    if (isAuthenticated) {
      onLogout();
    } else {
      onLogin();
    }
  };

  return (
    <button
      className={`${styles.authButton} ${isLoading ? styles.loading : ''}`}
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isAuthenticated ? 'Sign out' : 'Sign in'}
      title={isAuthenticated ? `Sign out (${userName})` : 'Sign in'}
    >
      {isAuthenticated ? (
        <SignOutIcon size={20} className={styles.icon} />
      ) : (
        <PersonIcon size={20} className={styles.icon} />
      )}
    </button>
  );
};

// Display name for debugging
AuthButton.displayName = 'AuthButton';

export default AuthButton;
