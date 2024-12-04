'use client';

import { FC } from 'react';

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: FC<SidebarProps> = ({ isOpen }) => {
  return (
    <aside
      className={`fixed top-16 left-0 z-40 w-64 h-[calc(100vh-4rem)] overflow-y-auto bg-[hsl(var(--background))] dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Conversations
        </h2>
        {/* Add conversation list here */}
      </div>
    </aside>
  );
};

export default Sidebar;