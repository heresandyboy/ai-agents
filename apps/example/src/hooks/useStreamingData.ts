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
  const processedTimestampsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!streamingData || !currentMessageId) return;

    let dataChunk = streamingData;

    if (Array.isArray(dataChunk)) {
      // Deduplicate chunks based on timestamp
      const uniqueChunks = dataChunk.filter(chunk => {
        if (!chunk?.timestamp) return true;
        if (processedTimestampsRef.current.has(chunk.timestamp)) return false;
        processedTimestampsRef.current.add(chunk.timestamp);
        return true;
      });

      // Log delays for unique chunks
      uniqueChunks.forEach(chunk => {
        if (chunk?.timestamp) {
          const delay = Date.now() - chunk.timestamp;
          console.log(`Stream chunk delay: ${delay}ms`, chunk);
        }
      });

      // Filter out status updates from unique chunks
      const statusUpdates = uniqueChunks
        .filter(chunk => chunk?.type === 'status')
        .map(chunk => chunk.status);
      
      // Find the last usage data from unique chunks
      const lastUsageData = [...uniqueChunks]
        .reverse()
        .find(chunk => chunk?.type === 'usage')?.usage;

      if (statusUpdates.length > 0) {
        // Store status updates for this message ID
        previousStatusesRef.current[currentMessageId] = statusUpdates;
        // Update current status updates for streaming display
        setStatusUpdates(statusUpdates);
      }
      
      if (lastUsageData) {
        setUsageData(lastUsageData);
      }
    }
  }, [streamingData, setStatusUpdates, setUsageData, currentMessageId]);

  return previousStatusesRef.current;
}
