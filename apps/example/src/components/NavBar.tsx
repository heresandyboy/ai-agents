'use client';

import { FC } from 'react';
import { GithubIcon, Menu, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface NavBarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const NavBar: FC<NavBarProps> = ({ isSidebarOpen, toggleSidebar }) => {
  return (
    <nav className="bg-[hsl(var(--background))] dark:bg-gray-900 border-b border-spark-border dark:border-spark-border-dark fixed w-full z-50 top-0">
      <div className="flex justify-between h-16 items-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-spark-purple"
            aria-label="Toggle Sidebar"
          >
            {isSidebarOpen ? (
              <X className="h-6 w-6 text-gray-900 dark:text-white" />
            ) : (
              <Menu className="h-6 w-6 text-gray-900 dark:text-white" />
            )}
          </button>
          <div className="flex items-center ml-2">
            <GithubIcon className="h-8 w-8 text-spark-purple" />
            <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
              AI Agents
            </span>
          </div>
        </div>
        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default NavBar;