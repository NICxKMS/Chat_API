import PropTypes from 'prop-types';
import styles from './GlobalMetricsBar.module.css';

/**
 * Displays global/session-level metrics above the chat input.
 */
const GlobalMetricsBar = ({ metrics = null, modelName = null }) => {
  if (!metrics) {
    return null; // Don't render if no metrics are available
  }

  // Example metrics - adapt based on what `useChatLogic` provides in `metrics`
  const totalMessages = metrics.totalMessages || 0;
  const avgResponseTime = metrics.avgResponseTime?.toFixed(2) || 'N/A';
  const totalTokens = metrics.totalTokens || 0;

  return (
    <div className={styles.GlobalMetricsBar}>
      {modelName && (
        <span className={styles.GlobalMetricsBar__item} title="Current Model"> 
          🧠 {modelName}
        </span>
      )}
      <span className={styles.GlobalMetricsBar__item} title="Total Messages in Session"> 
        💬 {totalMessages} 
      </span>
      <span className={styles.GlobalMetricsBar__item} title="Average Response Time (seconds)">
        ⏱️ {avgResponseTime}s 
      </span>
       <span className={styles.GlobalMetricsBar__item} title="Total Tokens Used in Session"> 
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

export default GlobalMetricsBar; 