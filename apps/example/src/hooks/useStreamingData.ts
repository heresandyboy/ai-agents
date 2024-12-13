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
  onNewMessage?: (message: Message) => void;
}

export function useStreamingData({
  streamingData,
  metadata,
  setStatusUpdates,
  setUsageData,
  setCurrentUserMessageId,
  currentUserMessageId,
  onNewMessage,
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

        // Handle different chunk types
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
            }
            // Map to ToolInvocation type
            const toolCall: ToolInvocation = {
              state: 'call',
              toolCallId: chunk.content.toolCallId,
              toolName: chunk.content.toolName,
              args: chunk.content.args,
            };
            currentMessageRef.current.toolInvocations.push(toolCall);
            break;

          case 'tool-result':
            // Find and update the corresponding tool call
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
            }
            break;

          case 'text-delta':
            if (!currentMessageRef.current.id) {
              currentMessageRef.current.id = chunk.id;
            }
            currentMessageRef.current.content += chunk.content.textDelta;
            break;

          case 'finish':
            if (currentMessageRef.current.id && currentMessageRef.current.content) {
              const message: Message = {
                id: currentMessageRef.current.id,
                role: 'assistant',
                content: currentMessageRef.current.content,
                createdAt: new Date(chunk.timestamp),
                toolInvocations: currentMessageRef.current.toolInvocations,
              };
              onNewMessage?.(message);
              
              // Reset current message
              currentMessageRef.current = {
                content: '',
                toolInvocations: [],
              };
            }
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
    onNewMessage,
  ]);

  return previousStatusesRef.current;
}
