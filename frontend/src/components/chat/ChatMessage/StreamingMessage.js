import React, { useEffect, useLayoutEffect, useRef, useContext, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { ChatContext, useChat } from '../../../contexts/ChatContext';
import styles from './ChatMessage.module.css';

/**
 * StreamingMessage component that creates a word-by-word typing effect
 * This approach displays streaming text with a natural typing animation
 *
 * @param {Object} props - Component props
 * @param {string} props.content - The current content from React state 
 * @returns {JSX.Element} - Rendered component
 */
const StreamingMessage = ({ content }) => {
  const { streamingTextRef } = useContext(ChatContext);
  const containerRef = useRef(null);
  const textNodeRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastDisplayedTextRef = useRef('');
  const wordsBufferRef = useRef([]);
  const wordIndexRef = useRef(0);
  const timerRef = useRef(null);
  const pauseCounterRef = useRef(0);
  
  // Word speed controls - adjust for desired typing speed
  const baseWordDelay = 50; // Base delay between words in ms
  const pauseBetweenSentences = 10; // Additional pause counter for periods
  
  // Set up the text node once
  useLayoutEffect(() => {
    if (containerRef.current && !textNodeRef.current) {
      // Create a text node for efficient updates
      textNodeRef.current = document.createTextNode('');
      containerRef.current.appendChild(textNodeRef.current);
    }
    
    return () => {
      // Clean up timers on unmount
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  // Process new streaming content as it arrives
  useEffect(() => {
    // Get any new words from the streaming content we haven't processed yet
    if (streamingTextRef.current !== lastDisplayedTextRef.current) {
      const allStreamingText = streamingTextRef.current;
      const newContent = allStreamingText.substring(lastDisplayedTextRef.current.length);
      
      if (newContent) {
        // Split new content into words (keeping spaces and punctuation)
        const newWords = newContent.match(/[^\s]+|\s+/g) || [];
        wordsBufferRef.current = [...wordsBufferRef.current, ...newWords];
      }
    }
    
    // Start or continue the typing animation if not already running
    if (wordsBufferRef.current.length > 0 && !timerRef.current) {
      typeNextWord();
    }
    
    // If content is final (from props), ensure everything is displayed
    if (content && streamingTextRef.current === content && 
        lastDisplayedTextRef.current !== content) {
      // Force display all content
      lastDisplayedTextRef.current = content;
      if (textNodeRef.current) {
        textNodeRef.current.nodeValue = content;
      }
      
      // Clean up any pending animations
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content]);
  
  // Function to type the next word with natural timing
  const typeNextWord = useCallback(() => {
    // If we're pausing, decrement counter and continue
    if (pauseCounterRef.current > 0) {
      pauseCounterRef.current--;
      timerRef.current = setTimeout(typeNextWord, baseWordDelay);
      return;
    }
    
    // Get next word if available
    if (wordsBufferRef.current.length > 0) {
      const nextWord = wordsBufferRef.current.shift();
      const updatedText = lastDisplayedTextRef.current + nextWord;
      lastDisplayedTextRef.current = updatedText;
      
      // Update DOM directly for performance
      if (textNodeRef.current) {
        textNodeRef.current.nodeValue = updatedText;
      }
      
      // Add extra pause after sentences
      if (nextWord.includes('.') || nextWord.includes('?') || nextWord.includes('!')) {
        pauseCounterRef.current = pauseBetweenSentences;
      }
      
      // Calculate dynamic timing for next word based on length and content
      const delay = calculateWordTiming(nextWord);
      
      // Schedule next word
      timerRef.current = setTimeout(typeNextWord, delay);
    } else {
      // No more words in buffer
      timerRef.current = null;
    }
  }, []);
  
  // Calculate natural-feeling timing between words
  const calculateWordTiming = (word) => {
    // Base timing
    let timing = baseWordDelay;
    
    // Adjust for word length (longer words take more time to "type")
    timing += Math.min(word.length * 5, 30);
    
    // Adjust for punctuation (slight pause)
    if (word.includes(',')) timing += 20;
    
    // Random variance for natural feel
    timing += Math.random() * 20 - 10;
    
    return timing;
  };
  
  return (
    <div 
      ref={containerRef} 
      className={styles.streamingContent}
      aria-live="polite"
    />
  );
};

StreamingMessage.propTypes = {
  content: PropTypes.string.isRequired
};

export default StreamingMessage; 