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

const categories = [
  { id: '', name: 'Select Category', disabled: true },
  { id: 'Capstone', name: 'Capstone Project' },
  { id: 'KP', name: 'Internship (KP)' },
  { id: 'MBKM', name: 'MBKM Program' },
  { id: 'Registrasi MK', name: 'Course Registration' },
];

interface ModernChatWindowProps {
  selectedChat?: any | null;
}

const ModernChatWindow = forwardRef(({ selectedChat }: ModernChatWindowProps, ref) => {
  const { data: session, status: sessionStatus } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
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
  
  const initRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // NOTE: we no longer auto-create a RAG conversation on mount. Creating
  // the lightweight DB row (and RAG conversation) is deferred until the
  // user actually sends the first message (or explicitly starts a chat).
  // This prevents placeholder "Uncategorized" rows from appearing.

  // When user selects a chat from the sidebar, load its history
  useEffect(() => {
    const loadSelected = async () => {
      if (!selectedChat) return;

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
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
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
      setProgressStatus({ stage: 'thinking', message: 'Mikiiiir... sedang memproses...' });

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
                setMessages(current => {
                  const updated = [...current];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && !lastMsg.isUser) {
                    lastMsg.text += data.content;
                  }
                  return updated;
                });
              } else if (data.stage === 'complete') {
                setProgressStatus(null);
                setMessages(current => {
                  const updated = [...current];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && !lastMsg.isUser) {
                    lastMsg.text = data.full_content;
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
        return;
      }

      console.error('Submit error:', err);
      setError(err.message);
      setProgressStatus(null);

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
      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setShowFeedbackModal(false)} 
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 z-10 transform transition-all">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Rate Your Experience</h3>
              <p className="text-sm text-gray-500">Help us improve by sharing your feedback</p>
            </div>

            {/* Rating */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">How helpful was this chat?</label>
              <div className="flex items-center justify-center gap-3">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFeedbackRating(n)}
                    className={`group relative w-14 h-14 rounded-xl border-2 transition-all duration-200 ${
                      feedbackRating === n 
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-500 text-white shadow-lg scale-110' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-cyan-300 hover:bg-cyan-50'
                    }`}
                  >
                    <span className="text-lg font-bold">{n}</span>
                    {feedbackRating === n && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-2 px-2">
                <span className="text-xs text-gray-400">Not helpful</span>
                <span className="text-xs text-gray-400">Very helpful</span>
              </div>
            </div>

            {/* Comment */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Additional Comments (Optional)
              </label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Share your thoughts about this chat..."
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-gray-400"
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button 
                onClick={skipFeedbackAndClear} 
                className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
              >
                Skip for Now
              </button>
              <button 
                onClick={submitFeedbackAndClear} 
                disabled={isSubmittingFeedback} 
                className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isSubmittingFeedback ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container - Messages + Input Area Combined */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-white flex flex-col">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
          {/* Messages Section */}
          <div className="flex-1 space-y-6 mb-6">
            {/* Welcome Message */}
            {messages.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                {isSessionLoading ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center animate-pulse shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">Memuat...</p>
                  </div>
                ) : (
                <div className="space-y-8 max-w-3xl px-4 w-full">
                  <div className="space-y-4 text-center">
                    <div className="relative w-64 h-32 mx-auto mb-4">
                      <Image
                        src="https://i.ibb.co.com/zHhWc18h/Obrol-In.png"
                        alt="Obrolin Logo"
                        fill
                        className="object-contain"
                        priority
                      />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      Halo, {session?.user?.name || 'Guest'}! 👋
                    </h2>
                    <p className="text-gray-600 text-lg">
                      Pilih kategori di bawah dan mulai bertanya tentang info akademik kampusmu!
                    </p>
                  </div>
                  
                  <div className="max-w-md mx-auto">
                    <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-2">
                      Pilih Kategori Percakapan
                    </label>
                    <div className="relative">
                      <select
                        id="category-select"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="block w-full pl-4 pr-10 py-4 text-base text-gray-900 border-gray-300 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-xl shadow-sm bg-white border-2 cursor-pointer appearance-none"
                      >
                        <option value="" disabled className="text-gray-500">-- Pilih Kategori --</option>
                        <option value="Capstone" className="text-gray-900">Capstone Project</option>
                        <option value="KP" className="text-gray-900">Kerja Praktik (KP)</option>
                        <option value="MBKM" className="text-gray-900">Program MBKM</option>
                        <option value="Registrasi MK" className="text-gray-900">Registrasi Mata Kuliah</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 text-center">
                      {selectedCategory ? `Kategori terpilih: ${selectedCategory}` : 'Silakan pilih kategori untuk memulai chat'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-3xl mx-auto">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-800">{error}</p>
                  <button
                    onClick={handleRetryInit}
                    className="mt-2 text-sm font-medium text-red-700 hover:text-red-800"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

              {/* Messages */}
          {messages.map((message, index) => (
            <div 
              key={message.id} 
              className={`flex gap-4 ${message.isUser ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {!message.isUser && (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-100 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
              )}

              <div className={`max-w-[85%] md:max-w-2xl ${message.isUser ? 'order-first' : ''}`}>
                <div 
                  className={`rounded-2xl px-6 py-4 shadow-sm transition-all duration-200 ${
                    message.isUser
                      ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-sm shadow-blue-100'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-gray-100'
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${message.isUser ? 'text-white' : 'text-gray-800'}`}>
                      {message.text}
                      {message.isStreaming && (
                        <span className="inline-flex items-center ml-2 gap-1">
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className={`mt-2 flex items-center gap-2 ${message.isUser ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                  <span className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">
                    {message.isUser ? 'You' : 'Obrolin AI'} • {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {message.isUser && (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shrink-0 shadow-sm border border-gray-200">
                  <span className="text-sm font-bold text-gray-600">
                    {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* progressStatus is used for internal stage updates but we don't render
              the separate status bar to avoid duplicate UI; the placeholder
              bot message serves as the visible feedback. */}

          <div ref={messagesEndRef} />
          </div>

          {/* Input Form - Same Level as Messages */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="space-y-4">
              {/* Active Category Indicator (Minimalist) */}
              {messages.length > 0 && selectedCategory && (
                <div className="flex justify-center pb-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Topic:</span>
                    <span className="text-xs font-semibold text-gray-700">
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
                      className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-800 placeholder-gray-400 shadow-sm hover:shadow-md"
                      style={{ minHeight: '52px', maxHeight: '160px' }}
                    />
                  </div>
                </div>

                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="p-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-all shadow-sm border border-red-100 flex items-center justify-center"
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
                    className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl transition-all shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center"
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
        </div>
      </div>
    </div>
  );
});

ModernChatWindow.displayName = 'ModernChatWindow';

export default ModernChatWindow;
