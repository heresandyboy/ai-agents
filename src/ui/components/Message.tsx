import { FC } from 'react';
import { Message } from 'ai/react';

interface MessageProps {
  message: Message;
}

// Update the interface to include proper tool invocation types
interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state?: string;
  args: any;
  result?: any;
}

const MessageComponent: FC<MessageProps> = ({ message }) => {
  return (
    <div 
      className={`p-4 my-2 rounded-lg ${
        message.role === 'user' 
          ? 'bg-blue-100 dark:bg-blue-800/30' 
          : 'bg-gray-100 dark:bg-gray-800'
      }`}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
      </p>
      <p className="text-gray-900 dark:text-gray-100">{message.content}</p>
      {message.toolInvocations?.map((tool: ToolInvocation) => (
        <div 
          key={tool.toolCallId} 
          className="mt-3 p-3 border-l-4 border-spark-purple bg-gray-50 dark:bg-gray-900 rounded"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tool: {tool.toolName}
          </p>
          <pre className="mt-2 text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
          {tool.state === 'result' && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <p className="text-sm text-gray-600 dark:text-gray-400">Result:</p>
              <pre className="mt-1 text-sm overflow-x-auto">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MessageComponent;