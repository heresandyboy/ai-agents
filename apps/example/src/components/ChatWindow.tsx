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
  const [currentUserMessageId, setCurrentUserMessageId] = useState<string | undefined>(undefined);

  const {
    messages: chatMessages,
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

  // Keep track of streaming messages separately
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);

  // Combine chat messages with streaming message
  const messages = useMemo(() => {
    if (!streamingMessage) return chatMessages;
    
    // Replace the last message if it's from the assistant and we have a streaming message
    const baseMessages = chatMessages.filter(msg => 
      !(msg.role === 'assistant' && msg.id === streamingMessage.id)
    );
    
    return [...baseMessages, streamingMessage];
  }, [chatMessages, streamingMessage]);

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
      console.log('Scroll position:', { scrollTop, scrollHeight, clientHeight, atBottom });
      setIsAtBottom(atBottom);
    }, 100), // Debounce delay of 100ms
    []
  );

  useEffect(() => {
    console.log('Effect: Adding scroll event listener');
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
    }
    return () => {
      console.log('Effect cleanup: Removing scroll event listener');
      container?.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    console.log('Effect: Checking if should scroll to bottom');
    if (isAtBottom) {
      console.log('Scrolling to bottom');
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const container = containerRef.current;
    if (container) {
      const isContentScrollable = container.scrollHeight > container.clientHeight;
      setIsScrollable(isContentScrollable);
      console.log('Content is scrollable:', isContentScrollable);
    }
  }, [messages, statusUpdates, isAtBottom]);

  // Get the current assistant message ID
  const currentAssistantMessageId = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.role === 'assistant' ? lastMessage.id : undefined;
  }, [messages]);

  const messageStatusUpdates = useStreamingData({
    streamingData,
    metadata,
    setStatusUpdates,
    setUsageData,
    setCurrentUserMessageId,
    currentUserMessageId,
    setMessages: setStreamingMessage,
    setIsLoading: (loading) => {
      if (!loading) {
        stop();
      }
    },
  });

  // Consolidate messages to prevent duplicates
  const consolidatedMessages = useMemo(() => {
    return messages.reduce((acc, current, index, array) => {
      // If this is a tool invocation message
      if (current.toolInvocations?.length) {
        // Look ahead to see if the next message is the completion
        const nextMessage = array[index + 1];
        if (nextMessage && 
            nextMessage.role === 'assistant' && 
            !nextMessage.toolInvocations &&
            current.createdAt === nextMessage.createdAt) {
          // Combine the messages
          acc.push({
            ...current,
            content: nextMessage.content,
            id: current.id, // Keep the first ID
            revisionId: nextMessage.revisionId
          });
        } else {
          acc.push(current);
        }
      } else if (!array[index - 1]?.toolInvocations) {
        // Only add non-tool messages if they're not part of a tool call
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

        {messages.map((msg, index) => (
          <React.Fragment key={msg.id}>
            {/* Only show status updates for the current streaming message */}
            {msg.role === 'assistant' && 
             msg.id === streamingMessage?.id && 
             messageStatusUpdates[currentUserMessageId ?? ''] && (
              <StatusUpdatesComponent 
                statusUpdates={messageStatusUpdates[currentUserMessageId ?? '']}
                isLoading={isLoading && index === messages.length - 1}
              />
            )}
            <MessageComponent
              message={msg}
              isLoading={isLoading && index === messages.length - 1}
            />
          </React.Fragment>
        ))}

        {/* Show current status updates only if we don't have a streaming message yet */}
        {isLoading && !streamingMessage && statusUpdates.length > 0 && (
          <StatusUpdatesComponent 
            statusUpdates={statusUpdates}
            isLoading={true}
          />
        )}

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