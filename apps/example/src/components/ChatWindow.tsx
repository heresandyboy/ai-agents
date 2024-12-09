'use client';

import StatusUpdatesComponent from '@/components/StatusUpdatesComponent';
import UsageDataComponent from '@/components/UsageDataComponent';
import { useSettings } from '@/context/SettingsContext';
import { useDocumentEffect } from '@/hooks/useDocumentEffect';
import { useStreamingData } from '@/hooks/useStreamingData';
import { useChat } from 'ai/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatInput from './ChatInput';
import MessageComponent from './Message';

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
  const { fontSize } = useSettings();

  useDocumentEffect(
    (document) => {
      document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
    },
    [fontSize]
  );

  const [statusUpdates, setStatusUpdates] = useState<string[]>([]);
  const [usageData, setUsageData] = useState<any>(null);

  const {
    messages,
    metadata,
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
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
  }, [messages, statusUpdates, isAtBottom]);

  useStreamingData({
    streamingData,
    metadata,
    setStatusUpdates,
    setUsageData,
  });

  // Memoize messages and status updates to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => messages, [messages]);
  const memoizedStatusUpdates = useMemo(() => statusUpdates, [statusUpdates]);

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
        <div ref={topRef} className="scroll-mt-16" />

        {/* Render Messages with Status Updates */}
        {memoizedMessages.map((msg, index) => (
          <React.Fragment key={msg.id}>
            <MessageComponent
              message={msg}
              isLoading={isLoading && index === messages.length - 1}
            />
            {/* Show status updates after the last user message while loading */}
            {isLoading && 
             index === messages.length - 2 && 
             msg.role === 'user' && 
             memoizedStatusUpdates.length > 0 && (
              <StatusUpdatesComponent 
                statusUpdates={memoizedStatusUpdates}
                isLoading={true}
              />
            )}
          </React.Fragment>
        ))}

        {/* Usage Data */}
        {usageData && <UsageDataComponent usage={usageData} />}

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