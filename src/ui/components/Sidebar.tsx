'use client';

import { FC } from 'react';

const Sidebar: FC = () => {
  return (
    <div className="w-64 h-full bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 fixed left-0 top-16 bottom-0">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Conversations
        </h2>
        {/* Add conversation list here */}
      </div>
    </div>
  );
};

export default Sidebar;