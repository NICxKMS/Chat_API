import React from 'react';
import PropTypes from 'prop-types';
import styles from './GlobalMetricsBar.module.css';

/**
 * Displays global/session-level metrics above the chat input.
 */
const GlobalMetricsBar = ({ metrics, modelName }) => {
  if (!metrics) {
    return null; // Don't render if no metrics are available
  }

  // Example metrics - adapt based on what `useChatLogic` provides in `metrics`
  const totalMessages = metrics.totalMessages || 0;
  const avgResponseTime = metrics.avgResponseTime?.toFixed(2) || 'N/A';
  const totalTokens = metrics.totalTokens || 0;

  return (
    <div className={styles.metricsBar}>
      {modelName && (
        <span className={styles.metricItem} title="Current Model"> 
          🧠 {modelName}
        </span>
      )}
      <span className={styles.metricItem} title="Total Messages in Session"> 
        💬 {totalMessages} 
      </span>
      <span className={styles.metricItem} title="Average Response Time (seconds)">
        ⏱️ {avgResponseTime}s 
      </span>
       <span className={styles.metricItem} title="Total Tokens Used in Session"> 
        #️⃣ {totalTokens} 
      </span>
       {/* Add more metrics as needed */}
    </div>
  );
};

GlobalMetricsBar.propTypes = {
  /** Object containing global metrics data */
  metrics: PropTypes.shape({
    totalMessages: PropTypes.number,
    avgResponseTime: PropTypes.number,
    totalTokens: PropTypes.number,
    // Add other expected metrics
  }),
  /** Name of the currently selected model */
  modelName: PropTypes.string,
};

GlobalMetricsBar.defaultProps = {
  metrics: null,
  modelName: null,
};

export default GlobalMetricsBar; 