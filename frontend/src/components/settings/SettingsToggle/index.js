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

  const containerClass = variant === 'switch' ? styles.SettingsToggle__switchContainer : styles.SettingsToggle__toggleContainer;
  const trackClass = variant === 'switch' ? styles.SettingsToggle__switchTrack : styles.SettingsToggle__track;
  const thumbClass = variant === 'switch' ? styles.SettingsToggle__switchThumb : styles.SettingsToggle__toggleThumb;
  const sizeClass = size === 'small' ? styles['SettingsToggle--small'] : size === 'large' ? styles['SettingsToggle--large'] : '';
  const checkedClass = variant === 'switch' 
    ? styles['SettingsToggle__switchTrack--checked'] 
    : styles['SettingsToggle__track--checked'];

  return (
    <div className={`${containerClass} ${disabled ? styles['SettingsToggle--disabled'] : ''} ${sizeClass}`}>
      <label className={styles.SettingsToggle__label} htmlFor={id}>
        <span className={styles.SettingsToggle__labelText}>{label}</span>
        {tooltip && (
          <span className={styles.SettingsToggle__tooltip} data-tooltip={tooltip}>
            <InfoIcon className={styles.SettingsToggle__infoIcon} />
          </span>
        )}
      </label>
      
      <div 
        className={`${trackClass} ${isChecked ? checkedClass : ''}`}
        onClick={() => !disabled && onChange(!isChecked)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="switch"
        aria-checked={isChecked}
        aria-disabled={disabled}
      >
        <span className={styles.SettingsToggle__thumb} />
        <input
          id={id}
          type="checkbox"
          checked={isChecked}
          onChange={() => !disabled && onChange(!isChecked)}
          disabled={disabled}
          className={styles.SettingsToggle__hiddenInput}
        />
        <span className={styles.SettingsToggle__srOnly}>
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