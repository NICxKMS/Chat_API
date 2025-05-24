import React, { createContext, useContext, useReducer, useCallback } from 'react';
import ToastContainer from '../components/common/ToastNotification';

// Create context for toast notifications
const ToastContext = createContext();

// Hook to use toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Action types
const ADD_TOAST = 'ADD_TOAST';
const REMOVE_TOAST = 'REMOVE_TOAST';

// Reducer to manage toast list
function toastReducer(state, action) {
  switch (action.type) {
    case ADD_TOAST:
      return [...state, action.payload];
    case REMOVE_TOAST:
      return state.filter(toast => toast.id !== action.payload);
    default:
      return state;
  }
}

// Provider component that holds toast state and renders toasts
export const ToastProvider = ({ children }) => {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  // Function to show a toast
  const showToast = useCallback(({ type, message, duration = 3000 }) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    dispatch({ type: ADD_TOAST, payload: { id, type, message, duration } });
    // Auto-dismiss toast after duration
    setTimeout(() => dispatch({ type: REMOVE_TOAST, payload: id }), duration);
    return id;
  }, []);

  // Function to manually dismiss a toast
  const dismissToast = useCallback(id => {
    dispatch({ type: REMOVE_TOAST, payload: id });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  );
}; 