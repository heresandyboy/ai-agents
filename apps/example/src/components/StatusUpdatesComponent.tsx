'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';

interface StatusUpdatesComponentProps {
  statusUpdates: string[];
  isLoading?: boolean;
}

const StatusUpdatesComponent: React.FC<StatusUpdatesComponentProps> = ({ 
  statusUpdates,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentStatus = statusUpdates[statusUpdates.length - 1];

  return (
    <div className="p-3 my-2 rounded-lg bg-gray-100 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {currentStatus}
          </span>
        </div>
        {statusUpdates.length > 1 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {isExpanded && statusUpdates.length > 1 && (
        <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Previous Updates
          </h4>
          <ul className="space-y-1">
            {statusUpdates.slice(0, -1).map((status, index) => (
              <li
                key={index}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StatusUpdatesComponent;