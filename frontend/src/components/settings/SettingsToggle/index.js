import PropTypes from 'prop-types';
import { InfoIcon } from '../icons';
import styles from './SettingsToggle.module.css';
import commonStyles from '../common/ControlStyles.module.css';

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
  const checkedClass = variant === 'switch' 
    ? styles['SettingsToggle__switchTrack--checked'] 
    : styles['SettingsToggle__track--checked'];

  // Combine container classes including common control styles
  const toggleClasses = [commonStyles.controlContainer, containerClass];
  if (disabled) toggleClasses.push(styles['SettingsToggle--disabled']);
  if (size === 'small') toggleClasses.push(styles['SettingsToggle--small']);
  else if (size === 'large') toggleClasses.push(styles['SettingsToggle--large']);
  
  return (
    <div className={toggleClasses.join(' ')}>
      <div className={commonStyles.controlHeader}>
        <label htmlFor={id} className={commonStyles.controlLabel}>
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