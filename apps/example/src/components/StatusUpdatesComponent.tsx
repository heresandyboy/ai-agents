'use client';

import React from 'react';

interface StatusUpdatesComponentProps {
  statusUpdates: string[];
}

const StatusUpdatesComponent: React.FC<StatusUpdatesComponentProps> = ({ statusUpdates }) => {
  return (
    <div className="p-4 my-2 rounded-lg bg-yellow-100 dark:bg-yellow-800/30">
      <h3 className="text-sm font-semibold mb-2">Status Updates:</h3>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {statusUpdates.map((status, index) => (
          <li key={index} className="text-gray-700 dark:text-gray-300">
            {status}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StatusUpdatesComponent;