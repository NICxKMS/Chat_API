import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Create API context
const ApiContext = createContext();

// Default API status check interval in milliseconds (30 seconds)
const DEFAULT_STATUS_CHECK_INTERVAL = 30000;

// Custom hook for using API context
export const useApi = () => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

// API provider component
export const ApiProvider = ({ children, statusCheckInterval }) => {
  // Get configurable interval or use default
  const STATUS_CHECK_INTERVAL = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL;
  
  const [apiStatus, setApiStatus] = useState({
    online: false,
    checking: true,
    lastChecked: null
  });
  
  const [apiUrl] = useState(process.env.REACT_APP_API_URL || 'localhost:3000/api'); // Base API URL, fallback to /api

  // Check API status
  const checkApiStatus = useCallback(async () => {
    setApiStatus(prev => ({ ...prev, checking: true }));
    
    try {
      const response = await fetch(`${apiUrl}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const isOnline = response.ok;
      
      setApiStatus({
        online: isOnline,
        checking: false,
        lastChecked: new Date()
      });
      
      return isOnline;
    } catch (error) {
      console.error('API status check failed:', error);
      setApiStatus({
        online: false,
        checking: false,
        lastChecked: new Date(),
        error: error.message
      });
      
      return false;
    }
  }, [apiUrl]);

  // Check API status on mount and set interval
  useEffect(() => {
    // Initial check
    checkApiStatus();
    
    // Set up interval for periodic checks
    const intervalId = setInterval(checkApiStatus, STATUS_CHECK_INTERVAL);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [checkApiStatus, STATUS_CHECK_INTERVAL]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    apiStatus,
    checkApiStatus,
    apiUrl,
    statusCheckInterval: STATUS_CHECK_INTERVAL
  }), [apiStatus, checkApiStatus, apiUrl, STATUS_CHECK_INTERVAL]);

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}; 