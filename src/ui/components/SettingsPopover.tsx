'use client';

import { useSettings } from '@/context/SettingsContext';
import { X } from 'lucide-react';

interface SettingsPopoverProps {
  onClose: () => void;
}

export function SettingsPopover({ onClose }: SettingsPopoverProps) {
  const { fontSize, setFontSize } = useSettings();

  return (
    <div className="w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 relative">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        aria-label="Close"
      >
        <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
      </button>
      <div className="space-y-4 mt-6">
        <div>
          <label className="block text-sm font-medium mb-2">Font Size</label>
          <input
            type="range"
            min="12"
            max="20"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-sm text-gray-500 mt-1">{fontSize}px</div>
        </div>
      </div>
    </div>
  );
}