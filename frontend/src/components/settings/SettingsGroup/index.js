import { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './SettingsGroup.module.css';

const SettingsGroup = ({
  title,
  description = '',
  children,
  defaultExpanded = true,
  id
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`${styles.SettingsGroup} ${isExpanded ? styles['SettingsGroup--expanded'] : ''}`} id={id}>
      <div 
        className={styles.SettingsGroup__header}
        onClick={toggleExpanded}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className={styles.SettingsGroup__titleContainer}>
          <h3 className={styles.title}>{title}</h3>
          <button 
            className={styles.SettingsGroup__expandButton}
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              xmlns="http://www.w3.org/2000/svg"
              className={styles.SettingsGroup__expandIcon}
            >
              <path 
                fillRule="evenodd" 
                clipRule="evenodd" 
                d="M8 10.5858L3.70711 6.29289C3.31658 5.90237 2.68342 5.90237 2.29289 6.29289C1.90237 6.68342 1.90237 7.31658 2.29289 7.70711L7.29289 12.7071C7.68342 13.0976 8.31658 13.0976 8.70711 12.7071L13.7071 7.70711C14.0976 7.31658 14.0976 6.68342 13.7071 6.29289C13.3166 5.90237 12.6834 5.90237 12.2929 6.29289L8 10.5858Z" 
              />
            </svg>
          </button>
        </div>
        {description && <p className={styles.SettingsGroup__description}>{description}</p>}
      </div>
      
      {isExpanded && (
        <div className={`${styles.SettingsGroup__content} animation-slide-up`}>
          {children}
        </div>
      )}
    </div>
  );
};

SettingsGroup.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  defaultExpanded: PropTypes.bool,
  id: PropTypes.string
};

export default SettingsGroup; 