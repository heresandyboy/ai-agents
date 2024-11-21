'use client';

import { useSettings } from '@/context/SettingsContext';

export function SettingsPopover() {
  const { fontSize, setFontSize } = useSettings();

  return (
    <div className="w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50">
      <div className="space-y-4">
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