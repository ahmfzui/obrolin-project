'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useSession } from 'next-auth/react';

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
                <div className="space-y-8 max-w-3xl px-4">
                  <div className="space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 mx-auto shadow-2xl">
                      <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      Glad you're here, {session?.user?.name || 'Guest'}
                    </h2>
                    <p className="text-gray-600 text-lg">
                      Pilih kategori di bawah dan mulai bertanya tentang info akademik kampusmu!
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setSelectedCategory('Capstone')}
                      className="group bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200/50 rounded-2xl p-5 text-left hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Capstone Project</h4>
                      <p className="text-sm text-gray-600">Info proyek akhir kamu</p>
                    </button>
                    <button 
                      onClick={() => setSelectedCategory('KP')}
                      className="group bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200/50 rounded-2xl p-5 text-left hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Kerja Praktik</h4>
                      <p className="text-sm text-gray-600">Panduan magang & KP</p>
                    </button>
                    <button 
                      onClick={() => setSelectedCategory('MBKM')}
                      className="group bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200/50 rounded-2xl p-5 text-left hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Program MBKM</h4>
                      <p className="text-sm text-gray-600">Info Merdeka Belajar</p>
                    </button>
                    <button 
                      onClick={() => setSelectedCategory('Registrasi MK')}
                      className="group bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200/50 rounded-2xl p-5 text-left hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Registrasi MK</h4>
                      <p className="text-sm text-gray-600">Daftar mata kuliah</p>
                    </button>
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
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'} group`}>
              {!message.isUser && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
              )}

              <div className={`max-w-2xl ${message.isUser ? 'order-first' : ''}`}>
                <div 
                  className={`rounded-2xl px-5 py-3.5 shadow-sm group-hover:shadow-md transition-all duration-200 ${
                    message.isUser
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-tr-md'
                      : 'bg-gradient-to-br from-white to-gray-50/50 text-gray-900 border-2 border-gray-100 group-hover:border-cyan-200 rounded-tl-md'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.text}
                    {message.isStreaming && (
                      <span className="inline-flex items-center ml-2 text-sm opacity-70">
                        <span className="animate-pulse">●</span>
                        <span className="ml-1 italic">typing</span>
                      </span>
                    )}
                  </p>
                </div>
                <div className={`mt-1.5 px-1 flex items-center gap-1.5 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-gray-400 font-medium">
                    {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {message.isUser && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
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
              {/* Category Selector */}
              <div className="relative">
                <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  Select Topic Category
                </label>
                <div className="relative group">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    disabled={isLoading || isSessionLoading}
                    className="w-full px-5 py-4 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:border-cyan-300 hover:shadow-md appearance-none cursor-pointer group-hover:from-cyan-50/30 group-hover:to-blue-50/30"
                    style={{
                      backgroundImage: selectedCategory ? 'linear-gradient(to right, rgb(236 254 255), rgb(224 242 254))' : undefined
                    }}
                  >
                    {categories.map((cat) => (
                      <option 
                        key={cat.id} 
                        value={cat.id} 
                        disabled={cat.disabled}
                        className="py-2 text-gray-900 font-medium"
                      >
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4">
                    <div className={`transition-transform duration-200 ${selectedCategory ? 'text-cyan-600' : 'text-gray-400'}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                {!selectedCategory && (
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Choose a category to start chatting
                  </p>
                )}
              </div>

              {/* Input Box */}
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                  <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    Type Your Message
                  </label>
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
                          ? "Select a category first to start chatting..."
                          : "Ask me anything about your academic needs..."
                      }
                      disabled={!selectedCategory || isLoading}
                      rows={1}
                      className="w-full px-5 py-4 pr-32 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all text-gray-900 placeholder-gray-400 hover:border-emerald-300 group-hover:shadow-md font-medium"
                      style={{ minHeight: '56px', maxHeight: '140px' }}
                    />
                    
                    {/* Character count and enter hint */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-3">
                      {input.trim() && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-gray-200 shadow-sm">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-semibold text-gray-600">{input.length}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-md border border-emerald-200">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-xs font-semibold text-emerald-700">Enter</span>
                      </div>
                    </div>

                    {/* Decorative gradient border on focus */}
                    {input.trim() && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-xl opacity-75"></div>
                    )}
                  </div>
                  
                  {!selectedCategory && (
                    <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium">Please select a category above to enable messaging</span>
                    </p>
                  )}
                </div>

                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="px-6 py-3.5 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white text-sm font-semibold rounded-xl transition-all transform hover:scale-105 shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSendMessage}
                    className="px-6 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-sm font-semibold rounded-xl transition-all transform hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <span className="flex items-center gap-2">
                      Send
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </span>
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
