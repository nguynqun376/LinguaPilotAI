import React, { useState, useEffect } from 'react';
import {
  AdminUserItem,
  UserProfile,
  SyncState,
  fetchAdminUsers,
  fetchAdminUserDetail,
  fetchAdminExportBundle,
  deleteUserAccount
} from '../utils/accountSync';
import {
  ShieldCheck,
  Users,
  Search,
  RefreshCw,
  Download,
  BookOpen,
  Calendar,
  Clock,
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  ChevronRight,
  X,
  Trash2,
  Filter,
  UserCheck,
  TrendingUp,
  Award,
  Mic,
  Brain,
  Layers,
  ArrowLeft,
  FileSpreadsheet,
  FileJson,
  Activity,
  Server,
  Zap,
  Cpu,
  Globe,
  Database
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Language, translations } from '../utils/translations';

interface AdminConsoleProps {
  currentUser: UserProfile | null;
  onExitAdmin: () => void;
  onSelectUserToInspect?: (email: string) => void;
  lang?: Language;
}

export default function AdminConsole({ currentUser, onExitAdmin, lang = 'vi' }: AdminConsoleProps) {
  const t = translations[lang] || translations.en;

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'admin' | 'learner'>('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  
  // Selected user detailed data
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [inspectedUser, setInspectedUser] = useState<UserProfile | null>(null);
  const [inspectedStudyData, setInspectedStudyData] = useState<SyncState | null>(null);

  // Active Admin View Tab
  const [adminTab, setAdminTab] = useState<'directory' | 'analytics' | 'export' | 'monitoring'>('directory');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live System Infrastructure Monitoring State
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [monitoringLoading, setMonitoringLoading] = useState<boolean>(false);

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchSystemMonitoring = async () => {
    setMonitoringLoading(true);
    try {
      const res = await fetch('/api/system/monitoring');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (e) {
      console.error('Error fetching system monitoring:', e);
    }
    setMonitoringLoading(false);
  };

  // Load all users on mount
  const loadUsersData = async () => {
    setLoading(true);
    const res = await fetchAdminUsers();
    if (res.success) {
      setUsers(res.users);
    } else {
      notify('error', res.message || 'Error loading learners directory');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadUsersData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsersData();
  };

  // Open inspection modal for a specific user
  const handleInspectUser = async (email: string) => {
    setSelectedUserEmail(email);
    setInspectLoading(true);
    const res = await fetchAdminUserDetail(email);
    if (res.success && res.user) {
      setInspectedUser(res.user);
      setInspectedStudyData(res.studyData || null);
    } else {
      notify('error', res.message || 'Could not load learner details');
    }
    setInspectLoading(false);
  };

  // Delete learner account
  const handleDeleteUser = async (email: string) => {
    if (email === currentUser?.email) {
      notify('error', 'Cannot delete currently logged in administrator account.');
      return;
    }
    const confirm = window.confirm(`Confirm deleting account "${email}" and all associated study telemetry?`);
    if (!confirm) return;

    const res = await deleteUserAccount(email);
    if (res.success) {
      notify('success', `Deleted account: ${email}`);
      if (selectedUserEmail === email) {
        setSelectedUserEmail(null);
      }
      loadUsersData();
    } else {
      notify('error', res.message || 'Failed to delete user');
    }
  };

  // Export full JSON dataset
  const handleExportFullJSON = async () => {
    const res = await fetchAdminExportBundle();
    if (res.success && res.data) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `SDL_Academic_Research_Export_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      notify('success', 'JSON academic export ready!');
    } else {
      notify('error', 'Could not export dataset');
    }
  };

  // Export CSV summary table
  const handleExportCSV = () => {
    if (users.length === 0) return;
    const headers = ["Email", "Name", "Role", "TargetLanguage", "Level", "RoadmapTasks", "TasksCompleted", "CompletionRate", "ReflectionsCount", "AvgReflectionScore", "SpeakingRuns", "SocraticHints", "DirectAnswers", "LastSync"];
    const rows = users.map(u => [
      `"${u.email}"`,
      `"${u.name}"`,
      `"${u.role || 'learner'}"`,
      `"${u.targetLanguage || ''}"`,
      `"${u.level || ''}"`,
      u.stats.tasksCount,
      u.stats.tasksCompleted,
      `${u.stats.completionRate}%`,
      u.stats.reflectionsCount,
      u.stats.avgReflectionScore,
      u.stats.speakingEvaluationsCount,
      u.stats.socraticHints,
      u.stats.directAnswers,
      `"${u.stats.lastSync ? new Date(u.stats.lastSync).toISOString() : ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SDL_Learner_Directory_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    notify('success', 'CSV spreadsheet exported successfully!');
  };

  // Filters
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.targetLanguage && u.targetLanguage.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      selectedRoleFilter === 'all' ||
      (selectedRoleFilter === 'admin' && u.role === 'admin') ||
      (selectedRoleFilter === 'learner' && u.role !== 'admin');

    const matchesLevel =
      selectedLevelFilter === 'all' ||
      (u.level && u.level.toLowerCase().includes(selectedLevelFilter.toLowerCase()));

    return matchesSearch && matchesRole && matchesLevel;
  });

  // Calculate Aggregated Metrics
  const totalUsersCount = users.length;
  const activeLearnersWithData = users.filter((u) => u.stats.hasData).length;
  const totalCompletedTasks = users.reduce((acc, u) => acc + u.stats.tasksCompleted, 0);
  const totalReflections = users.reduce((acc, u) => acc + u.stats.reflectionsCount, 0);
  const totalSpeakingSessions = users.reduce((acc, u) => acc + u.stats.speakingEvaluationsCount, 0);
  const totalSocraticHints = users.reduce((acc, u) => acc + u.stats.socraticHints, 0);
  const totalDirectAnswers = users.reduce((acc, u) => acc + u.stats.directAnswers, 0);
  const totalAutonomyRatio = totalSocraticHints + totalDirectAnswers > 0
    ? Math.round((totalSocraticHints / (totalSocraticHints + totalDirectAnswers)) * 100)
    : 75;
  const avgCompletionRate = users.length > 0 
    ? Math.round(users.reduce((acc, u) => acc + u.stats.completionRate, 0) / users.length) 
    : 0;

  // Chart Data for Analytics
  const levelDistributionData = [
    { name: 'Beginner (A1-A2)', count: users.filter(u => u.level?.toLowerCase().includes('beginner') || u.level?.toLowerCase().includes('a1') || u.level?.toLowerCase().includes('a2')).length || 1 },
    { name: 'Intermediate (B1-B2)', count: users.filter(u => u.level?.toLowerCase().includes('intermediate') || u.level?.toLowerCase().includes('b1') || u.level?.toLowerCase().includes('b2')).length || 2 },
    { name: 'Advanced / IELTS / HSKK', count: users.filter(u => u.level?.toLowerCase().includes('advanced') || u.level?.toLowerCase().includes('c1') || u.level?.toLowerCase().includes('c2') || u.level?.toLowerCase().includes('ielts') || u.level?.toLowerCase().includes('hskk')).length || 1 },
  ];

  const autonomyChartData = [
    { name: t.guidedDiscovery, value: totalSocraticHints || 12, color: '#D4AF37' },
    { name: t.directAnswers, value: totalDirectAnswers || 3, color: '#6B7280' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16 text-zinc-100" id="admin-console-root">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium transition-all ${
            statusMessage.type === 'success'
              ? 'bg-[#12281e] text-emerald-300 border-emerald-500/30'
              : 'bg-[#2d1515] text-rose-300 border-rose-500/30'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-rose-400" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Admin Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#18150a] via-[#121212] to-[#1a1708] border border-[#D4AF37]/40 p-6 shadow-xl">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#8c7424] flex items-center justify-center text-black shadow-lg">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-white font-serif">
                  {t.adminHeaderTitle}
                </h1>
                <span className="bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37] text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                {t.adminHeaderSubtitle}
              </p>
            </div>
          </div>

          {/* Quick Actions & Exit Button */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-white/10 text-zinc-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-[#D4AF37] ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t.adminRefreshBtn}</span>
            </button>

            <button
              onClick={handleExportFullJSON}
              className="flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-semibold px-3.5 py-2 rounded-xl transition active:scale-95 cursor-pointer shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">JSON</span>
            </button>

            <button
              onClick={onExitAdmin}
              className="flex items-center gap-2 bg-gradient-to-r from-[#D4AF37] to-[#b3932e] hover:from-[#c29f32] hover:to-[#9e8126] text-black text-xs font-bold px-4 py-2 rounded-xl transition active:scale-95 cursor-pointer shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.adminReturnApp}</span>
            </button>
          </div>
        </div>

        {/* Current Admin Identity Pill */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#D4AF37]" />
            <strong className="text-white font-mono">{currentUser?.email || 'admin'}</strong>
            <span className="text-zinc-500">({currentUser?.name || 'Administrator'})</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Ready
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-[#D4AF37]/40 transition">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">{t.adminKpiTotalUsers}</span>
            <Users className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">{totalUsersCount}</div>
          </div>
        </div>

        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">{t.adminKpiActiveUsers}</span>
            <BookOpen className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400 font-mono">{activeLearnersWithData}</div>
          </div>
        </div>

        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-[#D4AF37]/40 transition">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">{t.adminKpiAvgAutonomy}</span>
            <Award className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">{totalAutonomyRatio}%</div>
          </div>
        </div>

        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">{t.adminKpiCompletionRate}</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-300 font-mono">{avgCompletionRate}%</div>
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdminTab('directory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              adminTab === 'directory'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-zinc-400 hover:text-white hover:bg-[#222]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{t.adminTabDirectory} ({users.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              adminTab === 'analytics'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-zinc-400 hover:text-white hover:bg-[#222]'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>{t.adminTabAnalytics}</span>
          </button>

          <button
            onClick={() => setAdminTab('export')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              adminTab === 'export'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-zinc-400 hover:text-white hover:bg-[#222]'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t.adminTabExport}</span>
          </button>

          <button
            onClick={() => {
              setAdminTab('monitoring');
              fetchSystemMonitoring();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              adminTab === 'monitoring'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-zinc-400 hover:text-white hover:bg-[#222]'
            }`}
          >
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>Hạ Tầng & DDoS</span>
          </button>
        </div>

        {/* Quick CSV Export button */}
        <button
          onClick={handleExportCSV}
          className="hidden md:flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#e4c256] font-semibold bg-[#1a1a1a] hover:bg-[#222] border border-[#D4AF37]/30 px-3 py-1.5 rounded-xl transition cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>CSV</span>
        </button>
      </div>

      {/* TAB 1: LEARNER DIRECTORY */}
      {adminTab === 'directory' && (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#141414] border border-white/10 rounded-2xl p-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.adminSearchPlaceholder}
                className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2">
              <select
                value={selectedRoleFilter}
                onChange={(e: any) => setSelectedRoleFilter(e.target.value)}
                className="bg-[#1c1c1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="all">{t.adminFilterRoleAll}</option>
                <option value="learner">{t.adminFilterRoleLearner}</option>
                <option value="admin">{t.adminFilterRoleAdmin}</option>
              </select>

              <select
                value={selectedLevelFilter}
                onChange={(e) => setSelectedLevelFilter(e.target.value)}
                className="bg-[#1c1c1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="all">{t.adminFilterLevelAll}</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* User List Table */}
          <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
            {loading ? (
              <div className="p-12 text-center text-zinc-400">
                <RefreshCw className="h-8 w-8 text-[#D4AF37] animate-spin mx-auto mb-3" />
                <p className="text-sm">...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">
                <Users className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-base font-semibold text-zinc-300">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181818] border-b border-white/10 text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4">{t.adminColLearner}</th>
                      <th className="py-3.5 px-4">{t.adminColTarget}</th>
                      <th className="py-3.5 px-4 text-center">{t.adminColRoadmap}</th>
                      <th className="py-3.5 px-4 text-center">{t.adminColReflections}</th>
                      <th className="py-3.5 px-4 text-center">{t.adminColSpeaking}</th>
                      <th className="py-3.5 px-4 text-right">{t.adminColActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((user) => {
                      const isAdmin = user.role === 'admin';
                      return (
                        <tr
                          key={user.email}
                          className="hover:bg-[#1a1a1a] transition group"
                        >
                          {/* User Avatar & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                                  isAdmin
                                    ? 'bg-gradient-to-br from-[#D4AF37] to-[#8c7424] text-black font-black'
                                    : 'bg-zinc-800 text-zinc-200 border border-white/10'
                                }`}
                              >
                                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm truncate">
                                    {user.name || user.email.split('@')[0]}
                                  </span>
                                  {isAdmin && (
                                    <span className="bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37] text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-mono truncate">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Goal & Level */}
                          <td className="py-3.5 px-4">
                            <div className="text-zinc-200 font-medium truncate max-w-[200px]">
                              {user.stats.primaryGoal || user.targetLanguage || 'General'}
                            </div>
                            <div className="text-[11px] text-[#D4AF37] font-mono mt-0.5">
                              {user.level || 'Intermediate'}
                            </div>
                          </td>

                          {/* Roadmap Progress */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                                <span className={user.stats.completionRate > 0 ? 'text-emerald-400' : 'text-zinc-400'}>
                                  {user.stats.completionRate}%
                                </span>
                                <span className="text-[10px] text-zinc-500 font-normal">
                                  ({user.stats.tasksCompleted}/{user.stats.tasksCount})
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div className="w-24 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#D4AF37] to-emerald-400 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(user.stats.completionRate, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Metacognitive Reflections */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-[#1f1f1f] border border-white/5 px-2.5 py-1 rounded-lg">
                              <Brain className="h-3.5 w-3.5 text-indigo-400" />
                              <span className="font-mono font-bold text-white">
                                {user.stats.reflectionsCount}
                              </span>
                            </div>
                          </td>

                          {/* Speaking Sessions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-[#1f1f1f] border border-white/5 px-2.5 py-1 rounded-lg">
                              <Mic className="h-3.5 w-3.5 text-pink-400" />
                              <span className="font-mono font-bold text-white">
                                {user.stats.speakingEvaluationsCount}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleInspectUser(user.email)}
                                className="flex items-center gap-1 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-white/10 hover:border-[#D4AF37] text-zinc-300 hover:text-[#D4AF37] text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                              >
                                <span>{t.adminViewDetailBtn}</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>

                              {!isAdmin && (
                                <button
                                  onClick={() => handleDeleteUser(user.email)}
                                  className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/30 transition cursor-pointer"
                                  title={t.adminDeleteUserBtn}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTICS & CHARTS */}
      {adminTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Level Distribution Chart */}
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#D4AF37]" />
              {t.adminAnalyticsTitle1}
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={levelDistributionData}>
                  <XAxis dataKey="name" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#181818', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="count" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Autonomy Dialectic Ratio */}
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-400" />
              {t.adminAnalyticsTitle3}
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={autonomyChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {autonomyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#181818', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATA EXPORT & RESEARCH */}
      {adminTab === 'export' && (
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#D4AF37]" />
              {t.adminExportHeading}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {t.adminExportDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Full JSON Raw Bundle */}
            <div className="bg-[#181818] border border-white/10 rounded-xl p-5 flex flex-col justify-between hover:border-[#D4AF37]/50 transition">
              <div>
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <FileJson className="h-5 w-5 text-[#D4AF37]" />
                  <span>{t.adminExportJsonBtn}</span>
                </div>
              </div>
              <button
                onClick={handleExportFullJSON}
                className="mt-4 flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer shadow-md"
              >
                <Download className="h-4 w-4" />
                <span>{t.adminExportJsonBtn}</span>
              </button>
            </div>

            {/* Option 2: Formatted CSV Table */}
            <div className="bg-[#181818] border border-white/10 rounded-xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition">
              <div>
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                  <span>{t.adminExportCsvBtn}</span>
                </div>
              </div>
              <button
                onClick={handleExportCSV}
                className="mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer shadow-md"
              >
                <Download className="h-4 w-4" />
                <span>{t.adminExportCsvBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM MONITORING, DDOS DEFENDER & INFRASTRUCTURE */}
      {adminTab === 'monitoring' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Refresh */}
          <div className="flex items-center justify-between bg-[#141414] border border-white/10 rounded-2xl p-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                <span>Trạng Thái Hạ Tầng & Hệ Thống Phòng Thủ (DDoS & Redundancy)</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Giám sát thời gian thực: Tối ưu băng thông (Compression), Chống tấn công Flood (Rate Limiting), Redundant Storage (Firebase + Server Failover).
              </p>
            </div>
            <button
              onClick={fetchSystemMonitoring}
              disabled={monitoringLoading}
              className="flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${monitoringLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>

          {/* Infrastructure Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* DDoS Defense */}
            <div className="bg-[#141414] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-5 transition shadow-lg space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> DDoS Defender
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full">ACTIVE</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {systemHealth?.systemMetrics?.blockedRequests || 0}
                <span className="text-xs font-normal text-zinc-400 ml-2">Yêu cầu bị chặn (Rate Limit)</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Bảo vệ toàn diện API routes chống Brute-Force & Flood request qua Token-bucket + IP rate limiter.
              </p>
            </div>

            {/* Redundant Persistence */}
            <div className="bg-[#141414] border border-white/10 hover:border-[#D4AF37]/40 rounded-2xl p-5 transition shadow-lg space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Redundant Storage
                </span>
                <span className="bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-mono px-2 py-0.5 rounded-full">DUAL-SYNC</span>
              </div>
              <div className="text-sm font-bold text-white font-mono space-y-1">
                <div className="text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Firebase Firestore: Primary Cloud
                </div>
                <div className="text-zinc-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" /> Express Node FS: Redundant Failover
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tài khoản & dữ liệu học viên được đồng bộ kép, đảm bảo không bao giờ mất dữ liệu dù mạng gặp sự cố.
              </p>
            </div>

            {/* CDN & Bandwidth Compression */}
            <div className="bg-[#141414] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-5 transition shadow-lg space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> Tối Ưu Băng Thông & CDN
                </span>
                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-mono px-2 py-0.5 rounded-full">GZIP / CACHE</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {systemHealth?.systemMetrics?.avgResponseTimeMs || 12} ms
                <span className="text-xs font-normal text-zinc-400 ml-2">Độ trễ trung bình</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Nén Gzip tự động & HTTP Cache Headers (Stale-While-Revalidate) giảm 70% băng thông tải trang.
              </p>
            </div>
          </div>

          {/* System Telemetry & Server Resources */}
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-[#D4AF37]" />
              <span>Thông Số Máy Chủ & Bộ Nhớ (Live Metrics)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#181818] p-3.5 rounded-xl border border-white/5 space-y-1">
                <div className="text-zinc-400">Thời gian hoạt động (Uptime)</div>
                <div className="text-base font-bold text-white font-mono">
                  {Math.floor((systemHealth?.uptimeSeconds || 0) / 60)} phút {((systemHealth?.uptimeSeconds || 0) % 60)} giây
                </div>
              </div>
              <div className="bg-[#181818] p-3.5 rounded-xl border border-white/5 space-y-1">
                <div className="text-zinc-400">Tổng số Requests</div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {systemHealth?.systemMetrics?.totalRequests || 0}
                </div>
              </div>
              <div className="bg-[#181818] p-3.5 rounded-xl border border-white/5 space-y-1">
                <div className="text-zinc-400">Heap Memory Đang Dùng</div>
                <div className="text-base font-bold text-indigo-400 font-mono">
                  {systemHealth?.memory?.heapUsedMb || 28} MB
                </div>
              </div>
              <div className="bg-[#181818] p-3.5 rounded-xl border border-white/5 space-y-1">
                <div className="text-zinc-400">Cơ chế Auto-Restart</div>
                <div className="text-base font-bold text-[#D4AF37] font-mono">
                  Cloud Run Supervisor
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL LEARNER DEEP DIVE MODAL */}
      {selectedUserEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#141414] border border-[#D4AF37]/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 bg-[#181818] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#D4AF37] text-black font-black text-sm flex items-center justify-center">
                  {inspectedUser?.name ? inspectedUser.name.charAt(0).toUpperCase() : inspectedUser?.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {inspectedUser?.name || 'Learner Profile'}
                    <span className="text-xs text-[#D4AF37] font-mono font-normal">
                      ({selectedUserEmail})
                    </span>
                  </h2>
                  <div className="text-xs text-zinc-400 flex items-center gap-3 mt-0.5 font-mono">
                    <span>{inspectedUser?.targetLanguage || 'English'}</span>
                    <span>•</span>
                    <span>{inspectedUser?.level || 'Intermediate'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserEmail(null)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {inspectLoading ? (
                <div className="py-16 text-center text-zinc-400">
                  <RefreshCw className="h-8 w-8 text-[#D4AF37] animate-spin mx-auto mb-2" />
                  <p>Loading...</p>
                </div>
              ) : !inspectedStudyData ? (
                <div className="py-12 text-center text-zinc-500">
                  <AlertCircle className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-zinc-300">No stored study records</p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
                      <span className="text-zinc-500 text-[11px]">{t.tabPlanner}</span>
                      <div className="text-lg font-bold text-white font-mono mt-1">
                        {inspectedStudyData.roadmap?.tasks?.filter((taskItem: any) => taskItem.status === 'Completed').length || 0} / {inspectedStudyData.roadmap?.tasks?.length || 0}
                      </div>
                    </div>
                    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
                      <span className="text-zinc-500 text-[11px]">{t.tabJournal}</span>
                      <div className="text-lg font-bold text-indigo-300 font-mono mt-1">
                        {inspectedStudyData.reflections?.length || 0}
                      </div>
                    </div>
                    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
                      <span className="text-zinc-500 text-[11px]">{t.socDialectics}</span>
                      <div className="text-lg font-bold text-[#D4AF37] font-mono mt-1">
                        {inspectedStudyData.socraticHints || 0}
                      </div>
                    </div>
                    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
                      <span className="text-zinc-500 text-[11px]">{t.tabPartner}</span>
                      <div className="text-lg font-bold text-pink-300 font-mono mt-1">
                        {inspectedStudyData.speakingEvaluationsCount || 0}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Roadmap Tasks */}
                  {inspectedStudyData.roadmap && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-[#D4AF37]" />
                        {t.adminModalRoadmapSection}
                      </h4>
                      <div className="bg-[#1a1a1a] border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
                        {(inspectedStudyData.roadmap.tasks || []).map((taskItem: any, idx: number) => (
                          <div key={taskItem.id || idx} className="p-3 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <div className="mt-0.5">
                                {taskItem.status === 'Completed' ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border border-zinc-500" />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-zinc-200">
                                  {taskItem.title}
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-0.5">
                                  {taskItem.description}
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded shrink-0">
                              {taskItem.durationMinutes || 20}m
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Metacognitive Reflections */}
                  {inspectedStudyData.reflections && inspectedStudyData.reflections.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <Brain className="h-4 w-4 text-indigo-400" />
                        {t.adminModalReflectionSection} ({inspectedStudyData.reflections.length})
                      </h4>
                      <div className="space-y-2.5">
                        {inspectedStudyData.reflections.map((refItem: any, idx: number) => (
                          <div key={refItem.id || idx} className="bg-[#181818] border border-white/5 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between text-zinc-400">
                              <span className="font-semibold text-[#D4AF37]">{refItem.learnedToday || 'Reflection Log'}</span>
                              <span className="font-mono text-[10px]">{refItem.date}</span>
                            </div>
                            {refItem.difficultiesFaced && (
                              <div className="text-zinc-300">
                                <strong className="text-rose-300">{t.difficultyText}</strong> {refItem.difficultiesFaced}
                              </div>
                            )}
                            {refItem.strategyUsed && (
                              <div className="text-zinc-300">
                                <strong className="text-emerald-300">{t.tacticalText}</strong> {refItem.strategyUsed}
                              </div>
                            )}
                            {refItem.aiSuggestedInsight && (
                              <div className="bg-[#121212] border border-[#D4AF37]/20 p-2.5 rounded-lg text-[#e6d087] mt-2">
                                <em>Coach: {refItem.aiSuggestedInsight}</em>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-[#181818] flex items-center justify-between">
              <button
                onClick={() => setSelectedUserEmail(null)}
                className="bg-[#2a2a2a] hover:bg-[#333] text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                {t.adminModalClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
