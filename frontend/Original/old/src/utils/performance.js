/**
 * Performance monitoring utility
 * Tracks various performance metrics and provides methods for optimization
 */

// Performance marks for tracking different stages of app initialization
const PERFORMANCE_MARKS = {
  APP_START: 'app-start',
  CONTEXT_INIT: 'context-init',
  COMPONENT_LOAD: 'component-load',
  CRITICAL_COMPONENTS_LOADED: 'critical-components-loaded',
  IMPORTANT_COMPONENTS_LOADED: 'important-components-loaded',
  SHELL_VISIBLE: 'shell-visible',
  FIRST_PAINT: 'first-paint',
  FIRST_CONTENTFUL_PAINT: 'first-contentful-paint',
  APP_INTERACTIVE: 'app-interactive',
  APP_READY: 'app-ready'
};

// Performance measures for tracking durations
const PERFORMANCE_MEASURES = {
  TOTAL_LOAD: 'total-load-time',
  CONTEXT_INIT: 'context-init-time',
  COMPONENT_LOAD: 'component-load-time',
  TIME_TO_SHELL: 'time-to-shell',
  TIME_TO_INTERACTIVE: 'time-to-interactive',
  CRITICAL_LOAD_TIME: 'critical-load-time',
  IMPORTANT_LOAD_TIME: 'important-load-time'
};

class PerformanceMonitor {
  constructor() {
    this.marks = new Set();
    this.measures = new Set();
    
    // Automatically track paint metrics if browser supports it
    if (typeof window !== 'undefined' && 'performance' in window && 'PerformanceObserver' in window) {
      this.trackPaintMetrics();
    }
  }

  /**
   * Track browser paint metrics (FP, FCP)
   */
  trackPaintMetrics() {
    try {
      // Create a performance observer to track paint events
      const paintObserver = new PerformanceObserver((entries) => {
        entries.getEntries().forEach(entry => {
          const markName = entry.name === 'first-paint' 
            ? PERFORMANCE_MARKS.FIRST_PAINT 
            : PERFORMANCE_MARKS.FIRST_CONTENTFUL_PAINT;
          
          // Add our own performance mark based on the browser's timing
          performance.mark(markName);
          this.marks.add(markName);
          
          // Measure time from app start to this paint event
          const measureName = entry.name === 'first-paint' 
            ? 'time-to-first-paint' 
            : 'time-to-first-contentful-paint';
          
          try {
            performance.measure(measureName, PERFORMANCE_MARKS.APP_START, markName);
            this.measures.add(measureName);
          } catch (error) {
            // Handle case where APP_START mark may not exist yet
            console.warn(`Failed to measure ${measureName}:`, error);
          }
        });
      });
      
      // Start observing paint events
      paintObserver.observe({ entryTypes: ['paint'] });
    } catch (error) {
      console.warn('Failed to track paint metrics:', error);
    }
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
    
    // Log Web Vitals if available
    if ('web-vitals' in window) {
      console.log('Web Vitals will be reported separately');
    }
    
    console.groupEnd();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export constants
export { PERFORMANCE_MARKS, PERFORMANCE_MEASURES }; 