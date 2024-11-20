'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from 'ai/react';
import MessageComponent from './Message';
import { Send, ArrowUp, ArrowDown } from 'lucide-react';

interface ChatWindowProps {
  isSidebarOpen: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isSidebarOpen }) => {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  });

  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isScrollable, setIsScrollable] = useState(false);

  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Function to check if the user is near the bottom
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom =
      scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  useEffect(() => {
    // Only scroll if the user is at the bottom
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    // Check if scrolling is needed
    const container = containerRef.current;
    if (container) {
      const isContentScrollable =
        container.scrollHeight > container.clientHeight;
      setIsScrollable(isContentScrollable);
    }
  }, [messages, isAtBottom]);

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

        {messages.map((msg) => (
          <MessageComponent key={msg.id} message={msg} />
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

      <form
        onSubmit={handleSubmit}
        className={`fixed bottom-0 ${
          isSidebarOpen ? 'left-64' : 'left-0'
        } right-0 border-t border-spark-border dark:border-spark-border-dark p-4 bg-white dark:bg-gray-900 z-20`}
      >
        <div className="flex space-x-4 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-lg dark:border-gray-700 
                       bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-spark-purple focus:border-transparent
                       transition-colors duration-200"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-spark-purple text-white rounded-lg
                       hover:bg-opacity-90 transition-opacity
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindow;