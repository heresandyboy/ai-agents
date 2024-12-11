// src/ui/hooks/useStreamingData.ts
'use client';

import { useEffect, useRef } from "react";

interface StreamingDataHandlerProps {
  streamingData: any;
  metadata: any;
  setStatusUpdates: React.Dispatch<React.SetStateAction<string[]>>;
  setUsageData: React.Dispatch<React.SetStateAction<any>>;
  currentMessageId?: string; // ID of the current assistant message
}

export function useStreamingData({
  streamingData,
  metadata,
  setStatusUpdates,
  setUsageData,
  currentMessageId,
}: StreamingDataHandlerProps) {
  const previousStatusesRef = useRef<Record<string, string[]>>({});

  useEffect(() => {
    if (!streamingData || !currentMessageId) return;

    let dataChunk = streamingData;

    if (Array.isArray(dataChunk)) {
      // Log timestamps for debugging
      dataChunk.forEach(chunk => {
        if (chunk?.timestamp) {
          const delay = Date.now() - chunk.timestamp;
          console.log(`Stream chunk delay: ${delay}ms`, chunk);
        }
      });

      // Filter out status updates
      const statusUpdates = dataChunk
        .filter(chunk => chunk?.type === 'status')
        .map(chunk => chunk.status);
      
      // Find the last usage data
      const lastUsageData = [...dataChunk]
        .reverse()
        .find(chunk => chunk?.type === 'usage')?.usage;

      // Store status updates for this message ID
      previousStatusesRef.current[currentMessageId] = statusUpdates;
      
      // Update current status updates for streaming display
      setStatusUpdates(statusUpdates);
      
      if (lastUsageData) {
        setUsageData(lastUsageData);
      }
    }
  }, [streamingData, setStatusUpdates, setUsageData, currentMessageId]);

  return previousStatusesRef.current;
}
