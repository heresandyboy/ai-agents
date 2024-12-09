// src/ui/hooks/useStreamingData.ts
'use client';

import { useEffect } from "react";

interface StreamingDataHandlerProps {
  streamingData: any;
  metadata: any;
  setStatusUpdates: React.Dispatch<React.SetStateAction<string[]>>;
  setUsageData: React.Dispatch<React.SetStateAction<any>>;
}

export function useStreamingData({
  streamingData,
  metadata,
  setStatusUpdates,
  setUsageData,
}: StreamingDataHandlerProps) {
  useEffect(() => {
    if (!streamingData) return;

    let dataChunk = streamingData;

    if (Array.isArray(dataChunk)) {
      // Filter out status updates
      const statusUpdates = dataChunk
        .filter(chunk => chunk?.type === 'status')
        .map(chunk => chunk.status);
      
      // Find the last usage data
      const lastUsageData = [...dataChunk]
        .reverse()
        .find(chunk => chunk?.type === 'usage')?.usage;

      // Update current status updates for display during streaming
      setStatusUpdates(statusUpdates);
      
      if (lastUsageData) {
        setUsageData(lastUsageData);
      }
      return;
    }

    // Handle single updates
    if (dataChunk?.type === 'status') {
      setStatusUpdates(prev => [...prev, dataChunk.status]);
    } else if (dataChunk?.type === 'usage') {
      setUsageData(dataChunk.usage);
    }
  }, [streamingData, setStatusUpdates, setUsageData]);
}
