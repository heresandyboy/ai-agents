import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import NavBar from '@/components/NavBar';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata() {
  return {
    title: 'AI Agents Chat',
    description: 'Interactive AI Agents with tool usage capabilities',
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="light">
      <body className={`${inter.className} min-h-screen bg-white dark:bg-gray-900 antialiased`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}