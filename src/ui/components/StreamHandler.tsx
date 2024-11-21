// src/ui/components/StreamHandler.tsx
import { Message } from 'ai';
import { memo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface StreamHandlerProps {
  streamingData: any;
  setMessages: React.Dispatch<React.SetStateAction<Array<Message>>>;
}

function StreamHandler({ streamingData, setMessages }: StreamHandlerProps) {
  const dataQueue = useRef<string>('');
  const updateTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (streamingData) {
      dataQueue.current += streamingData;

      if (!updateTimer.current) {
        updateTimer.current = setTimeout(() => {
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];

            if (lastMessage && lastMessage.role === 'assistant') {
              const updatedMessage = {
                ...lastMessage,
                content: lastMessage.content + dataQueue.current,
              };
              return [...prevMessages.slice(0, -1), updatedMessage];
            } else {
              const newMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: dataQueue.current,
              };
              return [...prevMessages, newMessage];
            }
          });
          dataQueue.current = '';
          updateTimer.current = null;
        }, 100); // Update every 100ms
      }
    }
  }, [streamingData, setMessages]);

  return null;
}

export default memo(StreamHandler);