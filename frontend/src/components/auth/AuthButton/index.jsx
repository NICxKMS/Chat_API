import { memo } from 'react';
import PropTypes from 'prop-types';
import { SignInIcon} from '@primer/octicons-react';
import { useProfilePicture } from '../../../hooks/useProfilePicture';
// Import icons using the correct paths
import '../../../styles/common/buttons.css';
// import component-specific styles for avatar/initial only
import styles from './AuthButton.module.css';
import Spinner from '../../common/Spinner';

/**
 * Auth button component for login/logout
 * @param {Object} props - Component props
 * @param {boolean} props.isAuthenticated - Whether the user is authenticated
 * @param {Function} props.onLogin - Function to handle login
 * @param {Function} props.onLogout - Function to handle logout
 * @param {string} props.userName - User's display name or email
 * @param {boolean} props.isLoading - Whether authentication is in progress
 * @param {Object} props.currentUser - Firebase user object with photoURL
 * @returns {JSX.Element} - Rendered component
 */
const AuthButton = memo(({ 
  isAuthenticated, 
  onLogin, 
  onLogout, 
  userName = 'User',
  isLoading = false,
  currentUser = null
}) => {
  const { profilePicture, loading: avatarLoading } = useProfilePicture(currentUser?.photoURL);

  return (
    <button
      className="circleActionButton"
      onClick={isAuthenticated ? onLogout : onLogin}
      disabled={isLoading}
      title={isLoading ? "Checking authentication..." : isAuthenticated ? `Logged in as ${userName}. Click to logout.` : "Login / Sign Up"}
      aria-label={isLoading ? "Loading Authentication" : isAuthenticated ? "Logout" : "Login or Sign Up"}
    >
      {isLoading ? (
        <Spinner size="small" tag="auth" />
      ) : isAuthenticated ? (
        currentUser?.photoURL ? (
          avatarLoading ? (
            <Spinner size="small" tag="avatar" />
          ) : profilePicture ? (
            <img 
              src={profilePicture} 
              alt={`${userName}'s profile`}
              className={styles.AuthButton__avatar}
              loading="lazy"
            />
          ) : (
            <div className={styles.AuthButton__initial}>
              {userName.charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <div className={styles.AuthButton__initial}>
            {userName.charAt(0).toUpperCase()}
          </div>
        )
      ) : (
        <SignInIcon size={20} />
      )}
    </button>
  );
});

// Display name for debugging
AuthButton.displayName = 'AuthButton';

export default AuthButton;

// Define PropTypes
AuthButton.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  onLogin: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  userName: PropTypes.string,
  isLoading: PropTypes.bool,
  currentUser: PropTypes.shape({
    displayName: PropTypes.string,
    email: PropTypes.string,
    photoURL: PropTypes.string
  })
};
