'use client';

import { useState, useRef, useEffect } from 'react';
import ChatBubble from './ChatBubble';
import { useSession } from 'next-auth/react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

// Category mapping yang sesuai dengan FastAPI backend
const categories = [
  { id: 'Capstone', name: 'Capstone (Tugas Akhir)' },
  { id: 'KP', name: 'KP (Kerja Praktek)' },
  { id: 'MBKM', name: 'MBKM' },
  { id: 'Registrasi MK', name: 'Registrasi MK' },
];

export default function ChatWindow() {
  const { data: session, status: sessionStatus } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  
  const initRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // NOTE: conversation creation is deferred until the user sends the
    // first message. This avoids creating placeholder DB rows named
    // "Uncategorized" when the chat UI mounts.
  }, [sessionStatus, session, conversationId, isInitializing]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) {
      setError('Please select a category first');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Create conversation on first send if needed
    if (!conversationId) {
      try {
        setIsInitializing(true);
        const startRes = await fetch('/api/chat/start', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: selectedCategory || undefined }),
        });

        if (!startRes.ok) {
          const err = await startRes.json().catch(() => ({ error: startRes.statusText }));
          throw new Error(err.error || `HTTP ${startRes.status}`);
        }
        const startData = await startRes.json();
        if (!startData?.conversation_id) throw new Error('Server did not return conversation_id');
        setConversationId(startData.conversation_id);
      } catch (err: any) {
        setError(err?.message || 'Failed to start conversation');
        setIsInitializing(false);
        return;
      } finally {
        setIsInitializing(false);
      }
    }

    if (!input.trim()) return;

    setError('');
    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: input,
      isUser: true,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');

    try {
      // immediate feedback: add a placeholder bot message so user sees we're working
      const placeholderBot: Message = {
        id: crypto.randomUUID(),
        text: 'Mikir... tunggu sebentar',
        isUser: false,
      };
      setMessages((current) => [...current, placeholderBot]);

      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.text,
          category: selectedCategory,
          conversation_id: conversationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.answer || 'Gagal mengirim pesan');
      }

      // replace the placeholder with actual answer
      setMessages((current) => {
        const updated = [...current];
        const last = updated[updated.length - 1];
        if (last && !last.isUser) {
          last.text = data.answer;
        } else {
          updated.push({ id: crypto.randomUUID(), text: data.answer, isUser: false });
        }
        return updated;
      });
    } catch (err: any) {
      console.error('[ChatWindow] Submit error:', err);
      setError(err.message);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        text: `Error: ${err.message}`,
        isUser: false,
      };
      setMessages((current) => [...current, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryInit = () => {
    initRef.current = false;
    setError('');
    setIsInitializing(false);
    setConversationId('');
  };

  const isSessionLoading = sessionStatus === 'loading' || isInitializing;

  // Debug info untuk development
  const showDebugInfo = process.env.NODE_ENV === 'development';

  return (
    <div className="border rounded-lg shadow-lg bg-white">
      {/* Debug Info (hanya di development) */}
      {showDebugInfo && (
        <div className="bg-gray-100 p-2 text-xs font-mono border-b">
          <div>Status: {sessionStatus}</div>
          <div>User ID: {session?.user?.id || 'none'}</div>
          <div>Conv ID: {conversationId || 'none'}</div>
          <div>Initializing: {isInitializing ? 'yes' : 'no'}</div>
        </div>
      )}

      {/* 1. Pemilihan Kategori */}
      <div className="p-4 border-b">
        <label
          htmlFor="category"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Langkah 1: Pilih Kategori (Wajib Sesuai Use Case)
        </label>
        <select
          id="category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
          disabled={isSessionLoading}
        >
          <option value="" disabled>
            {isSessionLoading ? 'Memuat sesi...' : '-- Pilih Kategori --'}
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Area Pesan */}
      <div className="h-96 p-4 overflow-y-auto flex flex-col space-y-2">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
            <div className="flex items-start">
              <div className="shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-2">Koneksi Backend Gagal</h3>
                <div className="text-sm text-red-700 whitespace-pre-wrap font-mono bg-red-100 p-3 rounded">
                  {error}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleRetryInit}
                    className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition shadow"
                  >
                    🔄 Coba Lagi
                  </button>
                  <a
                    href="https://github.com/ahmfzui/obrolin-chatbot/blob/main/README.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition shadow"
                  >
                    📖 Lihat Panduan
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {messages.length === 0 && !error && (
          <div className="text-center text-gray-500 m-auto">
            {isSessionLoading ? (
              <div className="space-y-3">
                <div className="animate-pulse text-lg">⏳</div>
                <div className="font-medium">Mempersiapkan sesi chat...</div>
                <p className="text-xs text-gray-400">
                  Proses ini memakan waktu 3-10 detik
                </p>
              </div>
            ) : conversationId ? (
              <div className="space-y-2">
                <div className="text-2xl">✅</div>
                <div>Sesi siap! Pilih kategori dan mulai bertanya.</div>
              </div>
            ) : (
              '🔄 Menginisialisasi...'
            )}
          </div>
        )}
        
        {messages.map((msg) => (
          <ChatBubble key={msg.id} text={msg.text} isUser={msg.isUser} />
        ))}
        
        {isLoading && (
          <ChatBubble text="Sedang mengetik..." isUser={false} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Form */}
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
              isSessionLoading
                ? 'Mempersiapkan sesi...'
                : !selectedCategory
                ? 'Pilih kategori terlebih dahulu...'
                : 'Ketik pertanyaan Anda...'
            }
            className="flex-grow p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            disabled={isSessionLoading || !selectedCategory || isLoading}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={
            isSessionLoading ||
            !selectedCategory ||
            !input.trim() ||
            isLoading
          }
        >
          {isLoading ? '⏳' : '📤'}
        </button>
      </form>
    </div>
  );
}