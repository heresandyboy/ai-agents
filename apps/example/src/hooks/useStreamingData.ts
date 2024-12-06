// src/ui/hooks/useStreamingData.ts
'use client';

import { type Message } from "ai";
import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

interface StreamingDataHandlerProps {
  streamingData: any;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setStatusUpdates: React.Dispatch<React.SetStateAction<string[]>>;
  setUsageData: React.Dispatch<React.SetStateAction<any>>;
}

export function useStreamingData({
  streamingData,
  setMessages,
  setStatusUpdates,
  setUsageData,
}: StreamingDataHandlerProps) {
  const dataQueue = useRef<string>('');
  const updateTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!streamingData) return;

    let dataChunk = streamingData;

    // Ensure dataChunk is parsed as JSON
    if (typeof dataChunk === 'string') {
      try {
        dataChunk = JSON.parse(dataChunk);
      } catch (error) {
        console.error('Error parsing dataChunk:', error);
        return;
      }
    }

    const { type } = dataChunk;

    switch (type) {
      case 'status':
        // Update status messages
        setStatusUpdates((prevStatus) => [...prevStatus, dataChunk.status]);
        break;

      case 'assistantMessage':
        // Queue assistant's streaming message content
        dataQueue.current += dataChunk.content;

        if (!updateTimer.current) {
          updateTimer.current = setTimeout(() => {
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];

              if (lastMessage && lastMessage.role === 'assistant') {
                // Append to the last assistant message content
                const updatedMessage = {
                  ...lastMessage,
                  content: lastMessage.content + dataQueue.current,
                };
                return [...prevMessages.slice(0, -1), updatedMessage];
              } else {
                // Create a new assistant message
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
        break;

      case 'toolInvocation':
        // Handle tool invocation data
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastAssistantMessage = updatedMessages[updatedMessages.length - 1];

          if (lastAssistantMessage && lastAssistantMessage.role === 'assistant') {
            // Append tool invocation data to the last assistant message
            lastAssistantMessage.toolInvocations =
              lastAssistantMessage.toolInvocations || [];
            lastAssistantMessage.toolInvocations.push(dataChunk.toolInvocation);
            updatedMessages[updatedMessages.length - 1] = lastAssistantMessage;
          }

          return updatedMessages;
        });
        break;

      case 'usage':
        // Handle usage data
        setUsageData(dataChunk.usage);
        break;

      case 'endOfProcessing':
        // Handle end of processing if needed
        break;

      case 'error':
        // Handle error data
        console.error('Error from server:', dataChunk.error);
        break;

      default:
        console.warn('Unknown data type:', type);
        break;
    }
  }, [streamingData, setMessages, setStatusUpdates, setUsageData]);
}
