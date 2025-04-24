import PropTypes from 'prop-types';
import { InfoIcon } from '../icons';
import styles from './SettingsToggle.module.css';

/**
 * Universal boolean control component (toggle/switch)
 */
const BooleanControl = ({ 
  id, 
  label, 
  isChecked, 
  onChange, 
  tooltip,
  disabled = false,
  variant = 'toggle',
  size = 'medium'
}) => {
  const handleKeyDown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onChange(!isChecked);
    }
  };

  const containerClass = variant === 'switch' ? styles.switchContainer : styles.toggleContainer;
  const trackClass = variant === 'switch' ? styles.switchTrack : styles.toggleTrack;
  const thumbClass = variant === 'switch' ? styles.switchThumb : styles.toggleThumb;
  const sizeClass = size === 'small' ? styles.small : size === 'large' ? styles.large : '';

  return (
    <div className={`${containerClass} ${disabled ? styles.disabled : ''} ${sizeClass}`}>
      <label className={styles.toggleLabel} htmlFor={id}>
        <span className={styles.labelText}>{label}</span>
        {tooltip && (
          <span className={styles.tooltip} data-tooltip={tooltip}>
            <InfoIcon className={styles.infoIcon} />
          </span>
        )}
      </label>
      
      <div 
        className={`${trackClass} ${isChecked ? styles.checked : ''}`}
        onClick={() => !disabled && onChange(!isChecked)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="switch"
        aria-checked={isChecked}
        aria-disabled={disabled}
      >
        <span className={thumbClass} />
        <input
          id={id}
          type="checkbox"
          checked={isChecked}
          onChange={() => !disabled && onChange(!isChecked)}
          disabled={disabled}
          className={styles.hiddenInput}
        />
        <span className={styles.srOnly}>
          {label} is {isChecked ? 'enabled' : 'disabled'}
        </span>
      </div>
    </div>
  );
};

BooleanControl.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  isChecked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  tooltip: PropTypes.string,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['toggle', 'switch']),
  size: PropTypes.oneOf(['small', 'medium', 'large'])
};

export default BooleanControl; 