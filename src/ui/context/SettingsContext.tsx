'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextType {
  fontSize: number;
  setFontSize: (size: number) => void;
  enterToSend: boolean;
  setEnterToSend: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState<number>(16); // Default font size in pixels
  const [enterToSend, setEnterToSend] = useState<boolean>(true); // Default to true

  // On mount, load settings from localStorage
  useEffect(() => {
    const storedFontSize = localStorage.getItem('fontSize');
    const storedEnterToSend = localStorage.getItem('enterToSend');

    if (storedFontSize) {
      setFontSize(Number(storedFontSize));
    }

    if (storedEnterToSend) {
      setEnterToSend(storedEnterToSend === 'true');
    }
  }, []);

  // Persist settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('enterToSend', enterToSend.toString());
  }, [enterToSend]);

  return (
    <SettingsContext.Provider value={{ fontSize, setFontSize, enterToSend, setEnterToSend }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}