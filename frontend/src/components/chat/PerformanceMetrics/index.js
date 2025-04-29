import { memo, useMemo, useEffect } from 'react';
import styles from './PerformanceMetrics.module.css';

/**
 * Component to display performance metrics for AI responses
 * @param {Object} props - Component props
 * @param {Object} props.metrics - Metrics data including token counts and timing
 * @returns {JSX.Element|null} - Rendered component or null if no metrics
 */
const PerformanceMetrics = memo(({ metrics }) => {
  const { 
    elapsedTime, 
    tokensPerSecond, 
    isComplete, 
    promptTokens, 
    completionTokens, 
    totalTokens,
    finishReason
  } = metrics || {};
  
  // Debug metrics data
  useEffect(() => {
    if (metrics) {
      console.log('PerformanceMetrics received:', { 
        promptTokens, 
        completionTokens, 
        totalTokens,
        finishReason,
        allMetrics: metrics 
      });
    }
  }, [metrics, promptTokens, completionTokens, totalTokens, finishReason]);
  
  // Format elapsed time
  const formattedTime = useMemo(() => {
    if (!elapsedTime) return '';
    return `${(elapsedTime / 1000).toFixed(2)}s`;
  }, [elapsedTime]);
  
  // Format token count with detailed info when available
  const formattedTokens = useMemo(() => {
    // Only show completion token count
    if (completionTokens) {
      return `${completionTokens} tokens${isComplete ? '' : '...'}`;
    }
    return '';
  }, [completionTokens, isComplete]);
  
  // Create tooltip with detailed token info
  const tokenTooltip = useMemo(() => {
    const parts = [];
    
    if (promptTokens) parts.push(`Prompt: ${promptTokens}`);
    if (completionTokens) parts.push(`Completion: ${completionTokens}`);
    if (totalTokens) parts.push(`Total: ${totalTokens}`);
    if (finishReason) parts.push(`Finish: ${finishReason}`);
    
    if (parts.length > 0) {
      return parts.join(' | ');
    }
    
    return 'Token count';
  }, [promptTokens, completionTokens, totalTokens, finishReason]);
  
  // Show detailed metrics when available
  const showDetailedMetrics = useMemo(() => {
    return !!(promptTokens && totalTokens);
  }, [promptTokens, totalTokens]);
  
  // Only show TPS if we have token count, elapsed time > 0.5s, and calculated TPS
  const showTps = useMemo(() => {
    return completionTokens && elapsedTime > 500 && tokensPerSecond;
  }, [completionTokens, elapsedTime, tokensPerSecond]);
  
  // Skip rendering if no metrics available
  if (!elapsedTime || !completionTokens) {
    return null;
  }
  
  return (
    <div className={styles.PerformanceMetrics}>
      <span className={`${styles.PerformanceMetrics__metric} ${styles['PerformanceMetrics__metric--time']}`} title="Response time">
        <ClockIcon className={styles.PerformanceMetrics__icon} />
        {formattedTime}
      </span>
      
      <span className={`${styles.PerformanceMetrics__metric} ${styles['PerformanceMetrics__metric--tokens']}`} title={tokenTooltip}>
        <TokenIcon className={styles.PerformanceMetrics__icon} />
        {formattedTokens}
      </span>
      
      {showTps && (
        <span className={`${styles.PerformanceMetrics__metric} ${styles['PerformanceMetrics__metric--tps']}`} title="Tokens per second">
          <SpeedIcon className={styles.PerformanceMetrics__icon} />
          {tokensPerSecond} TPS
        </span>
      )}
      
      {showDetailedMetrics && (
        <span className={`${styles.PerformanceMetrics__metric} ${styles['PerformanceMetrics__metric--detailed']}`} title={tokenTooltip}>
          <InfoIcon className={styles.PerformanceMetrics__icon} />
          P:{promptTokens}/T:{totalTokens}
        </span>
      )}
    </div>
  );
});

// SVG icons as components for better performance
const ClockIcon = ({ className }) => (
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
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TokenIcon = ({ className }) => (
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
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
    <line x1="16" y1="8" x2="2" y2="22" />
    <line x1="17.5" y1="15" x2="9" y2="15" />
  </svg>
);

const SpeedIcon = ({ className }) => (
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
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
  </svg>
);

const InfoIcon = ({ className }) => (
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
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// Display name for debugging
PerformanceMetrics.displayName = 'PerformanceMetrics';

export default PerformanceMetrics; 