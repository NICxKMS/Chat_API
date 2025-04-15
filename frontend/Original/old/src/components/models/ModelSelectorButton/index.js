import PropTypes from 'prop-types';
import styles from './ModelSelectorButton.module.css';

/**
 * Button to trigger the model selection UI (Dropdown/Modal)
 */
const ModelSelectorButton = ({ 
  selectedModelName = null, 
  onClick, 
  disabled = false 
}) => {
  return (
    <button 
      className={styles.modelSelectorButton}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="true" // Indicate it triggers a popup menu/dialog
      aria-label={`Select Model (Current: ${selectedModelName || 'None'})`}
      role="button" // Added role for clarity
    >
      {/* Inner span for the gradient border effect */}
      <span className={styles.innerContent}>
        <span className={styles.buttonText}>
          {selectedModelName ? `Model: ${selectedModelName}` : 'Select a Model'}
        </span>
        <ChevronDownIcon size={16} className={styles.buttonIcon} />
      </span>
    </button>
  );
};

ModelSelectorButton.propTypes = {
  /** Currently selected model name to display */
  selectedModelName: PropTypes.string,
  /** Function to call when the button is clicked */
  onClick: PropTypes.func.isRequired,
  /** Whether the button should be disabled */
  disabled: PropTypes.bool,
};

export default ModelSelectorButton; 