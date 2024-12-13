// src/ui/hooks/useStreamingData.ts
'use client';

import { useEffect, useRef } from "react";

interface StreamingDataHandlerProps {
  streamingData: any;
  metadata: any;
  setStatusUpdates: React.Dispatch<React.SetStateAction<string[]>>;
  setUsageData: React.Dispatch<React.SetStateAction<any>>;
  setCurrentUserMessageId: React.Dispatch<React.SetStateAction<string | undefined>>;
  currentUserMessageId?: string; // ID of the current user message
}

export function useStreamingData({
  streamingData,
  metadata,
  setStatusUpdates,
  setUsageData,
  setCurrentUserMessageId,
  currentUserMessageId,
}: StreamingDataHandlerProps) {
  const previousStatusesRef = useRef<Record<string, string[]>>({});
  const lastUpdateTimeRef = useRef<number>(0);
  const processedChunksRef = useRef<Set<string>>(new Set());
  const UPDATE_INTERVAL = 100;

  useEffect(() => {
    if (!streamingData) return;

    let dataChunk = streamingData;

    if (Array.isArray(dataChunk)) {
      // Process chunks
      dataChunk.forEach(chunk => {
        // Create a unique key for the chunk
        const chunkKey = `${chunk.type}-${chunk.timestamp}-${chunk.content || chunk.status}`;
        
        // Skip if we've already processed this chunk
        if (processedChunksRef.current.has(chunkKey)) {
          return;
        }
        
        // Mark chunk as processed
        processedChunksRef.current.add(chunkKey);

        const receivedAt = Date.now();
        console.log('chunk', JSON.stringify(chunk, null, 2));
        console.log('difference', receivedAt - chunk.timestamp);
        console.log('differene in seconds', (receivedAt - chunk.timestamp) / 1000);

        if (chunk.type === 'user-message-id') {
          setCurrentUserMessageId(chunk.content);
          previousStatusesRef.current[chunk.content] = [];
          setStatusUpdates([]);
        } else if (chunk.type === 'status') {
          if (!currentUserMessageId) return;
          
          if (!previousStatusesRef.current[currentUserMessageId]) {
            previousStatusesRef.current[currentUserMessageId] = [];
          }
          
          // Add the new status
          previousStatusesRef.current[currentUserMessageId].push(chunk.status);
          
          // Update status updates immediately without debouncing
          setStatusUpdates([...previousStatusesRef.current[currentUserMessageId]]);
        }
      });
    }
  }, [streamingData, setStatusUpdates, setUsageData, setCurrentUserMessageId, currentUserMessageId]);

  return previousStatusesRef.current;
}
