import { createContext, useContext, useState, useMemo } from 'react';

// Create API context
const ApiContext = createContext();

// Custom hook for using API context
export const useApi = () => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

// API provider component
export const ApiProvider = ({ children }) => {
  const [apiUrl] = useState(import.meta.env.REACT_APP_API_URL || 'http://localhost:3000/api'); // Base API URL

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    apiUrl,
  }), [apiUrl]);

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}; 