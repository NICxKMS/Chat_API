// Legacy streaming context stub - logic now lives in StreamingEventsContext
import { useStreamingEvents } from './StreamingEventsContext';

// Alias the streaming events hook for backward compatibility
export const useStreaming = useStreamingEvents;

// No-op provider stub (implementation moved to StreamingEventsProvider in ContextManager)
export const StreamingProvider = ({ children }) => children;