import React from 'react';
import PropTypes from 'prop-types';
import { XIcon } from '@primer/octicons-react';
import styles from './ImagePreviewList.module.css';

const ImagePreviewList = ({ images, onRemoveImage }) => {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className={styles.imagePreviewContainer}>
      {images.map((image, index) => (
        <div key={index} className={styles.imagePreviewWrapper}>
          <img 
            src={image.url} 
            alt={`preview ${index}`} 
            className={styles.imagePreview} 
          />
          <button 
            className={styles.removeImageButton} 
            onClick={() => onRemoveImage(index)}
            aria-label={`Remove image ${index + 1}`}
            title={`Remove image ${index + 1}`}
          >
            <XIcon size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

ImagePreviewList.propTypes = {
  images: PropTypes.arrayOf(PropTypes.shape({
    url: PropTypes.string.isRequired,
    name: PropTypes.string // Name might not always be relevant here
  })).isRequired,
  onRemoveImage: PropTypes.func.isRequired,
};

export default React.memo(ImagePreviewList); 