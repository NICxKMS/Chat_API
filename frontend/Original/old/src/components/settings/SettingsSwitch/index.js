import PropTypes from 'prop-types';
import styles from './SettingsSwitch.module.css';

const SettingsSwitch = ({
  id,
  label,
  isChecked,
  onChange,
  disabled = false,
  tooltip
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onChange(!isChecked);
      }
    }
  };

  return (
    <div className={`${styles.switchContainer} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.switchWrapper}>
        <label htmlFor={id} className={styles.label} title={tooltip || ''}>
          {label}
        </label>
        
        <div 
          className={styles.switchTrack}
          onClick={() => !disabled && onChange(!isChecked)}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="switch"
          aria-checked={isChecked}
          aria-disabled={disabled}
        >
          <div 
            className={`${styles.switchThumb} ${isChecked ? styles.checked : ''}`}
          />
          <input
            type="checkbox"
            id={id}
            checked={isChecked}
            onChange={() => !disabled && onChange(!isChecked)}
            disabled={disabled}
            className={styles.hiddenInput}
          />
        </div>
      </div>
    </div>
  );
};

SettingsSwitch.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  isChecked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  tooltip: PropTypes.string
};

export default SettingsSwitch; 