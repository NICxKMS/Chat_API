import React from 'react';
import PropTypes from 'prop-types';
import styles from './ToastNotification.module.css';

/**
 * ToastNotification component renders a list of toast messages.
 * @param {Object} props
 * @param {Array} props.toasts - Array of toast objects { id, type, message, duration }
 * @param {Function} props.dismissToast - Function to remove a toast by id
 */
const ToastNotification = ({ toasts, dismissToast }) => {
  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type] || ''}`}> 
          <span className={styles.message}>{toast.message}</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => dismissToast(toast.id)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

ToastNotification.propTypes = {
  toasts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['error', 'success', 'info', 'warning']),
      message: PropTypes.string.isRequired,
      duration: PropTypes.number
    })
  ).isRequired,
  dismissToast: PropTypes.func.isRequired
};

export default ToastNotification; 