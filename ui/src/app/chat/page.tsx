'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/ChatSidebar';
import ModernChatWindow from '@/components/ModernChatWindow';

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed on mobile
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const chatWindowRef = useRef<any>(null);

  // Set sidebar open by default on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // Will redirect
  }

  const handleNewChatClick = () => {
    // Trigger the handleNewChat function from ModernChatWindow
    if (chatWindowRef.current && chatWindowRef.current.handleNewChat) {
      chatWindowRef.current.handleNewChat();
    }
  };

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-white relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed on mobile, relative on desktop */}
      <div 
        className={`
          fixed md:relative inset-y-0 left-0 z-30
          transition-transform duration-300 ease-in-out overflow-hidden bg-gray-50/80 border-r border-gray-200
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isSidebarOpen ? 'w-[85vw] sm:w-80' : 'md:w-0 md:border-none'}
          md:transition-[width] md:duration-300
        `}
      >
        <ChatSidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelectChat={(chat) => {
            setSelectedChat(chat);
            closeSidebarOnMobile();
          }}
          onNewChat={() => {
            handleNewChatClick();
            closeSidebarOnMobile();
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-full w-full">
        <ModernChatWindow 
          ref={chatWindowRef}
          selectedChat={selectedChat}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>
    </div>
  );
}
