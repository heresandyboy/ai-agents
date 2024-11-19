'use client';

import { useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import MessageComponent from './Message';
import { Send } from 'lucide-react';
import { useFormState } from 'react-dom';

const ChatWindow = () => {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] pt-16">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageComponent key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form 
        onSubmit={handleSubmit}
        className="border-t border-spark-border dark:border-spark-border-dark p-4 bg-white dark:bg-gray-900"
      >
        <div className="flex space-x-4">
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