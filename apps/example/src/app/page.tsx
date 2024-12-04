'use client';

import { useState, useEffect } from 'react';
import ChatWindow from '@/components/ChatWindow';
import Sidebar from '@/components/Sidebar';
import NavBar from '@/components/NavBar';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isSidebarOpen]);

  return (
    <>
      <NavBar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex h-screen">
        <Sidebar isOpen={isSidebarOpen} />
        <main
          className={`flex-1 h-[calc(100vh-4rem)] pt-16 ${
            isSidebarOpen ? 'ml-64' : 'ml-0'
          } transition-all duration-200 ease-in-out`}
        >
          <ChatWindow isSidebarOpen={isSidebarOpen} />
        </main>
      </div>
    </>
  );
}