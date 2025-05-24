import React from 'react';
import PropTypes from 'prop-types';
import styles from './Spinner.module.css';

/**
 * Standardized Spinner for all loading states
 * @param {Object} props
 * @param {string} props.size - One of 'small', 'medium', 'large'
 * @param {string} props.tag - Optional loading tag for context
 */
const Spinner = ({ size = 'medium', tag }) => {
  const sizeClass = styles[`Spinner--${size}`] || styles['Spinner--medium'];
  return (
    <div className={`${styles.Spinner} ${sizeClass}`} data-loading-tag={tag} aria-label="Loading" role="status">
      <div className={styles.Spinner__loader} />
    </div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  tag: PropTypes.string
};

export default Spinner; 