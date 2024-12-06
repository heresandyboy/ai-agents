'use client';

import React from 'react';
import ReactJson from 'react-json-view';

interface UsageDataComponentProps {
  usage: any;
}

const UsageDataComponent: React.FC<UsageDataComponentProps> = ({ usage }) => {
  const isDarkMode =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <div className="p-4 my-2 rounded-lg bg-green-100 dark:bg-green-800/30">
      <h3 className="text-sm font-semibold mb-2">Usage Data:</h3>
      <ReactJson
        src={usage}
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
    </div>
  );
};

export default UsageDataComponent;