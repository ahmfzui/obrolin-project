"use client";

import { useEffect, useState } from 'react';
import ModernNavbar from '@/components/ModernNavbar';
import { 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Activity, 
  Users, 
  MessageSquare, 
  Star, 
  TrendingUp, 
  PieChart as PieChartIcon
} from 'lucide-react';

type Cat = { category: string; count: number };
type Recent = { question: string; created_at?: string; userName?: string | null; userId?: number; chat_id?: number; category?: string };

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminAnalyticsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [questions, setQuestions] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avgFeedback, setAvgFeedback] = useState<number | null>(null);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  
  // Processed Data for Charts
  const [totalInteractions, setTotalInteractions] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);

  useEffect(() => {
    setLoading(true);
    
    // Fetch Analytics
    fetch('/api/admin/analytics?limit=100') // Fetch more for better charts
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCats(d.categories || []);
        const recent = d.recentPrompts || d.questions || [];
        setQuestions(recent);
        // Use totalInteractions from API if available, otherwise fallback to recent length
        setTotalInteractions(d.totalInteractions !== undefined ? d.totalInteractions : recent.length);
        
        // Calculate Active Users (Unique User IDs or Names)
        const uniqueUsers = new Set(recent.map((r: Recent) => r.userId || r.userName).filter(Boolean));
        setActiveUsers(uniqueUsers.size);
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));

    // Fetch Feedback
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
    <div className="min-h-screen bg-white flex flex-col">
      <ModernNavbar />

      <main className="flex-1 py-4 sm:py-8 px-3 sm:px-4 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">Overview of system performance and user engagement</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-cyan-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm">
            Error: {error}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Interactions */}
              <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                    <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-medium">Total Interactions</h3>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalInteractions}</p>
              </div>

              {/* Active Users */}
              <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="p-1.5 sm:p-2 bg-purple-50 rounded-lg">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-medium">Active Users</h3>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{activeUsers}</p>
              </div>

              {/* Avg Feedback */}
              <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="p-1.5 sm:p-2 bg-yellow-50 rounded-lg">
                    <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">{feedbackCount} reviews</span>
                </div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-medium">Avg. Rating</h3>
                <div className="flex items-baseline gap-1 sm:gap-2 mt-1">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{avgFeedback?.toFixed(1) || '-'}</p>
                  <span className="text-xs sm:text-sm text-gray-400">/ 5.0</span>
                </div>
              </div>

              {/* System Status (Mock) */}
              <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="p-1.5 sm:p-2 bg-green-50 rounded-lg">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium text-green-600 bg-green-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">Healthy</span>
                </div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-medium">System Status</h3>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">Healthy</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Category Distribution */}
              <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  Topic Distribution
                </h3>
                <div className="h-[220px] sm:h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="category"
                        stroke="none"
                      >
                        {cats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <span className="block text-xl sm:text-2xl font-bold text-gray-900">{cats.reduce((a, b) => a + b.count, 0)}</span>
                      <span className="text-[10px] sm:text-xs text-gray-500">Topics</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                  {cats.slice(0, 4).map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span className="text-gray-600 truncate max-w-[100px] sm:max-w-none">{cat.category}</span>
                      </div>
                      <span className="font-medium text-gray-900">{cat.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity Table */}
              <div className="lg:col-span-2 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Prompt</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {questions.slice(0, 10).map((q, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center text-cyan-700 font-bold text-[10px] sm:text-xs">
                                {(q.userName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[60px] sm:max-w-none">
                                {q.userName || `User ${q.userId || 'Unknown'}`}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-1 max-w-md">{q.question}</p>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-gray-100 text-gray-600">
                              {q.category || 'General'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-[10px] sm:text-sm text-gray-500">
                            {q.created_at ? new Date(q.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
