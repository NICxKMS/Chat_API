import { lazy } from 'react';

// Chat components with explicit chunk names for better tracking and bundling
export const ChatContainer = lazy(() => import(/* webpackChunkName: "chat-container" */ '../components/chat/ChatContainer'));
export const ChatMessage = lazy(() => import(/* webpackChunkName: "chat-message" */ '../components/chat/ChatMessage'));
export const ChatInput = lazy(() => import(/* webpackChunkName: "chat-input" */ '../components/chat/ChatInput'));

// Add other chat-related components
// export const ChatHistory = lazy(() => import(/* webpackChunkName: "chat-history" */ '../components/chat/ChatHistory'));
// export const MessageControls = lazy(() => import(/* webpackChunkName: "chat-controls" */ '../components/chat/MessageControls'));

// Bundle for preloading
export const chatComponents = [
  () => import(/* webpackChunkName: "chat-container" */ '../components/chat/ChatContainer'),
  () => import(/* webpackChunkName: "chat-message" */ '../components/chat/ChatMessage'),
  () => import(/* webpackChunkName: "chat-input" */ '../components/chat/ChatInput')
]; 