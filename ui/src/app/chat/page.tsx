'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/ChatSidebar';
import ModernChatWindow from '@/components/ModernChatWindow';

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const chatWindowRef = useRef<any>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
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

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      {/* Sidebar */}
      <div 
        className={`transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden border-r border-gray-100`}
      >
        <ChatSidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelectChat={(chat) => {
            setSelectedChat(chat);
            // close sidebar on small screens (keeps it open on desktop)
            if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
          }}
          onNewChat={handleNewChatClick}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-full">
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
