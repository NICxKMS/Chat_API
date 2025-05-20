import { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { SearchIcon, XIcon } from '@primer/octicons-react';
import styles from './ModelSearch.module.css';

/**
 * Search input for filtering models
 * @param {Object} props - Component props
 * @param {string} props.searchTerm - Current search term
 * @param {Function} props.onSearchChange - Search term change handler
 * @param {number} props.resultCount - Number of search results
 * @returns {JSX.Element} - Rendered component
 */
const ModelSearch = ({ searchTerm, onSearchChange, resultCount }) => {
  const inputRef = useRef(null);
  
  // Handle search input changes
  const handleInputChange = useCallback((e) => {
    // Pass the value directly instead of the event object
    if (e && typeof e === 'object' && e.target) {
      onSearchChange(e.target.value);
    } else {
      console.warn('Invalid event object in ModelSearch handleInputChange');
    }
  }, [onSearchChange]);
  
  // Clear search input
  const handleClearSearch = useCallback(() => {
    // Pass empty string directly
    onSearchChange('');
    
    // Focus the input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onSearchChange]);
  
  return (
    <div className={styles.ModelSearch}>
      <div className={styles.ModelSearch__inputWrapper}>
        <SearchIcon className={styles.ModelSearch__icon} size={16} />
        
        <input
          ref={inputRef}
          type="text"
          className={styles.ModelSearch__input}
          placeholder="Search models..."
          value={searchTerm}
          onChange={handleInputChange}
          aria-label="Search models"
        />
        
        {searchTerm && (
          <button 
            className={styles.ModelSearch__clearButton} 
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <XIcon className={styles.ModelSearch__clearIcon} size={16} />
          </button>
        )}
      </div>
      
      {searchTerm && (
        <div className={styles.ModelSearch__results}>
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </div>
      )}
    </div>
  );
};

ModelSearch.propTypes = {
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  resultCount: PropTypes.number.isRequired
};

export default ModelSearch; 