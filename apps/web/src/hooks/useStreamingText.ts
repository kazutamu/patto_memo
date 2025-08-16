import { useState, useEffect, useRef } from 'react';

interface UseStreamingTextOptions {
  speed?: number; // Characters per second
  delay?: number; // Initial delay before starting
}

export const useStreamingText = (
  text: string, 
  options: UseStreamingTextOptions = {}
) => {
  const { speed = 30, delay = 100 } = options;
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timers
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Reset state
    setDisplayText('');
    setIsComplete(false);
    setIsStreaming(false);

    if (!text) {
      return;
    }

    // Start streaming after delay
    timeoutRef.current = setTimeout(() => {
      setIsStreaming(true);
      let currentIndex = 0;

      intervalRef.current = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsComplete(true);
          setIsStreaming(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      }, 1000 / speed);
    }, delay);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, delay]);

  const skipToEnd = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDisplayText(text);
    setIsComplete(true);
    setIsStreaming(false);
  };

  return {
    displayText,
    isComplete,
    isStreaming,
    skipToEnd
  };
};