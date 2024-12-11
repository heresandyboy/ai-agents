'use client';

import ToolInvocationLoader from '@/components/ToolInvocationLoader';
import { type Message } from 'ai';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import React, { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { Weather } from './tool/Weather';
import ToolInvocationStatus from './ToolInvocationStatus';

interface MessageProps {
  message: Message & {
    agentName?: string;
  };
  isLoading?: boolean;
  block?: any;
  setBlock?: React.Dispatch<React.SetStateAction<any>>;
}

const MessageComponent: FC<MessageProps> = ({ message, isLoading, block, setBlock }) => {
  console.log("message", message);
  const messageRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [isInView, setIsInView] = useState(false);

  // Functions to scroll to the top or bottom of the message
  const scrollToTopOfMessage = useCallback(() => {
    if (topRef.current) {
      requestAnimationFrame(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const scrollToBottomOfMessage = useCallback(() => {
    if (bottomRef.current) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
  }, []);

  // Memoized Intersection Observer callback
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      setIsInView(entry.isIntersecting);
    },
    []
  );

  // Use IntersectionObserver to detect when the message is in view
  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      threshold: 0.1, // Adjust as needed
    });

    if (messageRef.current) {
      observer.observe(messageRef.current);
    }

    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current);
      }
      observer.disconnect();
    };
  }, [handleIntersection]);

  // Only display scroll buttons when the message is not streaming
  const shouldShowScrollButtons = useMemo(() => {
    return !isLoading;
  }, [isLoading]);

  return (
    <motion.div
      ref={messageRef}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative p-4 my-2 rounded-lg ${message.role === 'user'
          ? 'bg-blue-100 dark:bg-blue-800/30'
          : 'bg-gray-100 dark:bg-gray-800'
        }`}
    >
      <div ref={topRef} className="scroll-mt-16" />

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {message.role === 'assistant' && message.agentName ? (
          `${message.agentName} (Assistant)`
        ) : (
          message.role.charAt(0).toUpperCase() + message.role.slice(1)
        )}
      </p>

      {/* Tool Invocation Status */}
      {message.toolInvocations && (
        <ToolInvocationStatus
          toolInvocations={message.toolInvocations}
          isLoading={isLoading || false}
        />
      )}

      {/* Tool Invocation Handling */}
      {message.toolInvocations && message.toolInvocations.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          {message.toolInvocations.map((toolInvocation) => {
            const { toolName, toolCallId, state, args } = toolInvocation;

            if (state === 'result') {
              const { result } = toolInvocation;

              return (
                <div key={toolCallId}>
                  {toolName === 'getWeather' ? (
                    <Weather weatherAtLocation={result} />
                  ) : (
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  )}
                </div>
              );
            }

            // While the tool is running (state is not 'result')
            return (
              <div key={toolCallId}>
                <ToolInvocationLoader toolName={toolName} />
              </div>
            );
          })}
        </div>
      )}

      {/* Message content moved below tool invocations */}
      <div className="prose dark:prose-invert mt-4">
        <Markdown>{message.content}</Markdown>
      </div>

      {/* Bottom of the message with adjusted scroll margin */}
      <div ref={bottomRef} className="scroll-mb-24" />

      {/* Pinned Scroll Buttons */}
      {shouldShowScrollButtons && isInView && (
        <div
          className="sticky bottom-4 flex justify-end"
          style={{ pointerEvents: 'none' }}
        >
          <div className="space-x-2" style={{ pointerEvents: 'auto' }}>
            <button
              onClick={scrollToTopOfMessage}
              className="p-1 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Scroll to top of message"
            >
              <ArrowUp className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={scrollToBottomOfMessage}
              className="p-1 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Scroll to bottom of message"
            >
              <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(
  MessageComponent,
  (prevProps, nextProps) =>
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isLoading === nextProps.isLoading
);