'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([
    { id: 'all', name: 'All' }
  ]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/documents/categories');
        if (res.ok) {
          const data = await res.json();
          if (data.categories && Array.isArray(data.categories)) {
            const dynamicCats = data.categories.map((c: string) => ({ id: c, name: c }));
            setCategories([{ id: 'all', name: 'All' }, ...dynamicCats]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadHistory();
    }
  }, [session]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleDeleteChat = async (e: React.MouseEvent, chat: ChatHistoryItem) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
      const res = await fetch('/api/chat/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chat.Chat_id,
          conversation_id: chat.conversation_id 
        }),
      });

      if (res.ok) {
        setHistory(prev => prev.filter(c => c.Chat_id !== chat.Chat_id));
      } else {
        alert('Failed to delete chat');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting chat');
    }
  };

  const groupedChats = groupChatsByDate(filteredHistory);

  return (
    <div className="w-80 bg-gray-50/80 border-r border-gray-200 flex flex-col h-full shadow-xl z-20 backdrop-blur-sm">
      {/* Header with Logo */}
      <div className="p-6 border-b border-gray-200/50 bg-gray-50/50">
        <div className="flex items-center justify-between mb-6">
          <div className="relative h-8 w-28">
            <Image
              src="https://i.ibb.co.com/zHhWc18h/Obrol-In.png"
              alt="Obrolin Logo"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-200/50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
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
          className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2 group"
        >
          <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-3 space-y-3 bg-gray-50/50 border-b border-gray-100">
        <div className="relative">
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Custom Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full flex items-center justify-between px-3 py-2 bg-white border rounded-lg text-xs font-medium transition-all duration-200 ${
              isDropdownOpen 
                ? 'border-cyan-500 ring-2 ring-cyan-500/10 shadow-sm' 
                : 'border-gray-200 text-gray-600 hover:border-cyan-300 hover:text-cyan-600'
            }`}
          >
            <span>
              {categories.find(c => c.id === selectedCategory)?.name || 'All'}
            </span>
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-cyan-500' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="py-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-cyan-600'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-500 font-medium">Loading history...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">No chats found</p>
              <p className="text-xs text-gray-400 mt-1">Start a new conversation to see it here.</p>
            </div>
          </div>
        ) : (
          <>
            {groupedChats.today.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Today</h3>
                <div className="space-y-1">
                  {groupedChats.today.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} onDelete={(e) => handleDeleteChat(e, chat)} />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.yesterday.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Yesterday</h3>
                <div className="space-y-1">
                  {groupedChats.yesterday.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} onDelete={(e) => handleDeleteChat(e, chat)} />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.week.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Previous 7 Days</h3>
                <div className="space-y-1">
                  {groupedChats.week.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} onDelete={(e) => handleDeleteChat(e, chat)} />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.older.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Older</h3>
                <div className="space-y-1">
                  {groupedChats.older.map(chat => (
                    <ChatItem key={chat.Chat_id} chat={chat} onSelect={onSelectChat} onDelete={(e) => handleDeleteChat(e, chat)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Profile & Sign Out (Bottom) */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200 group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm text-white font-bold text-sm shrink-0">
            {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {session?.user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {session?.user?.email || ''}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatItem({ chat, onSelect, onDelete }: { chat: ChatHistoryItem; onSelect?: (chat: ChatHistoryItem) => void; onDelete?: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={() => onSelect?.(chat)}
      className="w-full text-left p-3 hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-blue-50/50 rounded-lg transition-all duration-200 group border border-gray-100 hover:border-cyan-300 bg-white shadow-sm hover:shadow-md transform hover:translate-x-1 relative"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 pr-6">
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
      
      {/* Delete Button */}
      <div 
        onClick={onDelete}
        className="absolute top-2 right-2 p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200"
        title="Delete chat"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>
    </button>
  );
}

function groupChatsByDate(chats: ChatHistoryItem[]) {
  const groups = {
    today: [] as ChatHistoryItem[],
    yesterday: [] as ChatHistoryItem[],
    week: [] as ChatHistoryItem[],
    older: [] as ChatHistoryItem[],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  chats.forEach(chat => {
    const date = new Date(chat.created_at);
    const chatDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (chatDate.getTime() === today.getTime()) {
      groups.today.push(chat);
    } else if (chatDate.getTime() === yesterday.getTime()) {
      groups.yesterday.push(chat);
    } else if (chatDate > lastWeek) {
      groups.week.push(chat);
    } else {
      groups.older.push(chat);
    }
  });

  return groups;
}
