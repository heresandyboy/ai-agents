'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useChat } from 'ai/react';
import MessageComponent from './Message';
import { Send, ArrowUp, ArrowDown } from 'lucide-react';
import { useStreamingData } from '@/hooks/useStreamingData';
import ChatInput from './ChatInput';

interface ChatWindowProps {
  isSidebarOpen: boolean;
}

function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isSidebarOpen }) => {
  const {
    messages,
    setMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    data: streamingData,
    stop,
  } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  });

  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isScrollable, setIsScrollable] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToTop = useCallback(() => {
    if (topRef.current) {
      requestAnimationFrame(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  // Debounced handleScroll function
  const handleScroll = useCallback(
    debounce(() => {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
      setIsAtBottom(atBottom);
    }, 100), // Debounce delay of 100ms
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
    }
    return () => {
      container?.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    // Only scroll if the user is at the bottom
    if (isAtBottom) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Check if scrolling is needed
    const container = containerRef.current;
    if (container) {
      const isContentScrollable = container.scrollHeight > container.clientHeight;
      setIsScrollable(isContentScrollable);
    }
  }, [messages, isAtBottom]);

  useStreamingData(streamingData, setMessages);

  // Memoize messages to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => messages, [messages]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Top Scroll Button */}
      {isScrollable && (
        <button
          onClick={scrollToTop}
          className="absolute top-2 right-4 p-2 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700 z-30"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 pr-20 space-y-4 pt-20 pb-24"
      >
        {/* Top of the messages with adjusted scroll margin */}
        <div ref={topRef} className="scroll-mt-16" />

        {memoizedMessages.map((msg, index) => (
          <MessageComponent
            key={msg.id}
            message={msg}
            isLoading={isLoading && index === messages.length - 1}
          />
        ))}

        {/* Bottom of the messages with adjusted scroll margin */}
        <div ref={bottomRef} className="scroll-mb-24" />
      </div>

      {/* Bottom Scroll Button */}
      {isScrollable && !isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 p-2 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700 z-30"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      <ChatInput
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        isSidebarOpen={isSidebarOpen}
      />
    </div>
  );
};

export default ChatWindow;