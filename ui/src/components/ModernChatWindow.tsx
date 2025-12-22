'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useSession } from 'next-auth/react';

import Image from 'next/image';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ProgressStatus {
  stage: string;
  message: string;
}

interface ModernChatWindowProps {
  selectedChat?: any | null;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const ModernChatWindow = forwardRef(({ selectedChat, isSidebarOpen, onToggleSidebar }: ModernChatWindowProps, ref) => {
  const { data: session, status: sessionStatus } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; disabled?: boolean }[]>([
    { id: '', name: 'Select Category', disabled: true }
  ]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/documents/categories');
        if (res.ok) {
          const data = await res.json();
          if (data.categories && Array.isArray(data.categories)) {
            const dynamicCats = data.categories.map((c: string) => ({ id: c, name: c }));
            setCategories([{ id: '', name: 'Select Category', disabled: true }, ...dynamicCats]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    };
    fetchCategories();
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<ProgressStatus | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const initRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamBufferRef = useRef<string>('');
  const lastUpdateRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // NOTE: we no longer auto-create a RAG conversation on mount. Creating
  // the lightweight DB row (and RAG conversation) is deferred until the
  // user actually sends the first message (or explicitly starts a chat).
  // This prevents placeholder "Uncategorized" rows from appearing.

  // When user selects a chat from the sidebar, load its history
  useEffect(() => {
    const loadSelected = async () => {
      if (!selectedChat) return;

      // Set category from selected chat immediately
      if (selectedChat.Category) {
        setSelectedCategory(selectedChat.Category);
      }

      // If the selected chat has a conversation_id, fetch history from RAG via proxy
      const convId = selectedChat.conversation_id;
      if (convId) {
        try {
          setIsLoading(true);
          setConversationId(convId);
          const res = await fetch('/api/chat/history', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: convId }),
          });
          if (!res.ok) {
            throw new Error('Failed to load conversation history');
          }
          const data = await res.json();
          const msgs = (data.messages || []).map((m: any) => ({
            id: crypto.randomUUID(),
            text: m.content,
            isUser: m.type === 'user',
            // Use message timestamp if available, otherwise fallback to chat creation time, then current time
            timestamp: m.timestamp ? new Date(m.timestamp) : (selectedChat.created_at ? new Date(selectedChat.created_at) : new Date()),
            isStreaming: false,
          }));
          setMessages(msgs);
        } catch (e: any) {
          console.error('Error loading selected conversation:', e);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Fallback: use DB-stored Question / Answer as a two-message conversation
        const fallback: Message[] = [];
        if (selectedChat.Question) {
          fallback.push({ id: crypto.randomUUID(), text: selectedChat.Question, isUser: true, timestamp: new Date(selectedChat.created_at) });
        }
        if (selectedChat.Answer) {
          fallback.push({ id: crypto.randomUUID(), text: selectedChat.Answer, isUser: false, timestamp: new Date(selectedChat.created_at) });
        }
        setMessages(fallback);
        setConversationId(selectedChat.conversation_id || '');
      }
    };
    loadSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progressStatus]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategory) {
      setError('Please select a category first');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // If we don't yet have a conversationId, create one now.
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
        if (!startData?.conversation_id) {
          throw new Error('Server did not return conversation_id');
        }

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
      timestamp: new Date(),
    };

    setMessages(current => [...current, userMessage]);
    setInput('');

    try {
      // show immediate feedback: add a placeholder bot message and a "thinking" status
      const placeholderBot: Message = {
        id: crypto.randomUUID(),
        text: '',
        isUser: false,
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages(current => [...current, placeholderBot]);
      setProgressStatus({ stage: 'thinking', message: 'Sedang memproses pertanyaan Anda...' });

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/chat/stream', {
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
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      // clear the thinking status once streaming begins
      setProgressStatus(null);

      // Process SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('Stream reader not available');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.stage === 'thinking' || data.stage === 'searching' || 
                  data.stage === 'analyzing' || data.stage === 'generating') {
                setProgressStatus({
                  stage: data.stage,
                  message: data.message,
                });
              } else if (data.stage === 'streaming') {
                setProgressStatus(null);
                
                // Accumulate content in buffer
                streamBufferRef.current += data.content;
                
                // Throttle UI updates to every 50ms for smooth rendering
                const now = Date.now();
                if (now - lastUpdateRef.current >= 50) {
                  lastUpdateRef.current = now;
                  const bufferedContent = streamBufferRef.current;
                  
                  setMessages(current => {
                    const updated = [...current];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && !lastMsg.isUser && lastMsg.isStreaming) {
                      lastMsg.text = bufferedContent;
                    }
                    return updated;
                  });
                }
              } else if (data.stage === 'complete') {
                setProgressStatus(null);
                
                // Reset buffer and ensure final text is set
                const finalText = data.full_content || streamBufferRef.current;
                streamBufferRef.current = '';
                lastUpdateRef.current = 0;
                
                setMessages(current => {
                  const updated = [...current];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && !lastMsg.isUser) {
                    lastMsg.text = finalText;
                    lastMsg.isStreaming = false;
                  }
                  return updated;
                });
                // notify other components (sidebar) that chat data updated
                try {
                  window.dispatchEvent(new CustomEvent('chat:updated'));
                } catch (e) {
                  // ignore in non-browser contexts
                }
              } else if (data.stage === 'error') {
                setProgressStatus(null);
                throw new Error(data.message);
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        streamBufferRef.current = '';
        lastUpdateRef.current = 0;
        return;
      }

      console.error('Submit error:', err);
      setError(err.message);
      setProgressStatus(null);
      streamBufferRef.current = '';
      lastUpdateRef.current = 0;

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        text: `Error: ${err.message}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(current => [...current, errorMessage]);
    } finally {
      setIsLoading(false);
      setProgressStatus(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setProgressStatus(null);
    }
  };

  const handleRetryInit = () => {
    initRef.current = false;
    setError('');
    setIsInitializing(false);
    setConversationId('');
  };

  const handleNewChat = () => {
    // If there's an existing chat selected (or conversation active) and it hasn't been rated,
    // show a feedback modal before clearing the chat. Otherwise just reset.
    const hasChatToRate = !!selectedChat || !!conversationId || messages.length > 0;
    const alreadyRated = selectedChat ? selectedChat.Feedback !== null && selectedChat.Feedback !== undefined : false;

    if (hasChatToRate && !alreadyRated) {
      setShowFeedbackModal(true);
      return;
    }

    // No feedback required or already rated — just clear
    setMessages([]);
    setSelectedCategory('');
    setError('');
    initRef.current = false;
    setConversationId('');
    setIsInitializing(false);
  };

  const submitFeedbackAndClear = async () => {
    try {
      setIsSubmittingFeedback(true);
      const body: any = { rating: feedbackRating };
      if (feedbackComment) body.comment = feedbackComment;
      if (selectedChat && selectedChat.Chat_id) {
        body.chatId = selectedChat.Chat_id;
      } else if (conversationId) {
        // If no DB-selected chat, include the RAG conversation_id so server can find the linked chat
        body.conversation_id = conversationId;
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // ignore result for now — UI will reflect cleared chat. If server returns error, show it briefly.
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setError(err.error || 'Failed to submit feedback');
        setTimeout(() => setError(''), 3000);
      }
    } catch (e: any) {
      console.error('Feedback submit error', e);
      setError('Failed to submit feedback');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSubmittingFeedback(false);
      setShowFeedbackModal(false);
      // clear chat window
      setMessages([]);
      setSelectedCategory('');
      setError('');
      initRef.current = false;
      setConversationId('');
      setIsInitializing(false);
    }
  }

  const skipFeedbackAndClear = () => {
    setShowFeedbackModal(false);
    setMessages([]);
    setSelectedCategory('');
    setError('');
    initRef.current = false;
    setConversationId('');
    setIsInitializing(false);
  }

  // Expose handleNewChat to parent via ref
  useImperativeHandle(ref, () => ({
    handleNewChat
  }));

  const isSessionLoading = sessionStatus === 'loading' || isInitializing;
  const canSendMessage = !isLoading && selectedCategory && input.trim();

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header Bar */}
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-6 bg-white/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          {!isSidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              title="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="relative h-8 w-24 opacity-80 hover:opacity-100 transition-opacity">
            <Image
              src="https://i.ibb.co.com/zHhWc18h/Obrol-In.png"
              alt="Obrolin Logo"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </div>
        
        {/* Optional: Add more header actions here if needed */}
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300" 
            onClick={() => setShowFeedbackModal(false)} 
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 z-10 transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-200">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Selesai Mengobrol?</h3>
              <p className="text-sm text-gray-500">Bantu kami menjadi lebih baik dengan memberikan rating!</p>
            </div>

            {/* Rating */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-3">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFeedbackRating(n)}
                    className={`group relative w-12 h-12 rounded-xl border-2 transition-all duration-200 flex items-center justify-center ${
                      feedbackRating === n 
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-transparent text-white shadow-lg scale-110' 
                        : 'bg-white text-gray-400 border-gray-100 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-600'
                    }`}
                  >
                    <span className="text-lg font-bold">{n}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-3 px-4">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Kurang</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sangat Baik</span>
              </div>
            </div>

            {/* Comment */}
            <div className="mb-8">
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Ceritakan pengalamanmu (opsional)..."
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder-gray-400"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button 
                onClick={skipFeedbackAndClear} 
                className="flex-1 px-5 py-3.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-all duration-200"
              >
                Lewati
              </button>
              <button 
                onClick={submitFeedbackAndClear} 
                disabled={isSubmittingFeedback} 
                className="flex-1 px-5 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-cyan-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isSubmittingFeedback ? 'Mengirim...' : 'Kirim Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container - Messages + Input Area Combined */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 bg-white flex flex-col scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
          {/* Messages Section */}
          <div className="flex-1 space-y-8 mb-8">
            {/* Welcome Message & Centered Input (When no messages) */}
            {messages.length === 0 && !error ? (
              <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-in fade-in zoom-in duration-500">
                {isSessionLoading ? (
                  <div className="space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center animate-pulse shadow-xl shadow-cyan-200">
                      <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">Memuat...</p>
                  </div>
                ) : (
                <div className="space-y-10 max-w-2xl px-4 w-full">
                  <div className="space-y-6 text-center">
                    <div>
                        <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 mb-4 tracking-tight">
                        Halo, {session?.user?.name || 'Guest'}!
                        </h2>
                        <p className="text-gray-500 text-lg font-medium leading-relaxed">
                        Pilih topik di bawah ini dan mulai diskusikan kebutuhan akademikmu.
                        </p>
                    </div>
                  </div>
                  
                  <div className="max-w-2xl mx-auto space-y-8">
                    {/* Custom Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-full flex items-center justify-between px-6 py-5 bg-white border-2 rounded-2xl transition-all duration-200 ${
                          isDropdownOpen 
                            ? 'border-cyan-500 ring-4 ring-cyan-500/10 shadow-lg' 
                            : 'border-gray-100 hover:border-cyan-200 hover:shadow-md'
                        }`}
                      >
                        <span className={`text-lg font-medium ${selectedCategory ? 'text-gray-900' : 'text-gray-400'}`}>
                          {selectedCategory 
                            ? categories.find(c => c.id === selectedCategory)?.name 
                            : '-- Pilih Kategori Percakapan --'}
                        </span>
                        <svg 
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-cyan-500' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {isDropdownOpen && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                          <div className="py-2">
                            {categories.filter(c => !c.disabled).map((category) => (
                              <button
                                key={category.id}
                                onClick={() => {
                                  setSelectedCategory(category.id);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full text-left px-6 py-3.5 text-base font-medium transition-colors ${
                                  selectedCategory === category.id
                                    ? 'bg-cyan-50 text-cyan-700'
                                    : 'text-gray-700 hover:bg-gray-50 hover:text-cyan-600'
                                }`}
                              >
                                {category.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Centered Input Box */}
                    <form onSubmit={handleSubmit} className="w-full relative">
                      <div className="relative group">
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (canSendMessage) {
                                handleSubmit(e);
                              }
                            }
                          }}
                          placeholder={
                            !selectedCategory
                              ? "Pilih kategori di atas untuk memulai..."
                              : "Ketik pesanmu di sini..."
                          }
                          disabled={!selectedCategory || isLoading}
                          rows={1}
                          className="w-full px-8 py-6 pr-16 bg-white border-2 border-gray-100 rounded-[2rem] resize-none focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-800 placeholder-gray-400 shadow-lg hover:shadow-xl hover:border-cyan-200 text-lg scrollbar-none"
                          style={{ minHeight: '80px', maxHeight: '200px' }}
                        />
                        <div className="absolute right-4 bottom-4">
                          <button
                            type="submit"
                            disabled={!canSendMessage}
                            className="p-3.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl transition-all shadow-md hover:shadow-lg hover:shadow-cyan-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center"
                            title="Send message"
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
            ) : (

              // Normal Chat Flow
              <>
                {/* Error Display */}
                {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
                <button
                    onClick={handleRetryInit}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Retry
                </button>
              </div>
            </div>
          )}

              {/* Messages */}
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const showProgressInBubble = isLastMessage && !message.isUser && progressStatus && message.isStreaming && !message.text;

            return (
            <div 
              key={message.id} 
              className={`flex gap-4 ${message.isUser ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-4 duration-500`}
            >
              {!message.isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
              )}

              <div className={`max-w-[85%] md:max-w-2xl ${message.isUser ? 'order-first' : ''}`}>
                <div 
                  className={`rounded-2xl px-6 py-3.5 transition-all duration-200 ${
                    message.isUser
                      ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-sm shadow-cyan-100'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-md ring-1 ring-gray-100 border-l-4 border-l-cyan-500'
                  }`}
                >
                  {showProgressInBubble ? (
                    <div className="flex items-center gap-3 py-1">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                      </div>
                      <span className="text-sm font-medium text-gray-500 animate-pulse">
                        {progressStatus.message}
                      </span>
                    </div>
                  ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${message.isUser ? 'text-white' : 'text-gray-800'}`}>
                      {message.text}
                      {message.isStreaming && (
                        <span className="inline-flex items-center ml-2 gap-1">
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
                        </span>
                      )}
                    </p>
                  </div>
                  )}
                </div>
              </div>

              {message.isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shrink-0 shadow-sm border border-gray-200 mt-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            );
          })}
              </>
            )}

          <div ref={messagesEndRef} />
          </div>

          {/* Bottom Input Form - Only show if there are messages */}
          {messages.length > 0 && (
            <form onSubmit={handleSubmit} className="w-full">
            <div className="space-y-4">
              {/* Active Category Indicator (Minimalist) */}
              {messages.length > 0 && selectedCategory && (
                <div className="flex justify-center pb-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-full shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Topik:</span>
                    <span className="text-xs font-bold text-gray-700">
                      {categories.find(c => c.id === selectedCategory)?.name || selectedCategory}
                    </span>
                  </div>
                </div>
              )}

              {/* Input Box */}
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                  <div className="relative group">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (canSendMessage) {
                            handleSubmit(e);
                          }
                        }
                      }}
                      placeholder={
                        !selectedCategory
                          ? "Pilih kategori di atas untuk memulai..."
                          : "Ketik pesanmu di sini..."
                      }
                      disabled={!selectedCategory || isLoading}
                      rows={1}
                      className="w-full px-5 py-4 pr-12 bg-white border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-800 placeholder-gray-400 shadow-sm hover:shadow-md hover:border-cyan-200"
                      style={{ minHeight: '60px', maxHeight: '180px' }}
                    />
                  </div>
                </div>

                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="p-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-all shadow-sm border border-red-100 flex items-center justify-center h-[60px] w-[60px]"
                    title="Stop generating"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSendMessage}
                    className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl transition-all shadow-md hover:shadow-lg hover:shadow-cyan-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center h-[60px] w-[60px]"
                    title="Send message"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
});

ModernChatWindow.displayName = 'ModernChatWindow';

export default ModernChatWindow;
