// src/ui/hooks/useStreamingData.ts
'use client';

import { type Message, type ToolInvocation } from 'ai';
import { useCallback, useEffect, useRef } from "react";

interface StreamingDataHandlerProps {
  streamingData: any;
  metadata: any;
  setStatusUpdates: React.Dispatch<React.SetStateAction<string[]>>;
  setUsageData: React.Dispatch<React.SetStateAction<any>>;
  setCurrentUserMessageId: React.Dispatch<React.SetStateAction<string | undefined>>;
  currentUserMessageId?: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useStreamingData({
  streamingData,
  metadata,
  setStatusUpdates,
  setUsageData,
  setCurrentUserMessageId,
  currentUserMessageId,
  setMessages,
  setIsLoading,
}: StreamingDataHandlerProps) {
  const previousStatusesRef = useRef<Record<string, string[]>>({});
  const processedChunksRef = useRef<Set<string>>(new Set());
  const currentMessageRef = useRef<{
    id?: string;
    content: string;
    toolInvocations: ToolInvocation[];
    statusUpdates: string[];
  }>({
    content: '',
    toolInvocations: [],
    statusUpdates: [],
  });

  const contentBufferRef = useRef<string>('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processChunk = useCallback(
    (chunk: any) => {
      const chunkKey = `${chunk.type}-${chunk.timestamp}-${JSON.stringify(chunk.content)}`;
      if (processedChunksRef.current.has(chunkKey)) {
        return;
      }
      processedChunksRef.current.add(chunkKey);

      switch (chunk.type) {
        case 'user-message-id':
          currentMessageRef.current = {
            content: '',
            toolInvocations: [],
            statusUpdates: [],
          };
          setCurrentUserMessageId(chunk.content);
          previousStatusesRef.current[chunk.content] = [];
          setStatusUpdates([]);
          break;

        case 'status':
          if (!currentUserMessageId) return;
          if (!previousStatusesRef.current[currentUserMessageId]) {
            previousStatusesRef.current[currentUserMessageId] = [];
          }
          previousStatusesRef.current[currentUserMessageId].push(chunk.status);
          currentMessageRef.current.statusUpdates.push(chunk.status);
          setStatusUpdates([...currentMessageRef.current.statusUpdates]);
          break;

        case 'tool-call':
          if (!currentMessageRef.current.id) {
            currentMessageRef.current.id = chunk.id;
            setMessages(prevMessages => [
              ...prevMessages,
              {
                id: chunk.id,
                role: 'assistant',
                content: '',
                toolInvocations: [],
                createdAt: new Date(chunk.timestamp),
              }
            ]);
          }
          const toolCall: ToolInvocation = {
            state: 'call',
            toolCallId: chunk.content.toolCallId,
            toolName: chunk.content.toolName,
            args: chunk.content.args,
          };
          currentMessageRef.current.toolInvocations = [
            ...currentMessageRef.current.toolInvocations,
            toolCall,
          ];
          setMessages(prevMessages => prevMessages.map(msg =>
            msg.id === currentMessageRef.current.id
              ? { ...msg, toolInvocations: [...currentMessageRef.current.toolInvocations] }
              : msg
          ));
          break;

        case 'tool-result':
          const toolIndex = currentMessageRef.current.toolInvocations.findIndex(
            t => t.toolCallId === chunk.content.toolCallId
          );
          if (toolIndex !== -1) {
            const toolResult: ToolInvocation = {
              state: 'result',
              toolCallId: chunk.content.toolCallId,
              toolName: chunk.content.toolName,
              args: chunk.content.args,
              result: chunk.content.result,
            };
            currentMessageRef.current.toolInvocations[toolIndex] = toolResult;
            setMessages(prevMessages => prevMessages.map(msg =>
              msg.id === currentMessageRef.current.id
                ? { ...msg, toolInvocations: [...currentMessageRef.current.toolInvocations] }
                : msg
            ));
          }
          break;

        case 'text-delta':
          if (!currentMessageRef.current.id) {
            currentMessageRef.current.id = chunk.id;
            currentMessageRef.current.content = chunk.content.textDelta;

            const newMessage: Message = {
              id: chunk.id,
              role: 'assistant',
              content: chunk.content.textDelta,
              toolInvocations: currentMessageRef.current.toolInvocations,
              createdAt: new Date(chunk.timestamp),
            };

            setMessages((prevMessages) => [...prevMessages, newMessage]);
          } else {
            contentBufferRef.current += chunk.content.textDelta;
            if (!updateTimeoutRef.current) {
              updateTimeoutRef.current = setTimeout(() => {
                currentMessageRef.current.content += contentBufferRef.current;
                setMessages((prevMessages) =>
                  prevMessages.map((msg) =>
                    msg.id === currentMessageRef.current.id
                      ? { ...msg, content: currentMessageRef.current.content }
                      : msg
                  )
                );
                contentBufferRef.current = '';
                updateTimeoutRef.current = null;
              }, 100);
            }
          }
          break;

        case 'finish':
          setIsLoading(false);
          if (currentMessageRef.current.id) {
            setMessages(prevMessages => prevMessages.map(msg =>
              msg.id === currentMessageRef.current.id
                ? { ...msg, statusUpdates: [...currentMessageRef.current.statusUpdates] }
                : msg
            ));
          }
          break;
      }
    },
    [
      currentUserMessageId,
      setCurrentUserMessageId,
      setStatusUpdates,
      setMessages,
      setIsLoading,
    ]
  );

  useEffect(() => {
    if (!streamingData || !Array.isArray(streamingData)) return;

    streamingData.forEach(processChunk);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingData]);

  return previousStatusesRef.current;
}
