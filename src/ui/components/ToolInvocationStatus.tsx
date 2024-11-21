// src/ui/components/ToolInvocationStatus.tsx

import React, { useState } from 'react';
import { ToolInvocation } from 'ai';
import { ChevronDown, ChevronUp, Loader } from 'lucide-react';

interface ToolInvocationStatusProps {
  toolInvocations: ToolInvocation[];
  isLoading: boolean;
}

const ToolInvocationStatus: React.FC<ToolInvocationStatusProps> = ({ toolInvocations, isLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-4">
      <button
        onClick={toggleExpand}
        className="flex items-center justify-between w-full p-2 text-left bg-gray-100 dark:bg-gray-800 rounded-t"
      >
        <span className="font-semibold">Thoughts</span>
        {isExpanded ? <ChevronUp /> : <ChevronDown />}
      </button>

      {isExpanded && (
        <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-b">
          {toolInvocations.map((tool, index) => (
            <div key={tool.toolCallId} className="mb-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{tool.toolName}</span>
                {isLoading && index === toolInvocations.length - 1 && <Loader className="animate-spin" />}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                State: {tool.state || 'pending'}
              </div>
              {tool.result && (
                <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                  {JSON.stringify(tool.result, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToolInvocationStatus;