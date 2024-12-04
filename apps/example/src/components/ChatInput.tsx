import React, { useRef, useEffect, ChangeEvent, KeyboardEvent, useState } from 'react';
import { Send, X, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { Textarea } from './ui/textarea';
import { useSettings } from '@/context/SettingsContext';
import { SettingsPopover } from './SettingsPopover';
import Tooltip from './ui/Tooltip';
import { useDocumentEffect } from '@/hooks/useDocumentEffect';

interface ChatInputProps {
  input: string;
  handleInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop: () => void;
  isSidebarOpen: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  isSidebarOpen,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { enterToSend } = useSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const onInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (enterToSend) {
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
        event.preventDefault();
        handleSubmit();
      }
    } else {
      if (event.key === 'Enter' && (event.ctrlKey || event.shiftKey)) {
        event.preventDefault();
        handleSubmit();
      }
    }
    // Allow default behavior (new line) when appropriate
  };

  // Close settings popover when clicking outside
  useDocumentEffect((document) => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsPopoverRef.current &&
        !settingsPopoverRef.current.contains(event.target as Node) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sendButtonTooltip = enterToSend
    ? 'Send message (Enter)'
    : 'Send message (Ctrl + Enter)';

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        'fixed bottom-0 right-0 border-t p-4 bg-[hsl(var(--background))] dark:bg-gray-900 z-20',
        isSidebarOpen ? 'left-64' : 'left-0',
        'border-spark-border dark:border-spark-border-dark'
      )}
    >
      <div className="relative flex items-end space-x-4 max-w-4xl mx-auto">
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder="Type your message..."
          className="text-scale flex-1 p-2 border rounded-lg resize-none overflow-hidden
                     border-gray-300 dark:border-gray-700
                     focus:ring-2 focus:ring-spark-purple focus:border-transparent
                     transition-colors duration-200"
          disabled={isLoading}
          rows={1}
        />

        <div className="flex flex-col items-center space-y-2">
          {/* Settings Icon */}
          <div className="relative">
            <button
              ref={settingsButtonRef}
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            {isSettingsOpen && (
              <div
                ref={settingsPopoverRef}
                className="absolute bottom-full mb-2 right-0 z-50"
              >
                <SettingsPopover onClose={() => setIsSettingsOpen(false)} />
              </div>
            )}
          </div>

          {/* Send/Stop Button with Tooltip */}
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 bg-red-500 text-white rounded-lg
                         hover:bg-red-600 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <Tooltip content={sendButtonTooltip}>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-spark-purple text-white rounded-lg
                           hover:bg-opacity-90 transition-opacity
                           disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </form>
  );
};

export default ChatInput;