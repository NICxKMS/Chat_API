import PropTypes from 'prop-types';
import styles from './SettingsToggle.module.css';

/**
 * Settings toggle switch for boolean settings
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the toggle
 * @param {string} props.label - Label text for the toggle
 * @param {boolean} props.isChecked - Whether the toggle is checked
 * @param {Function} props.onChange - Function to call when toggle changes
 * @param {string} [props.tooltip] - Optional tooltip text
 * @returns {JSX.Element} - Rendered component
 */
const SettingsToggle = ({ id, label, isChecked, onChange, tooltip }) => {
  return (
    <div className={styles.settingsToggleContainer}>
      <label className={styles.toggleLabel} htmlFor={id}>
        <span className={styles.labelText}>{label}</span>
        {tooltip && (
          <span className={styles.tooltip} data-tooltip={tooltip}>
            <InfoIcon className={styles.infoIcon} />
          </span>
        )}
      </label>
      
      <button 
        id={id}
        type="button"
        role="switch"
        aria-checked={isChecked}
        className={`${styles.toggle} ${isChecked ? styles.checked : ''}`}
        onClick={() => onChange(!isChecked)}
      >
        <span className={styles.toggleTrack}>
          <span className={styles.toggleThumb} />
        </span>
        <span className={styles.srOnly}>
          {label} is {isChecked ? 'enabled' : 'disabled'}
        </span>
      </button>
    </div>
  );
};

// Info icon component
const InfoIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

SettingsToggle.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  isChecked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  tooltip: PropTypes.string
};

export default SettingsToggle; 