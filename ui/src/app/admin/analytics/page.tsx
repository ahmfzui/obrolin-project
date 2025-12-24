"use client";

import { useEffect, useState } from 'react';
import ModernNavbar from '@/components/ModernNavbar';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  Activity, 
  Users, 
  MessageSquare, 
  Star, 
  TrendingUp, 
  Calendar,
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
  const [activityData, setActivityData] = useState<any[]>([]);
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

        // Process Activity Data (Group by Date/Hour)
        // For simplicity, let's group by Date for the last 7 days or just by available dates
        const activityMap = new Map();
        recent.forEach((r: Recent) => {
          if (r.created_at) {
            const date = new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            activityMap.set(date, (activityMap.get(date) || 0) + 1);
          }
        });
        
        // Convert to array and reverse to show chronological order if API returns newest first
        let activityArray = Array.from(activityMap.entries()).map(([name, count]) => ({ name, count })).reverse();
        
        // Fix for AreaChart: If only 1 data point, add a dummy previous point to make the chart render a line/area
        if (activityArray.length === 1) {
          const singleDate = activityArray[0].name;
          // Try to parse date or just add "Previous"
          activityArray.unshift({ name: '', count: 0 });
        } else if (activityArray.length === 0) {
           // Mock data for empty state
           activityArray = [{name: 'No Data', count: 0}];
        }

        setActivityData(activityArray);
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

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of system performance and user engagement</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            Error: {error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Interactions */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Total Interactions</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalInteractions}</p>
              </div>

              {/* Active Users */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Active Users</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{activeUsers}</p>
              </div>

              {/* Avg Feedback */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-yellow-50 rounded-lg">
                    <Star className="w-6 h-6 text-yellow-600" />
                  </div>
                  <span className="text-xs text-gray-400">{feedbackCount} reviews</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Avg. Rating</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-gray-900">{avgFeedback?.toFixed(1) || '-'}</p>
                  <span className="text-sm text-gray-400">/ 5.0</span>
                </div>
              </div>

              {/* System Status (Mock) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Activity className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Healthy</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">System Status</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">Healthy</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Chart */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    Activity Overview
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0891b2" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9ca3af', fontSize: 12}} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9ca3af', fontSize: 12}} 
                      />
                      <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#0891b2" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Distribution */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-gray-400" />
                  Topic Distribution
                </h3>
                <div className="h-[300px] w-full relative">
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
                      <span className="block text-2xl font-bold text-gray-900">{cats.reduce((a, b) => a + b.count, 0)}</span>
                      <span className="text-xs text-gray-500">Topics</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {cats.slice(0, 4).map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span className="text-gray-600">{cat.category}</span>
                      </div>
                      <span className="font-medium text-gray-900">{cat.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prompt</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {questions.slice(0, 10).map((q, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center text-cyan-700 font-bold text-xs">
                              {(q.userName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {q.userName || `User ${q.userId || 'Unknown'}`}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 line-clamp-1 max-w-md">{q.question}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {q.category || 'General'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                          {q.created_at ? new Date(q.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
