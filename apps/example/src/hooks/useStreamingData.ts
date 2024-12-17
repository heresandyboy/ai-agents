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
  setMessages: React.Dispatch<React.SetStateAction<Message | null>>;
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
  }>({
    content: '',
    toolInvocations: [],
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
          setStatusUpdates([...previousStatusesRef.current[currentUserMessageId]]);
          break;

        case 'tool-call':
          if (!currentMessageRef.current.id) {
            currentMessageRef.current.id = chunk.id;
            setMessages({
              id: chunk.id,
              role: 'assistant',
              content: '',
              toolInvocations: [],
              createdAt: new Date(chunk.timestamp),
            });
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
          setMessages(current => current ? {
            ...current,
            toolInvocations: [...currentMessageRef.current.toolInvocations]
          } : null);
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
            setMessages(current => current ? {
              ...current,
              toolInvocations: [...currentMessageRef.current.toolInvocations]
            } : null);
          }
          break;

        case 'text-delta':
          if (!currentMessageRef.current.id) {
            currentMessageRef.current.id = chunk.id;
            setMessages({
              id: chunk.id,
              role: 'assistant',
              content: chunk.content.textDelta,
              toolInvocations: [],
              createdAt: new Date(chunk.timestamp),
            });
          } else {
            contentBufferRef.current += chunk.content.textDelta;
            if (!updateTimeoutRef.current) {
              updateTimeoutRef.current = setTimeout(() => {
                currentMessageRef.current.content += contentBufferRef.current;
                setMessages(current => current ? {
                  ...current,
                  content: currentMessageRef.current.content
                } : null);
                contentBufferRef.current = '';
                updateTimeoutRef.current = null;
              }, 100); // Update every 100ms
            }
          }
          break;

        case 'finish':
          setIsLoading(false);
          break;
      }
    },
    [currentUserMessageId, setCurrentUserMessageId, setStatusUpdates, setMessages, setIsLoading]
  );

  useEffect(() => {
    if (!streamingData || !Array.isArray(streamingData)) return;

    streamingData.forEach(processChunk);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingData]);

  return previousStatusesRef.current;
}
