/**
 * Utility for progressive loading of data
 * 
 * This helps with efficiently loading large datasets incrementally
 * to improve performance and user experience.
 */

export interface ProgressiveLoadOptions {
  // Number of items to load initially
  initialCount: number;
  
  // Number of additional items to load in each batch
  batchSize: number;
  
  // Maximum delay between loads in milliseconds
  maxDelay: number;
  
  // Minimum delay between loads in milliseconds
  minDelay: number;
  
  // Function to determine priority of items (higher values are loaded first)
  priorityFn?: (item: any, index: number) => number;
}

export const DEFAULT_OPTIONS: ProgressiveLoadOptions = {
  initialCount: 10,
  batchSize: 5,
  maxDelay: 300,
  minDelay: 50
};

/**
 * Creates a progressive loader that loads data incrementally
 * 
 * @param items Full array of items to load progressively
 * @param onUpdate Callback that receives the currently loaded items
 * @param options Configuration options
 * @returns Control object with methods to manage loading
 */
export function createProgressiveLoader<T>(
  items: T[],
  onUpdate: (loadedItems: T[]) => void,
  options: Partial<ProgressiveLoadOptions> = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let isLoading = false;
  let isComplete = false;
  let currentIndex = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // Sort items by priority if priorityFn is provided
  const sortedItems = opts.priorityFn 
    ? [...items].sort((a, b) => {
        const priorityA = opts.priorityFn!(a, items.indexOf(a));
        const priorityB = opts.priorityFn!(b, items.indexOf(b));
        return priorityB - priorityA; // Higher priority first
      })
    : items;
  
  // Create initial batch with high-priority items
  const loadedItems: T[] = [];
  
  /**
   * Loads the next batch of items
   */
  function loadNextBatch() {
    if (isComplete || !isLoading) return;
    
    const remainingItems = sortedItems.length - currentIndex;
    if (remainingItems <= 0) {
      isComplete = true;
      isLoading = false;
      return;
    }
    
    // Determine batch size
    const size = Math.min(opts.batchSize, remainingItems);
    
    // Add next batch to loaded items
    for (let i = 0; i < size; i++) {
      loadedItems.push(sortedItems[currentIndex + i]);
    }
    
    currentIndex += size;
    
    // Notify of update
    onUpdate([...loadedItems]);
    
    // Schedule next batch with dynamic delay based on remaining items
    const progress = currentIndex / sortedItems.length;
    // Gradually increase delay as we load more items (slower at the end)
    const delay = opts.minDelay + (opts.maxDelay - opts.minDelay) * progress;
    
    timeoutId = setTimeout(loadNextBatch, delay);
  }
  
  /**
   * Starts or resumes the progressive loading
   */
  function start() {
    if (isLoading || isComplete) return;
    
    isLoading = true;
    
    if (loadedItems.length === 0) {
      // Initial load
      const initialSize = Math.min(opts.initialCount, sortedItems.length);
      for (let i = 0; i < initialSize; i++) {
        loadedItems.push(sortedItems[i]);
      }
      currentIndex = initialSize;
      onUpdate([...loadedItems]);
      
      // If all items fit in initial load, we're done
      if (currentIndex >= sortedItems.length) {
        isComplete = true;
        isLoading = false;
        return;
      }
    }
    
    // Schedule next batch
    timeoutId = setTimeout(loadNextBatch, opts.minDelay);
  }
  
  /**
   * Pauses the progressive loading
   */
  function pause() {
    isLoading = false;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
  
  /**
   * Immediately loads all remaining items
   */
  function loadAll() {
    pause();
    
    // Add all remaining items
    while (currentIndex < sortedItems.length) {
      loadedItems.push(sortedItems[currentIndex]);
      currentIndex++;
    }
    
    isComplete = true;
    onUpdate([...loadedItems]);
  }
  
  /**
   * Resets the loader to start from the beginning
   */
  function reset() {
    pause();
    loadedItems.length = 0;
    currentIndex = 0;
    isComplete = false;
  }
  
  return {
    start,
    pause,
    loadAll,
    reset,
    get isLoading() { return isLoading; },
    get isComplete() { return isComplete; },
    get progress() { return sortedItems.length ? currentIndex / sortedItems.length : 1; }
  };
}
