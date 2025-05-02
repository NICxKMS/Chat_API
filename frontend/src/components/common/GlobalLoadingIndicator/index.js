import { useEffect, useRef } from 'react';
import { useLoading } from '../../../contexts/LoadingContext';
import { useToast } from '../../../contexts/ToastContext';

const GlobalLoadingIndicator = () => {
  // Only show global loading overlay for authentication operations
  const [authLoading] = useLoading('auth');
  const isLoading = authLoading;
  const { showToast, dismissToast } = useToast();
  const toastIdRef = useRef(null);
  useEffect(() => {
    if (isLoading) {
      // show persistent loading toast for heavy operations
      toastIdRef.current = showToast({ type: 'info', message: 'Loading in progress...', duration: 0 });
    } else if (toastIdRef.current) {
      // dismiss loading toast and show completion
      dismissToast(toastIdRef.current);
      showToast({ type: 'success', message: 'Loading complete', duration: 2000 });
      toastIdRef.current = null;
    }
    return () => {
      if (toastIdRef.current) {
        dismissToast(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [isLoading, showToast, dismissToast]);

  // No overlay spinner; toasts still handled in useEffect
  return null;
};

export default GlobalLoadingIndicator; 