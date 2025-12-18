"use client";

import { useEffect, useState } from 'react';
import ModernNavbar from '@/components/ModernNavbar';

type Cat = { category: string; count: number };
type Recent = { question: string; created_at?: string; userName?: string | null; userId?: number; chat_id?: number; category?: string };

export default function AdminAnalyticsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [questions, setQuestions] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avgFeedback, setAvgFeedback] = useState<number | null>(null);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/analytics?limit=20')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCats(d.categories || []);
        // newer API now returns recentPrompts for latest user prompts
        setQuestions(d.recentPrompts || d.questions || []);
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));

    // fetch feedback average
    fetch('/api/admin/feedback')
      .then((r) => r.json())
      .then((d) => {
        if (!d || d.error) return;
        setAvgFeedback(typeof d.average === 'number' ? Number(d.average) : null);
        setFeedbackCount(typeof d.count === 'number' ? Number(d.count) : 0);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-gray-50 via-white to-cyan-50">
      <ModernNavbar />

      <main className="flex-1 overflow-auto py-8">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Admin Dashboard</h1>
                    <p className="text-sm text-gray-600 mt-1">Analytics & System Overview</p>
                  </div>
                </div>
              </div>
              
              {/* Feedback Score Card */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Average Rating</div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="text-3xl font-bold text-gray-900">
                        {avgFeedback !== null ? avgFeedback.toFixed(1) : '—'}
                      </div>
                      <div className="text-sm text-gray-500">/ 5.0</div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{feedbackCount} responses</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center animate-pulse shadow-lg mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 font-medium">Loading analytics...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800 text-sm font-medium">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Categories Card */}
            <section className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <h2 className="text-xl font-bold">Top Categories</h2>
                  </div>
                  <span className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">Top {cats.length}</span>
                </div>
              </div>

              <div className="p-6">
                <ul className="space-y-3">
                  {cats.map((c, i) => (
                    <li key={i} className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-blue-50/50 transition-all duration-200 hover:shadow-md cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md bg-gradient-to-br from-cyan-500 to-blue-600">
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{c.category || 'Uncategorized'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{c.count} conversations</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                          {c.count}
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-cyan-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </li>
                  ))}
                  {cats.length === 0 && (
                    <li className="py-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 font-medium">No data available</p>
                      <p className="text-xs text-gray-400 mt-1">Categories will appear here</p>
                    </li>
                  )}
                </ul>
              </div>
            </section>

            {/* Recent Prompts Card */}
            <section className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <h2 className="text-xl font-bold">Recent Prompts</h2>
                  </div>
                  <span className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">Latest</span>
                </div>
              </div>

              <div className="p-6">
                <ul className="space-y-3 max-h-[520px] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  {questions.map((q, i) => (
                    <li key={q.chat_id || i} className="group p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-100 hover:border-cyan-200 hover:from-cyan-50/50 hover:to-blue-50/50 transition-all duration-200 hover:shadow-md cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.question}</p>
                          <div className="text-xs text-gray-400 mt-1">{q.category || '—'} • {q.userName ? q.userName : (q.userId ? `user:${q.userId}` : 'unknown')}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-right">
                          <span className="text-xs text-gray-500">{q.created_at ? new Date(q.created_at).toLocaleString() : '—'}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                  {questions.length === 0 && (
                    <li className="py-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 font-medium">No questions yet</p>
                      <p className="text-xs text-gray-400 mt-1">User prompts will appear here</p>
                    </li>
                  )}
                </ul>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
