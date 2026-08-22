import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Users,
  Eye,
  UserPlus,
  Clock,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  CheckCircle2,
  TrendingUp,
  FileText,
  Megaphone,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  Sparkles,
  Lock,
  Compass,
  Radio
} from 'lucide-react';
import { User, Article, AdCampaign } from '../../types';
import {
  calculatePlatformTrafficStats,
  getVisitLogs,
  TrafficStats,
  VisitLogEntry
} from '../../utils/trafficTracker';

interface AdminAnalyticsTabProps {
  users: User[];
  articles: Article[];
  campaigns: AdCampaign[];
  onSelectUser?: (user: User) => void;
  onSelectArticle?: (article: Article) => void;
}

export const AdminAnalyticsTab: React.FC<AdminAnalyticsTabProps> = ({
  users,
  articles,
  campaigns,
  onSelectUser,
  onSelectArticle
}) => {
  const [timeRange, setTimeRange] = useState<'24h' | 'today' | '7d' | 'all'>('24h');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'visitors_stream' | 'signups_log' | 'content_ads'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [stats, setStats] = useState<TrafficStats>(() =>
    calculatePlatformTrafficStats(articles, users, campaigns)
  );

  // Auto refresh or manual refresh
  const refreshStats = () => {
    setStats(calculatePlatformTrafficStats(articles, users, campaigns));
    setLastRefreshed(new Date());
  };

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 10000); // 10s live pulse
    return () => clearInterval(interval);
  }, [articles, users, campaigns]);

  // Registered Users sorted by creation time
  const recentSignups = useMemo(() => {
    return [...users]
      .filter((u) => u.id !== 'guest')
      .sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });
  }, [users]);

  // Filtered Signups
  const filteredSignups = useMemo(() => {
    if (!searchQuery.trim()) return recentSignups;
    const q = searchQuery.toLowerCase();
    return recentSignups.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [recentSignups, searchQuery]);

  // Filtered Visits Stream
  const filteredVisits = useMemo(() => {
    const logs = stats.recentVisits;
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        l.pageTitle.toLowerCase().includes(q) ||
        l.path.toLowerCase().includes(q) ||
        l.ipPlaceholder.toLowerCase().includes(q) ||
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        l.referrer.toLowerCase().includes(q)
    );
  }, [stats.recentVisits, searchQuery]);

  // Roles breakdown
  const readersCount = users.filter((u) => u.role === 'reader' && u.id !== 'guest').length;
  const writersCount = users.filter((u) => u.role === 'writer').length;
  const advertisersCount = users.filter((u) => u.role === 'advertiser').length;
  const adminsCount = users.filter((u) => u.role === 'admin').length;
  const verifiedCount = users.filter((u) => u.isVerified).length;

  // Format time ago helper
  const formatTimeAgo = (isoString: string) => {
    try {
      const now = Date.now();
      const diff = now - new Date(isoString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'الآن';
      if (mins < 60) return `منذ ${mins} دقيقة`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `منذ ${hours} ساعة`;
      const days = Math.floor(hours / 24);
      return `منذ ${days} يوم`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Indicator */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">
                مركز الإحصائيات العامة والتحقق اللحظي
              </h3>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>مباشر (Live)</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              رصد دقيق لعدد الزوار في آخر 24 ساعة، المسجلين الجدد، حركة المشاهدات، والإعلانات النشطة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
          <span className="text-[11px] text-slate-500 font-mono">
            آخر تحديث: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={refreshStats}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-bold"
            title="تحديث فوري للبيانات"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* 2. Top Super-Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* الزوار في 24 ساعة */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-emerald-500/30 relative overflow-hidden group hover:border-emerald-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">الزوار (آخر 24 ساعة)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            <span>{stats.visitorsLast24Hours.toLocaleString()}</span>
            <span className="text-xs font-sans font-bold text-emerald-400">زائر</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>المشاهدات: <strong className="text-slate-200 font-mono">{stats.pageViewsLast24Hours}</strong></span>
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> نشط
            </span>
          </div>
        </div>

        {/* إجمالي الزوار والمشاهدات */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">إجمالي الزوار التراكمي</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            <span>{stats.totalUniqueVisitors.toLocaleString()}</span>
            <span className="text-xs font-sans font-bold text-teal-400">فريد</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            إجمالي المشاهدات: <strong className="text-slate-200 font-mono">{stats.totalPageViews.toLocaleString()}</strong>
          </div>
        </div>

        {/* المستخدمين المسجلين */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-blue-500/30 hover:border-blue-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">إجمالي المسجلين</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            <span>{stats.registeredUsersCount.toLocaleString()}</span>
            <span className="text-xs font-sans font-bold text-blue-400">عضو</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>اليوم: <strong className="text-emerald-400 font-mono">+{stats.signupsToday}</strong></span>
            <span>هذا الأسبوع: <strong className="text-blue-300 font-mono">+{stats.signupsThisWeek}</strong></span>
          </div>
        </div>

        {/* الإعلانات والمحتوى النشط */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">الإعلانات والمقالات</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            <span>{stats.activeCampaignsCount}</span>
            <span className="text-xs font-sans font-bold text-amber-400">إعلان نشط</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>المقالات: <strong className="text-slate-200 font-mono">{stats.totalArticlesCount}</strong></span>
            <span>قراءات المقالات: <strong className="text-amber-300 font-mono">{stats.totalArticleViews.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'الرسوم والمؤشرات البصرية', icon: TrendingUp },
          { id: 'visitors_stream', label: 'سجل الزيارات المباشر (Traffic Log)', icon: Eye, count: stats.recentVisits.length },
          { id: 'signups_log', label: 'سجل المسجلين والاشتراكات', icon: UserPlus, count: users.length - 1 },
          { id: 'content_ads', label: 'أداء المقالات والإعلانات', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Tab 1: Visual Overview & Hourly Charts */}
      {activeSubTab === 'overview' && (
        <div className="space-y-5">
          {/* 24-Hour Traffic Curve (Visual CSS Bar Graph) */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  حركة الزيارات والمشاهدات على مدار الـ 24 ساعة الماضية
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  توزيع تدفق الزوار والمشاهدات خلال فترات اليوم بالساعة.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> المشاهدات
                </span>
                <span className="flex items-center gap-1.5 text-teal-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-400" /> الزوار
                </span>
              </div>
            </div>

            {/* Visual Bars Container */}
            <div className="pt-6 pb-2">
              <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-2 px-1 border-b border-slate-800">
                {stats.hourlyTraffic.map((item, idx) => {
                  const maxView = Math.max(...stats.hourlyTraffic.map((h) => h.views), 20);
                  const viewHeight = Math.max(Math.round((item.views / maxView) * 100), 8);
                  const visitorHeight = Math.max(Math.round((item.visitors / maxView) * 100), 5);

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                      {/* Hover Tooltip */}
                      <div className="absolute -top-10 bg-slate-950 text-white text-[10px] px-2 py-1 rounded-lg border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap">
                        {item.hour}: {item.views} مشاهدة ({item.visitors} زائر)
                      </div>

                      {/* Dual Bars */}
                      <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-36">
                        <div
                          style={{ height: `${viewHeight}%` }}
                          className="w-1/2 rounded-t-sm bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:brightness-125 transition-all"
                        />
                        <div
                          style={{ height: `${visitorHeight}%` }}
                          className="w-1/2 rounded-t-sm bg-gradient-to-t from-teal-600 to-teal-300 group-hover:brightness-125 transition-all"
                        />
                      </div>

                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono truncate w-full text-center">
                        {item.hour}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Devices & User Composition */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device Usage */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-400" />
                توزيع الأجهزة والمتصفحات
              </h4>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-blue-400" /> الجوال (Mobile)
                    </span>
                    <span className="font-mono font-bold text-white">{stats.deviceBreakdown.mobile}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${stats.deviceBreakdown.mobile}%` }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-purple-400" /> الكمبيوتر (Desktop)
                    </span>
                    <span className="font-mono font-bold text-white">{stats.deviceBreakdown.desktop}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${stats.deviceBreakdown.desktop}%` }}
                      className="h-full bg-purple-500 rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Tablet className="w-3.5 h-3.5 text-amber-400" /> الأجهزة اللوحية (Tablet)
                    </span>
                    <span className="font-mono font-bold text-white">{stats.deviceBreakdown.tablet}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${stats.deviceBreakdown.tablet}%` }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Users Breakdown */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                توزيع أدوار المستخدمين المسجلين
              </h4>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 mb-0.5">القُرّاء (Readers)</div>
                  <div className="text-lg font-black text-white font-mono">{readersCount}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 mb-0.5">الكُتّاب (Writers)</div>
                  <div className="text-lg font-black text-emerald-400 font-mono">{writersCount}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 mb-0.5">المعلنون (Advertisers)</div>
                  <div className="text-lg font-black text-amber-400 font-mono">{advertisersCount}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 mb-0.5">حسابات موثقة (Verified)</div>
                  <div className="text-lg font-black text-blue-400 font-mono">{verifiedCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: Live Visitors Stream */}
      {activeSubTab === 'visitors_stream' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              <input
                type="text"
                placeholder="البحث في الصفحة، عنوان IP، أو اسم الزائر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>
              يتم تسجيل كل انتقال بين الصفحات والمقالات لحظياً مع تفاصيل الجهاز والوقت وعنوان الشبكة.
            </span>
          </div>

          <div className="space-y-2">
            {filteredVisits.map((visit) => (
              <div
                key={visit.id}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        visit.isRegistered
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {visit.isRegistered ? `عضو مسجل (${visit.userRole || 'عضو'})` : 'زائر مجهول'}
                    </span>

                    <span className="font-bold text-xs text-white truncate max-w-xs sm:max-w-md">
                      {visit.pageTitle}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2.5 flex-wrap">
                    <span>المسار: {visit.path}</span>
                    <span>•</span>
                    <span>IP: {visit.ipPlaceholder}</span>
                    <span>•</span>
                    <span>المصدر: {visit.referrer}</span>
                  </div>

                  {visit.userName && (
                    <div className="text-[11px] text-emerald-300">
                      اسم المستخدم: <strong>{visit.userName}</strong>
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between text-[11px] text-slate-400 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {visit.device === 'mobile' ? (
                      <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                    ) : visit.device === 'tablet' ? (
                      <Tablet className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Monitor className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span>{visit.browser}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatTimeAgo(visit.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Tab 3: Signups Log & New Users */}
      {activeSubTab === 'signups_log' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              <input
                type="text"
                placeholder="البحث في المسجلين بالاسم، البريد، أو المعرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            {filteredSignups.map((user) => (
              <div
                key={user.id}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={user.fullName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-white truncate">{user.fullName}</span>
                      {user.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono uppercase ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300'
                            : user.role === 'writer'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : user.role === 'advertiser'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                      <span>@{user.username}</span>
                      <span>•</span>
                      <span>{user.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between text-xs text-slate-400 shrink-0">
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    انضم: {user.createdAt ? formatTimeAgo(user.createdAt) : 'عضو مسجل'}
                  </span>
                  {onSelectUser && (
                    <button
                      onClick={() => onSelectUser(user)}
                      className="mt-1 text-[11px] text-blue-400 hover:underline font-bold"
                    >
                      معاينة الحساب ←
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Tab 4: Content & Ads Breakdown */}
      {activeSubTab === 'content_ads' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">إجمالي المقالات المنشورة</div>
              <div className="text-2xl font-black text-white font-mono mt-1">{articles.length}</div>
              <div className="text-[11px] text-emerald-400 mt-1">
                {stats.lockedArticlesCount} مقال حصري مدفوع
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">إجمالي قراءات المقالات</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {stats.totalArticleViews.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                متوسط: {Math.round(stats.totalArticleViews / Math.max(articles.length, 1))} قراءة لكل مقال
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">الحملات الإعلانية النشطة</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                {stats.activeCampaignsCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                من إجمالي {campaigns.length} حملة
              </div>
            </div>
          </div>

          {/* Top Articles by Views */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              المقالات الأكثر قراءة ومشاهدة على المنصة
            </h4>

            <div className="space-y-2">
              {[...articles]
                .sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0))
                .slice(0, 6)
                .map((art) => (
                  <div
                    key={art.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate">{art.title}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>الكاتب: {art.author.fullName}</span>
                        <span>•</span>
                        <span>{art.category}</span>
                        {art.isLocked && (
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            <Lock className="w-3 h-3" /> حصري ${art.price}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {art.viewsCount?.toLocaleString() || 0} قراءة
                      </div>
                      {onSelectArticle && (
                        <button
                          onClick={() => onSelectArticle(art)}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          معاينة
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
