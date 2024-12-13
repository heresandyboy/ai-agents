// src/ui/hooks/useStreamingData.ts
'use client';

import { type Message, type ToolInvocation } from 'ai';
import { useEffect, useRef } from "react";

interface StreamingDataHandlerProps {
  streamingData: any;
  metadata: any;
  setStatusUpdates: React.Dispatch<React.SetStateAction<string[]>>;
  setUsageData: React.Dispatch<React.SetStateAction<any>>;
  setCurrentUserMessageId: React.Dispatch<React.SetStateAction<string | undefined>>;
  currentUserMessageId?: string;
  setMessages: React.Dispatch<React.SetStateAction<Message | null>>;
}

export function useStreamingData({
  streamingData,
  metadata,
  setStatusUpdates,
  setUsageData,
  setCurrentUserMessageId,
  currentUserMessageId,
  setMessages,
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

  useEffect(() => {
    if (!streamingData) return;

    let dataChunk = streamingData;

    if (Array.isArray(dataChunk)) {
      dataChunk.forEach(chunk => {
        const chunkKey = `${chunk.type}-${chunk.timestamp}-${JSON.stringify(chunk.content)}`;
        
        if (processedChunksRef.current.has(chunkKey)) {
          return;
        }
        
        processedChunksRef.current.add(chunkKey);

        switch (chunk.type) {
          case 'user-message-id':
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
              currentMessageRef.current.content += chunk.content.textDelta;
              setMessages(current => current ? {
                ...current,
                content: currentMessageRef.current.content
              } : null);
            }
            break;

          case 'finish':
            break;
        }
      });
    }
  }, [
    streamingData,
    setStatusUpdates,
    setUsageData,
    setCurrentUserMessageId,
    currentUserMessageId,
    setMessages,
  ]);

  return previousStatusesRef.current;
}
