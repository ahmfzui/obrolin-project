'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ChatHistoryItem {
  Chat_id: number;
  Category: string;
  Question: string;
  Answer: string;
  created_at: string;
  conversation_id?: string | null;
}

interface ChatSidebarProps {
  onSelectChat?: (chat: ChatHistoryItem) => void;
  isOpen: boolean;
  onToggle: () => void;
  onNewChat?: () => void;
}

export default function ChatSidebar({ 
  onSelectChat, 
  isOpen, 
  onToggle, 
  onNewChat
}: ChatSidebarProps) {
  const { data: session } = useSession();
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'Capstone', name: 'Capstone' },
    { id: 'KP', name: 'KP' },
    { id: 'MBKM', name: 'MBKM' },
    { id: 'Registrasi MK', name: 'Registrasi' },
  ];

  useEffect(() => {
    if (session?.user) {
      loadHistory();
    }
  }, [session]);

  // Listen for chat updates from other components (e.g. after sending a message)
  useEffect(() => {
    const handler = () => {
      loadHistory();
    };
    window.addEventListener('chat:updated', handler);
    return () => window.removeEventListener('chat:updated', handler);
  }, []);

  useEffect(() => {
    filterHistory();
  }, [searchQuery, selectedCategory, history]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/chat', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // API may return an array directly or an object with .history
        const arr = Array.isArray(data) ? data : data.history || [];
        setHistory(arr);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterHistory = () => {
    let filtered = history;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(chat => chat.Category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(chat => 
        chat.Question.toLowerCase().includes(query) ||
        chat.Answer.toLowerCase().includes(query)
      );
    }

    setFilteredHistory(filtered);
  };

  const groupChatsByDate = (chats: ChatHistoryItem[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { [key: string]: ChatHistoryItem[] } = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };

    chats.forEach(chat => {
      const chatDate = new Date(chat.created_at);
      
      if (chatDate.toDateString() === today.toDateString()) {
        groups.today.push(chat);
      } else if (chatDate.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(chat);
      } else if (chatDate >= weekAgo) {
        groups.week.push(chat);
      } else {
        groups.older.push(chat);
      }
    });

    return groups;
  };

  const groupedChats = groupChatsByDate(filteredHistory);

  return (
    <div className="w-80 bg-white border-r border-gray-100 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-cyan-50/30 via-white to-blue-50/30">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Chat History
          </h2>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200 text-gray-400 hover:text-red-500"
            title="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={() => {
            if (onNewChat) {
              onNewChat();
            } else {
              window.location.href = '/chat';
            }
          }}
          className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 focus:bg-white transition-all duration-200"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md scale-105'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-cyan-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Refresh Button */}
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="w-full px-3 py-2 text-xs font-semibold text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 border border-gray-200 rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center animate-pulse shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium">Loading chats...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium">No chats yet</p>
            <p className="text-xs text-gray-500">Start a conversation!</p>
          </div>
        ) : (
          <>
            {groupedChats.today.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 px-1 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div>
                  Today
                </h3>
                <div className="space-y-2">
                  {groupedChats.today.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.yesterday.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 px-1 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Yesterday
                </h3>
                <div className="space-y-2">
                  {groupedChats.yesterday.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.week.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 px-1 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                  This Week
                </h3>
                <div className="space-y-2">
                  {groupedChats.week.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.older.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 px-1 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  Older
                </h3>
                <div className="space-y-2">
                  {groupedChats.older.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gradient-to-r from-cyan-50/30 to-blue-50/30">
        <div className="text-xs font-semibold text-gray-600 text-center bg-white/80 py-2.5 rounded-lg border border-gray-100">
          {filteredHistory.length} {filteredHistory.length === 1 ? 'chat' : 'chats'}
        </div>
      </div>
    </div>
  );
}

function ChatItem({ chat, onSelect }: { chat: ChatHistoryItem; onSelect?: (chat: ChatHistoryItem) => void }) {
  return (
    <button
      onClick={() => onSelect?.(chat)}
      className="w-full text-left p-3 hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-blue-50/50 rounded-lg transition-all duration-200 group border border-gray-100 hover:border-cyan-300 bg-white shadow-sm hover:shadow-md transform hover:translate-x-1"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-cyan-700 transition-colors">
            {chat.Question}
          </p>
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
            {chat.Answer}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {new Date(chat.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-xs font-semibold px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded-md border border-cyan-100">
          {chat.Category}
        </span>
      </div>
    </button>
  );
}
