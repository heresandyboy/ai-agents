'use client';

import { FC, useRef } from 'react';
import { Message } from 'ai';
import { Markdown } from './Markdown';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown } from 'lucide-react';

// Update the interface to include proper tool invocation types
interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state?: string;
  args: any;
  result?: any;
}

interface MessageProps {
  message: Message;
}

const MessageComponent: FC<MessageProps> = ({ message }) => {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Functions to scroll to the top or bottom of the message
  const scrollToTopOfMessage = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToBottomOfMessage = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.div
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative p-4 my-2 rounded-lg ${
        message.role === 'user' 
          ? 'bg-blue-100 dark:bg-blue-800/30' 
          : 'bg-gray-100 dark:bg-gray-800'
      }`}
    >
      {/* Top of the message with adjusted scroll margin */}
      <div ref={topRef} className="scroll-mt-16" />

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
      </p>
      <div className="prose dark:prose-invert">
        <Markdown>{message.content}</Markdown>
      </div>
      {message.toolInvocations?.map((tool: ToolInvocation) => (
        <div 
          key={tool.toolCallId} 
          className="mt-3 p-3 border-l-4 border-spark-purple bg-gray-50 dark:bg-gray-900 rounded"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tool: {tool.toolName}
          </p>
          <pre className="mt-2 text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
          {tool.state === 'result' && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <p className="text-sm text-gray-600 dark:text-gray-400">Result:</p>
              <pre className="mt-1 text-sm overflow-x-auto">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}

      {/* Bottom of the message with adjusted scroll margin */}
      <div ref={bottomRef} className="scroll-mb-24" />

      {/* Scroll-to-bottom button at the top right */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={scrollToBottomOfMessage}
          className="p-1 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Scroll to bottom of message"
        >
          <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Scroll-to-top button at the bottom right */}
      <div className="absolute bottom-2 right-2 z-10">
        <button
          onClick={scrollToTopOfMessage}
          className="p-1 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Scroll to top of message"
        >
          <ArrowUp className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>
    </motion.div>
  );
};

export default MessageComponent;