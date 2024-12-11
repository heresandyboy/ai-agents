'use client';

import StatusUpdatesComponent from '@/components/StatusUpdatesComponent';
import UsageDataComponent from '@/components/UsageDataComponent';
import { useSettings } from '@/context/SettingsContext';
import { useDocumentEffect } from '@/hooks/useDocumentEffect';
import { useStreamingData } from '@/hooks/useStreamingData';
import { type Message as AIMessage } from 'ai';
import { useChat } from 'ai/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatInput from './ChatInput';
import MessageComponent from './Message';

export interface Message extends AIMessage {
  statusUpdates?: string[];
  toolInvocations?: any[];
  agentName?: string;
}

interface ChatWindowProps {
  isSidebarOpen: boolean;
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout;
  
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    clearTimeout(timeout);
  };

  return debounced as T & { cancel: () => void };
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

  // Added state for currentUserMessageId
  const [currentUserMessageId, setCurrentUserMessageId] = useState<string | undefined>(undefined);

  const {
    messages,
    metadata,
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

  // Store all status updates by message ID
  const messageStatusUpdates = useStreamingData({
    streamingData,
    metadata,
    setStatusUpdates,
    setUsageData,
    setCurrentUserMessageId,
    currentUserMessageId,
  });

  // Consolidate messages to prevent duplicates
  const consolidatedMessages = useMemo(() => {
    return messages.reduce((acc, current, index, array) => {
      const previousMessage = acc[acc.length - 1];

      if (current.role === 'assistant' && current.toolInvocations?.length) {
        // Combine with previous assistant message if applicable
        if (previousMessage && previousMessage.role === 'assistant' && previousMessage.id === current.id) {
          previousMessage.toolInvocations = [
            ...(previousMessage.toolInvocations || []),
            ...current.toolInvocations,
          ];
        } else {
          acc.push(current);
        }
      } else {
        acc.push(current);
      }

      return acc;
    }, [] as typeof messages);
  }, [messages]);

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

        {consolidatedMessages.map((msg, index) => {
          const isLastMessage = index === consolidatedMessages.length - 1;

          // Determine if we should show status updates
          const showStatusUpdates = msg.role === 'user' && (
            (isLoading && currentUserMessageId === msg.id) ||
            messageStatusUpdates[msg.id]?.length > 0
          );

          // Use statusUpdates when loading, otherwise use messageStatusUpdates
          const statusUpdatesToShow = isLoading && currentUserMessageId === msg.id
            ? statusUpdates
            : messageStatusUpdates[msg.id];

          return (
            <React.Fragment key={msg.id}>
              <MessageComponent
                message={msg}
                isLoading={isLoading && isLastMessage && msg.role === 'assistant'}
              />
              {showStatusUpdates && statusUpdatesToShow && (
                <StatusUpdatesComponent 
                  statusUpdates={statusUpdatesToShow}
                  isLoading={isLoading && isLastMessage}
                />
              )}
            </React.Fragment>
          );
        })}

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