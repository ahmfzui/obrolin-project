'use client';

import { useState, useRef } from 'react';
import ModernNavbar from '@/components/ModernNavbar';
import ChatSidebar from '@/components/ChatSidebar';
import ModernChatWindow from '@/components/ModernChatWindow';

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const chatWindowRef = useRef<any>(null);

  const handleNewChatClick = () => {
    // Trigger the handleNewChat function from ModernChatWindow
    if (chatWindowRef.current && chatWindowRef.current.handleNewChat) {
      chatWindowRef.current.handleNewChat();
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* Navbar */}
      <ModernNavbar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden border-t border-gray-200">
        {/* Sidebar */}
        <div 
          className={`transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'w-80' : 'w-0'
          } overflow-hidden`}
        >
          <ChatSidebar 
            isOpen={isSidebarOpen} 
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            onSelectChat={(chat) => {
              setSelectedChat(chat);
              // close sidebar on small screens (keeps it open on desktop)
              setIsSidebarOpen(false);
            }}
            onNewChat={handleNewChatClick}
          />
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col relative">
          {/* Toggle Button for Sidebar (Mobile/Desktop) */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 z-10 p-2.5 bg-white hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200 transition-all"
              aria-label="Open sidebar"
            >
              <svg 
                className="h-5 w-5 text-gray-600" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            </button>
          )}

          <ModernChatWindow 
            ref={chatWindowRef}
            selectedChat={selectedChat}
          />
        </div>
      </div>
    </div>
  );
}
