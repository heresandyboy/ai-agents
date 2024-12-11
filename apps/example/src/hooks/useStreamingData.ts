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
  const UPDATE_INTERVAL = 500; // Update every 500ms

  useEffect(() => {
    if (!streamingData) return;

    let dataChunk = streamingData;

    if (Array.isArray(dataChunk)) {
      // Process chunks
      dataChunk.forEach(chunk => {
        if (chunk.type === 'user-message-id') {
          // Set the current user message id
          setCurrentUserMessageId(chunk.content);
          // Initialize status updates for this user message ID
          previousStatusesRef.current[chunk.content] = [];
          // Reset current status updates
          setStatusUpdates([]);
        } else if (chunk.type === 'status') {
          if (!currentUserMessageId) return; // Ensure we have the user message ID
          // Initialize the array if not present
          if (!previousStatusesRef.current[currentUserMessageId]) {
            previousStatusesRef.current[currentUserMessageId] = [];
          }
          previousStatusesRef.current[currentUserMessageId].push(chunk.status);

          // Throttle updates
          const now = Date.now();
          if (now - lastUpdateTimeRef.current > UPDATE_INTERVAL) {
            lastUpdateTimeRef.current = now;
            // Update current status updates for streaming display
            setStatusUpdates([...previousStatusesRef.current[currentUserMessageId]]);
          }
        }
        // ... handle other chunk types if needed ...
      });
    }
  }, [streamingData, setStatusUpdates, setUsageData, setCurrentUserMessageId, currentUserMessageId]);

  return previousStatusesRef.current;
}
