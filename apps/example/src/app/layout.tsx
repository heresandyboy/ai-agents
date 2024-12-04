import '@/styles/globals.css';
import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import { CustomThemeProvider } from '@/components/ThemeProvider';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeScript } from '@/components/ThemeScript';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Agents Chat',
  description: 'Interactive AI Agents with tool usage capabilities',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.className} h-screen antialiased`}>
        <CustomThemeProvider>
          <SettingsProvider>
            {children}
          </SettingsProvider>
        </CustomThemeProvider>
      </body>
    </html>
  );
}