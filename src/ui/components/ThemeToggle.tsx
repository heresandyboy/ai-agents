'use client';

import { useEffect, useState } from 'react';
import { themeState } from '@/signals/themeSignals';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    themeState.toggle();
  };

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      onClick={handleToggle}
      className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full focus:outline-none hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      aria-label="Toggle Theme"
    >
      {themeState.currentTheme.value === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-500" />
      ) : (
        <Moon className="h-5 w-5 text-gray-700" />
      )}
    </button>
  );
};

export default ThemeToggle;