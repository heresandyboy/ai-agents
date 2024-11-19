'use client';

import { GithubIcon } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const NavBar = () => {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-spark-border dark:border-spark-border-dark fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <GithubIcon className="h-8 w-8 text-spark-purple" />
            <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
              AI Agents
            </span>
          </div>
          <div className="flex items-center">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;