/**
 * Performance monitoring utility
 * Tracks various performance metrics and provides methods for optimization
 */

// Performance marks for tracking different stages of app initialization
const PERFORMANCE_MARKS = {
  APP_START: 'app-start',
  CONTEXT_INIT: 'context-init',
  COMPONENT_LOAD: 'component-load',
  APP_READY: 'app-ready'
};

// Performance measures for tracking durations
const PERFORMANCE_MEASURES = {
  TOTAL_LOAD: 'total-load-time',
  CONTEXT_INIT: 'context-init-time',
  COMPONENT_LOAD: 'component-load-time'
};

class PerformanceMonitor {
  constructor() {
    this.marks = new Set();
    this.measures = new Set();
  }

  /**
   * Mark a specific point in time
   * @param {string} markName - Name of the performance mark
   */
  mark(markName) {
    if (performance && performance.mark) {
      performance.mark(markName);
      this.marks.add(markName);
    }
  }

  /**
   * Measure duration between two marks
   * @param {string} measureName - Name of the performance measure
   * @param {string} startMark - Name of the start mark
   * @param {string} endMark - Name of the end mark
   */
  measure(measureName, startMark, endMark) {
    if (performance && performance.measure) {
      try {
        performance.measure(measureName, startMark, endMark);
        this.measures.add(measureName);
      } catch (error) {
        console.warn(`Failed to measure ${measureName}:`, error);
      }
    }
  }

  /**
   * Get all performance measures
   * @returns {Array} Array of performance measure entries
   */
  getMeasures() {
    if (performance && performance.getEntriesByType) {
      return performance.getEntriesByType('measure');
    }
    return [];
  }

  /**
   * Clear all performance marks and measures
   */
  clear() {
    if (performance) {
      performance.clearMarks();
      performance.clearMeasures();
      this.marks.clear();
      this.measures.clear();
    }
  }

  /**
   * Log performance metrics to console
   */
  logMetrics() {
    const measures = this.getMeasures();
    console.group('Performance Metrics');
    measures.forEach(measure => {
      console.log(`${measure.name}: ${measure.duration.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export constants
export { PERFORMANCE_MARKS, PERFORMANCE_MEASURES }; 