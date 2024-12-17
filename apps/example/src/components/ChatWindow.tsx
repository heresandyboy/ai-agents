'use client';

import StatusUpdatesComponent from '@/components/StatusUpdatesComponent';
import UsageDataComponent from '@/components/UsageDataComponent';
import { useSettings } from '@/context/SettingsContext';
import { useDocumentEffect } from '@/hooks/useDocumentEffect';
import { useStreamingData } from '@/hooks/useStreamingData';
import { generateUUID } from '@/lib/utils';
import { type Message as AIMessage } from 'ai';
import { useChat } from 'ai/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [currentUserMessageId, setCurrentUserMessageId] = useState<string | undefined>(undefined);

  const [messages, setMessages] = useState<Message[]>([]);

  const {
    metadata,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    data: streamingData,
    stop,
  } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  });

  const handleSubmit = useCallback((event?: React.FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }
    if (!isLoading && input.trim()) {
      const userMessage: Message = {
        id: generateUUID(),
        role: 'user',
        content: input,
        createdAt: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, userMessage]);
      originalHandleSubmit(event);
    }
  }, [input, isLoading, originalHandleSubmit]);

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

  const handleScroll = useCallback(
    debounce(() => {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
    }, 100),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();
    }
    return () => {
      container?.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }

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
    setCurrentUserMessageId,
    currentUserMessageId,
    setMessages: (messageUpdate) => {
      if (Array.isArray(messageUpdate)) {
        setMessages((prevMessages) => [...prevMessages, ...messageUpdate]);
      } else if (typeof messageUpdate === 'function') {
        setMessages((prevMessages) => messageUpdate(prevMessages));
      }
    },
    setIsLoading: (loading) => {
      if (!loading) {
        stop();
      }
    },
  });

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

        {messages.map((msg, index) => (
          <React.Fragment key={msg.id}>
            {msg.role === 'assistant' && (
              <>
                {msg.statusUpdates && msg.statusUpdates.length > 0 && (
                  <StatusUpdatesComponent
                    statusUpdates={msg.statusUpdates}
                    isLoading={false}
                  />
                )}
                <MessageComponent
                  message={msg}
                  isLoading={isLoading && index === messages.length - 1}
                />
              </>
            )}
            {msg.role !== 'assistant' && (
              <>
                <MessageComponent
                  message={msg}
                  isLoading={isLoading && index === messages.length - 1}
                />
                {isLoading && index === messages.length - 1 && (
                  <StatusUpdatesComponent
                    statusUpdates={statusUpdates}
                    isLoading={true}
                  />
                )}
              </>
            )}
          </React.Fragment>
        ))}

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