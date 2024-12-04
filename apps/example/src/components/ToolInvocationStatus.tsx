// src/ui/components/ToolInvocationStatus.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { ToolInvocation } from 'ai';
import { ChevronDown, ChevronUp, Loader } from 'lucide-react';
import ReactJson from 'react-json-view';

interface ToolInvocationStatusProps {
  toolInvocations: ToolInvocation[];
  isLoading: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 text-left bg-gray-200 dark:bg-gray-800 rounded-t"
      >
        <span className="font-semibold">{title}</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-b">{children}</div>}
    </div>
  );
};

const isValidJson = (value: any): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
};

const DisplayContent: React.FC<{ content: any; isDarkMode: boolean }> = ({ content, isDarkMode }) => {
  if (isValidJson(content)) {
    return (
      <ReactJson
        src={content}
        name={null}
        collapsed={false}
        enableClipboard={false}
        displayDataTypes={false}
        theme={isDarkMode ? 'twilight' : 'rjv-default'}
        style={{
          backgroundColor: 'transparent',
          fontSize: '0.875rem',
        }}
      />
    );
  }
  
  // Display as plain text for non-JSON content
  return (
    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
      {String(content)}
    </pre>
  );
};

const ToolInvocationStatus: React.FC<ToolInvocationStatusProps> = ({
  toolInvocations,
  isLoading,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [latestTool, setLatestTool] = useState<ToolInvocation | null>(null);

  useEffect(() => {
    if (toolInvocations.length > 0) {
      setLatestTool(toolInvocations[toolInvocations.length - 1]);
    }
  }, [toolInvocations]);

  // Determine if dark mode is enabled
  const isDarkMode =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-2 text-left bg-gray-100 dark:bg-gray-800 rounded-t"
      >
        <span className="font-semibold flex items-center">
          Thoughts
          {latestTool && (
            <>
              <span className="mx-2">-</span>
              <span>{latestTool.toolName}</span>
              <span className="mx-1">({latestTool.state || 'pending'})</span>
            </>
          )}
        </span>
        {isExpanded ? <ChevronUp /> : <ChevronDown />}
      </button>

      {isExpanded && (
        <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-b">
          {toolInvocations.map((tool) => (
            <div key={tool.toolCallId} className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{tool.toolName}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                    ({tool.state || 'pending'})
                  </span>
                </div>
                {isLoading && tool.state !== 'result' && (
                  <Loader className="animate-spin h-4 w-4 text-gray-600 dark:text-gray-300" />
                )}
              </div>

              {/* Display arguments */}
              {tool.args && (
                <div className="mt-2 text-sm">
                  <CollapsibleSection title="Args In">
                    <DisplayContent content={tool.args} isDarkMode={isDarkMode} />
                  </CollapsibleSection>
                </div>
              )}

              {/* Display result if state is 'result' */}
              {tool.state === 'result' && tool.result && (
                <div className="mt-2 text-sm">
                  <CollapsibleSection title="Result Out">
                    <DisplayContent content={tool.result} isDarkMode={isDarkMode} />
                  </CollapsibleSection>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToolInvocationStatus;