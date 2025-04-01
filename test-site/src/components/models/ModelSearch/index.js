import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
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
    onSearchChange(e.target.value);
  }, [onSearchChange]);
  
  // Clear search input
  const handleClearSearch = useCallback(() => {
    onSearchChange('');
    
    // Focus the input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onSearchChange]);
  
  return (
    <div className={styles.searchContainer}>
      <div className={styles.inputWrapper}>
        <SearchIcon className={styles.searchIcon} />
        
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Search models..."
          value={searchTerm}
          onChange={handleInputChange}
          aria-label="Search models"
        />
        
        {searchTerm && (
          <button 
            className={styles.clearButton} 
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <XIcon className={styles.clearIcon} />
          </button>
        )}
      </div>
      
      {searchTerm && (
        <div className={styles.results}>
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </div>
      )}
    </div>
  );
};

// SVG icons as components
const SearchIcon = ({ className }) => (
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const XIcon = ({ className }) => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

ModelSearch.propTypes = {
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  resultCount: PropTypes.number.isRequired
};

export default ModelSearch; 