import ReactDOM from 'react-dom'; // Import ReactDOM
import PropTypes from 'prop-types';
import styles from './ImageOverlay.module.css';

/**
 * Full-screen overlay for displaying an image using React Portal.
 * Clicking anywhere on the overlay closes it.
 */
const ImageOverlay = ({ src, alt, onClose }) => {
  if (!src) return null;

  // Prevent clicks on the image itself from closing if needed (optional)
  const handleImageClick = (e) => {
    e.stopPropagation(); // Prevents the overlay click handler from firing
    // Could potentially add other actions here, like zoom controls
  };

  // The overlay content
  const overlayContent = (
    <div className={styles.ImageOverlay} onClick={onClose} role="dialog" aria-modal="true" title="Click to close image">
      <img 
        src={src} 
        alt={alt} 
        className={styles.ImageOverlay__image}
        onClick={handleImageClick} // Handle clicks on the image specifically
      />
    </div>
  );

  // Use ReactDOM.createPortal to render the overlay into document.body
  return ReactDOM.createPortal(
    overlayContent,
    document.body 
  );
};

ImageOverlay.propTypes = {
  /** The URL of the image to display */
  src: PropTypes.string.isRequired,
  /** The alt text for the image */
  alt: PropTypes.string.isRequired,
  /** Function to call when the overlay should be closed */
  onClose: PropTypes.func.isRequired,
};

export default ImageOverlay; 