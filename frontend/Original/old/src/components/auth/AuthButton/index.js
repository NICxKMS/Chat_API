import { memo } from 'react';
// Import icons using the correct paths
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
    <button 
      className={styles.authButton}
      onClick={isAuthenticated ? onLogout : onLogin}
      disabled={isLoading}
      title={isLoading ? "Checking authentication..." : isAuthenticated ? `Logged in as ${userName}. Click to logout.` : "Login / Sign Up"}
      aria-label={isLoading ? "Loading Authentication" : isAuthenticated ? "Logout" : "Login or Sign Up"}
    >
      {isLoading ? (
        <div className={styles.spinner}></div>
      ) : isAuthenticated ? (
        <SignOutIcon size={20} className={styles.icon} />
      ) : (
        <SignInIcon size={20} className={styles.icon} />
      )}
    </button>
  );
});

// Display name for debugging
AuthButton.displayName = 'AuthButton';

export default AuthButton;
