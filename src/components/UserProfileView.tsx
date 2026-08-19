import React, { useState } from 'react';
import {
  User as UserIcon,
  Rocket,
  Wallet,
  ShieldCheck,
  Award,
  BookOpen,
  Bookmark,
  Settings,
  Flame,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  Globe,
  Bell,
  PenTool,
  Users,
  Megaphone,
  HelpCircle,
  LogOut,
  Crown,
  Zap,
  Sparkles,
  Clock,
  CheckCircle,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Sliders,
  Plus,
  Trash2,
  Edit3,
  BarChart3,
  DollarSign,
  Eye,
  Heart,
  Share2,
  FileText,
  AlertCircle,
  Building,
  Target,
  MousePointerClick
} from 'lucide-react';
import { User, Article, UserRole, AdCampaign, LanguageCode, ArticlePromotion } from '../types';
import { SocialLinksEditor } from './SocialLinksEditor';
import { REVENUE_SHARES } from '../constants/revenueShares';
import {
  getRemainingAiUses,
  formatAiExpiryDate,
  getDaysRemaining,
  getPlanMeta
} from '../utils/aiQuota';

interface UserProfileViewProps {
  currentUser: User;
  articles: Article[];
  bookmarkedArticleIds: string[];
  campaigns?: AdCampaign[];
  onSelectArticle: (article: Article) => void;
  onOpenWallet: () => void;
  onOpenKyc: () => void;
  onOpenBeta20: () => void;
  onOpenPolicies: () => void;
  onOpenArticleEditor: () => void;
  onOpenSubscription?: () => void;
  onSwitchUserRole: (newRole: UserRole) => void;
  onDeleteArticle?: (articleId: string) => void;
  onEditArticle?: (article: Article) => void;
  onPromoteArticle?: (article: Article) => void;
  promotions?: ArticlePromotion[];
  onSaveSocialLinks?: (links: Record<string, string>) => Promise<void> | void;
  onOpenNewCampaign?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: LanguageCode;
  onToggleLanguage: () => void;
  onLogout: () => void;
  // Lets a parent (the bottom nav) pick which writer sub-tab shows —
  // optional, falls back to internal state so this still works standalone.
  initialWriterTab?: 'articles' | 'stats_earnings' | 'literary_profile' | 'ai_tools';
  onWriterTabChange?: (tab: 'articles' | 'stats_earnings' | 'literary_profile' | 'ai_tools') => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  articles = [],
  bookmarkedArticleIds = [],
  campaigns = [],
  onSelectArticle,
  onOpenWallet,
  onOpenKyc,
  onOpenBeta20,
  onOpenPolicies,
  onOpenArticleEditor,
  onOpenSubscription,
  onSwitchUserRole,
  onDeleteArticle,
  onEditArticle,
  onPromoteArticle,
  promotions = [],
  onSaveSocialLinks,
  onOpenNewCampaign,
  theme,
  onToggleTheme,
  language,
  onToggleLanguage,
  onLogout,
  initialWriterTab,
  onWriterTabChange
}) => {
  const safeArticles = Array.isArray(articles) ? articles : [];
  const safeBookmarkedIds = Array.isArray(bookmarkedArticleIds) ? bookmarkedArticleIds : [];
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];

  // Common Active Tab state
  const [readerTab, setReaderTab] = useState<'bookmarks' | 'history' | 'campaigns' | 'following' | 'quota_wallet' | 'settings'>('bookmarks');
  const [internalWriterTab, setInternalWriterTab] = useState<'articles' | 'stats_earnings' | 'literary_profile' | 'ai_tools'>('articles');
  // Controlled-if-provided: the bottom nav's "مقالاتي" / "الأرباح" buttons
  // drive this when a parent supplies initialWriterTab/onWriterTabChange;
  // otherwise this screen manages its own tab like before.
  const writerTab = initialWriterTab ?? internalWriterTab;
  const setWriterTab = onWriterTabChange ?? setInternalWriterTab;
  const [writerArticleSubTab, setWriterArticleSubTab] = useState<'published' | 'drafts'>('published');
  const [advertiserTab, setAdvertiserTab] = useState<'campaigns' | 'performance' | 'create_ad' | 'billing'>('campaigns');

  // Drafts stored locally
  const savedDraft = JSON.parse(localStorage.getItem('literium_article_editor_draft') || '{}');
  const hasDraft = Boolean(savedDraft.title || savedDraft.content);

  // AI Quota computation
  const quotaStats = getRemainingAiUses(currentUser.aiQuota);
  const planMeta = getPlanMeta(currentUser.aiQuota?.plan);
  const expiryFormatted = currentUser.aiQuota?.planExpiresAt
    ? formatAiExpiryDate(currentUser.aiQuota.planExpiresAt)
    : null;
  const daysRemaining = currentUser.aiQuota?.planExpiresAt
    ? getDaysRemaining(currentUser.aiQuota.planExpiresAt)
    : 0;

  // Filter user's articles and bookmarks
  const myAllArticles = safeArticles.filter((a) => a.writerId === currentUser.id);
  const myPublishedArticles = myAllArticles.filter((a) => a.status === 'published' || !a.status);
  const myDraftArticles = myAllArticles.filter((a) => a.status === 'draft');
  const bookmarkedArticles = safeArticles.filter((a) => safeBookmarkedIds.includes(a.id));
  const totalMyViews = myPublishedArticles.reduce((sum, a) => sum + (a.viewsCount || 0), 0);
  const totalMyLikes = myAllArticles.reduce((sum, a) => sum + (a.likesCount || 0), 0);
  const totalRatingsCount = myPublishedArticles.reduce((sum, a) => sum + (a.ratingsCount || 0), 0);
  const weightedRatingSum = myPublishedArticles.reduce((sum, a) => sum + ((a.rating || 5.0) * (a.ratingsCount || 1)), 0);
  const avgRating = myPublishedArticles.length > 0
    ? (weightedRatingSum / Math.max(1, totalRatingsCount || myPublishedArticles.length)).toFixed(1)
    : '5.0';

  // Reading history from actual user activity or empty
  const readingHistory: Array<Article & { progress: number; readAt: string }> = [];

  // Advertiser specific metrics
  const myCampaigns = safeCampaigns.filter((c) => c.advertiserId === currentUser.id || c.advertiserName.includes(currentUser.companyName || currentUser.fullName));
  const totalImpressions = myCampaigns.reduce((sum, c) => sum + c.impressionsCount, 0);
  const totalClicks = myCampaigns.reduce((sum, c) => sum + c.clicksCount, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  // Quota bar calculations
  const totalLimit = quotaStats.limit || 5;
  const usedCount = quotaStats.usedToday || 0;
  const usedPercentage = quotaStats.isUnlimited
    ? 0
    : Math.min(100, Math.round((usedCount / totalLimit) * 100));

  return (
    <div className="space-y-6 animate-android-in pb-24 max-w-6xl mx-auto">
      {/* Top Main Identity Banner Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-sm relative overflow-hidden">
        {/* Ambient Gradient Glow depending on role */}
        <div
          className={`absolute top-0 end-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 ${
            currentUser.role === 'writer'
              ? 'bg-teal-500'
              : currentUser.role === 'advertiser'
              ? 'bg-cyan-500'
              : 'bg-purple-500'
          }`}
        />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5">
          {/* Avatar and Main Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-start">
            <div className="relative">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                referrerPolicy="no-referrer"
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover shadow-md ring-4 ${
                  currentUser.role === 'writer'
                    ? 'ring-teal-500/20'
                    : currentUser.role === 'advertiser'
                    ? 'ring-cyan-500/20'
                    : 'ring-purple-500/20'
                }`}
              />
              {currentUser.isVerified && (
                <div className="absolute -bottom-1 -end-1 bg-teal-600 text-white rounded-full p-1 shadow-sm ring-2 ring-white dark:ring-slate-900">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              {quotaStats.isSubscriber && (
                <div className="absolute -top-2 -start-2 bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 rounded-full p-1.5 shadow-md ring-2 ring-white dark:ring-slate-900">
                  <Crown className="w-4 h-4 text-slate-950 stroke-[3]" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{currentUser.penName || currentUser.companyName || currentUser.fullName}</span>
                  {currentUser.role === 'writer' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-500/30 flex items-center gap-1">
                      <PenTool className="w-3 h-3" />
                      <span>كاتب شريك</span>
                    </span>
                  )}
                  {currentUser.role === 'advertiser' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                      <Megaphone className="w-3 h-3" />
                      <span>حساب معلن</span>
                    </span>
                  )}
                  {currentUser.role === 'reader' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      <span>قارئ معتمد</span>
                    </span>
                  )}
                </h2>
              </div>

              <p className="text-xs text-slate-400 font-mono">
                @{currentUser.username} {currentUser.email && `• ${currentUser.email}`}
              </p>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                {currentUser.bio || 'مرحباً بك في ليتيريوم! استمتع بأفضل تجربة أدبية وثقافية متكاملة.'}
              </p>

              {/* Writer Specialties or Advertiser Category */}
              {currentUser.role === 'writer' && currentUser.specialties && currentUser.specialties.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                  {currentUser.specialties.map((spec, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Role Badge — role is set once at registration and is no
              longer casually switchable. This closes a security/UX gap where
              any signed-in user could instantly flip between reader/writer/
              advertiser (or worse) with a single click. */}
          <div className="flex flex-col sm:items-end gap-2.5 shrink-0 w-full sm:w-auto">
            <div
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                currentUser.role === 'writer'
                  ? 'bg-teal-600/10 text-teal-600 dark:text-teal-400 border border-teal-600/20'
                  : currentUser.role === 'advertiser'
                  ? 'bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 border border-cyan-600/20'
                  : currentUser.role === 'admin'
                  ? 'bg-amber-600/10 text-amber-600 dark:text-amber-400 border border-amber-600/20'
                  : 'bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-600/20'
              }`}
            >
              {currentUser.role === 'writer'
                ? 'حساب كاتب'
                : currentUser.role === 'advertiser'
                ? 'حساب معلن'
                : currentUser.role === 'admin'
                ? 'حساب مدير المنصة'
                : 'حساب قارئ ومُعلن'}
            </div>

            <div className="flex items-center gap-2 justify-center sm:justify-end flex-wrap">
              {currentUser.role === 'writer' && (
                <button
                  onClick={onOpenArticleEditor}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>كتابة مقال جديد</span>
                </button>
              )}
              {currentUser.id !== 'guest' && (currentUser.role === 'advertiser' || currentUser.role === 'reader') && (
                <button
                  onClick={onOpenNewCampaign || onOpenWallet}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إنشاء إعلان جديد</span>
                </button>
              )}
              <button
                onClick={onOpenWallet}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-purple-500" />
                <span>المحفظة (${(currentUser.totalEarnings || 0).toFixed(2)})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. READER SPECIFIC VIEW */}
      {/* ========================================================================= */}
      {currentUser.role === 'reader' && (
        <div className="space-y-6">
          {/* Reader Quick Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setReaderTab('bookmarks')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                readerTab === 'bookmarks'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>المقالات المحفوظة ({bookmarkedArticles.length})</span>
            </button>

            <button
              onClick={() => setReaderTab('history')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                readerTab === 'history'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>سجل القراءة والمتابعة</span>
            </button>

            <button
              onClick={() => setReaderTab('campaigns')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                readerTab === 'campaigns'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>إعلاناتي وترويجي ({myCampaigns.length})</span>
            </button>

            <button
              onClick={() => setReaderTab('following')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                readerTab === 'following'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>الكُتّاب المتابعون ({currentUser.followingCount || 4})</span>
            </button>

            <button
              onClick={() => setReaderTab('quota_wallet')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                readerTab === 'quota_wallet'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>الرصيد واستخدامات الذكاء الاصطناعي</span>
            </button>

            <button
              onClick={() => setReaderTab('settings')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                readerTab === 'settings'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>تفضيلات القراءة</span>
            </button>
          </div>

          {/* Reader Tab Contents */}

          {/* A. BOOKMARKS */}
          {readerTab === 'bookmarks' && (
            <div className="space-y-4">
              {bookmarkedArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bookmarkedArticles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => onSelectArticle(art)}
                      className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="aspect-16/9 rounded-2xl overflow-hidden bg-slate-950 relative">
                          <img
                            src={art.featuredImage}
                            alt={art.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-2 end-2 bg-purple-900/90 text-purple-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                            محفوظ
                          </div>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                          {art.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{art.description}</p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{art.writerName}</span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                          <span>متابعة القراءة</span>
                          <span>←</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <Bookmark className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">لم تقم بحفظ أي مقالات بعد</h4>
                  <p className="text-xs text-slate-500 mt-1">اضغط على أيقونة الإشارة المرجعية في المقال لحفظه وقراءته لاحقاً.</p>
                </div>
              )}
            </div>
          )}

          {/* B. READING HISTORY */}
          {readerTab === 'history' && (
            <div className="space-y-3">
              {readingHistory.length > 0 ? (
                readingHistory.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => onSelectArticle(art)}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <img
                        src={art.featuredImage}
                        alt={art.title}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-500/20">
                          {art.readAt}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                          {art.title}
                        </h4>
                        <p className="text-xs text-slate-500">{art.writerName}</p>
                      </div>
                    </div>

                    <div className="w-full sm:w-48 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>نسبة الإنجاز</span>
                        <span className="text-purple-600 dark:text-purple-400">{art.progress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-teal-400 rounded-full transition-all"
                          style={{ width: `${art.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">لا يوجد سجل قراءة بعد</h4>
                  <p className="text-xs text-slate-500 mt-1">المقالات التي تطلع عليها ستظهر هنا لمتابعة تقدمك في القراءة.</p>
                </div>
              )}
            </div>
          )}

          {/* C. READER CAMPAIGNS & PROMOTIONS */}
          {readerTab === 'campaigns' && (
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-extrabold text-base text-white flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-cyan-400" />
                    <span>إعلاناتي وترويجي في المنصة</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    يمكنك كقارئ أو كاتب إنشاء حملات إعلانية مباشرة والترويج لمشروعك أمام مجتمع ليتيريوم.
                  </p>
                </div>
                <button
                  onClick={onOpenNewCampaign || onOpenWallet}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء حملة جديدة</span>
                </button>
              </div>

              {myCampaigns.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCampaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {camp.title}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          camp.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                        }`}>
                          {camp.status === 'active' ? 'نشطة الآن' : 'منتهية'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{camp.description}</p>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span>المشاهدات: {camp.impressionsCount.toLocaleString()}</span>
                        <span>النقرات: {camp.clicksCount.toLocaleString()}</span>
                        <span>الميزانية: {camp.budget}$</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <Megaphone className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">لا توجد حملات إعلانية نشطة حالياً</h4>
                  <p className="text-xs text-slate-400">ابدأ حملتك الأولى للوصول لآلاف المهتمين بالأدب والتقنية</p>
                </div>
              )}
            </div>
          )}

          {/* D. FOLLOWING AUTHORS */}
          {readerTab === 'following' && (
            <div className="text-center py-12 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">لم تقم بمتابعة أي كُتّاب بعد</h4>
              <p className="text-xs text-slate-500 mt-1">تصفح المقالات وتابع كُتّابك المفضلين ليصلك جديدهم أولاً بأول.</p>
            </div>
          )}

          {/* E. AI QUOTA & WALLET */}
          {readerTab === 'quota_wallet' && (
            <div className="space-y-6">
              {/* AI Quota Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-900/30 via-slate-900 to-slate-900 border border-purple-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-white">رصيد واستخدامات الذكاء الاصطناعي (Gemini)</h4>
                      <p className="text-xs text-slate-400">10 استخدامات يومية مجانية تتجدد كل 24 ساعة</p>
                    </div>
                  </div>
                  <button
                    onClick={onOpenSubscription}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>ترقية إلى VIP غير محدود</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-300">
                    <span>الاستخدام اليومي: {quotaStats.usedToday} من {quotaStats.limit || 5}</span>
                    <span className="text-purple-400">{quotaStats.remaining} متبقية اليوم</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-teal-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (quotaStats.usedToday / (quotaStats.limit || 5)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Wallet Summary */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">رصيد المحفظة المتاح للشراء والترويج</span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                      ${(currentUser.totalEarnings || 0).toFixed(2)}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={onOpenWallet}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                  >
                    شحن الرصيد / إدارة المحفظة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* F. READING PREFERENCES */}
          {readerTab === 'settings' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">تفضيلات القراءة والعرض</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    {theme === 'dark' ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">المظهر العام (داكن / فاتح)</span>
                  </div>
                  <button
                    onClick={onToggleTheme}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold"
                  >
                    {theme === 'dark' ? 'الوضع الليلي 🌙' : 'الوضع النهاري ☀️'}
                  </button>
                </div>

                {/* ⚠️ خيار اللغة مُخفى مؤقتاً — الترجمة غير مكتملة في الواجهة */}
              </div>

              {onSaveSocialLinks && (
                <div className="-mx-6 -mb-6 mt-2">
                  <SocialLinksEditor currentUser={currentUser} onSave={onSaveSocialLinks} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WRITER SPECIFIC VIEW */}
      {/* ========================================================================= */}
      {currentUser.role === 'writer' && (
        <div className="space-y-6">
          {/* Writer 4 KPI Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">إجمالي المشاهدات</span>
                <Eye className="w-4 h-4 text-teal-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {(totalMyViews || 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-teal-600 font-bold mt-1">
                {myPublishedArticles.length > 0
                  ? `بمعدل ${Math.round(totalMyViews / myPublishedArticles.length)} قراءة لكل مقال`
                  : 'مشاهدات موثقة من القرّاء'}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">الأرباح التراكمية</span>
                <DollarSign className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                ${(currentUser.totalEarnings || 0).toFixed(2)}
              </h3>
              <p className="text-[11px] text-amber-600 font-bold mt-1">
                {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% إعلانات + {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% مبيعات
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">المقالات المنشورة</span>
                <FileText className="w-4 h-4 text-purple-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {myPublishedArticles.length}
              </h3>
              <p className="text-[11px] text-purple-600 font-bold mt-1">
                {myDraftArticles.length + (hasDraft ? 1 : 0) > 0 ? `${myDraftArticles.length + (hasDraft ? 1 : 0)} مسودة جاهزة للنشر` : 'جاهزة للجمهور'}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">متوسط التقييم</span>
                <Award className="w-4 h-4 text-rose-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {avgRating} ★
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                {totalRatingsCount > 0 ? `من ${totalRatingsCount.toLocaleString()} تقييم موثق` : 'تقييم افتتاحي للمؤلف'}
              </p>
            </div>
          </div>

          {/* Writer Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setWriterTab('articles')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                writerTab === 'articles'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>إدارة المقالات (المنشورة والمسودات)</span>
            </button>

            <button
              onClick={() => setWriterTab('stats_earnings')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                writerTab === 'stats_earnings'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>سحب الأرباح والتقارير المالية</span>
            </button>

            <button
              onClick={() => setWriterTab('literary_profile')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                writerTab === 'literary_profile'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span>إعدادات الملف الأدبي والتوثيق</span>
            </button>
          </div>

          {/* Writer Tab 1: Articles & Drafts */}
          {writerTab === 'articles' && (
            <div className="space-y-4">
              {/* Sub-tabs for published vs drafts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWriterArticleSubTab('published')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      writerArticleSubTab === 'published'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    المقالات المنشورة ({myPublishedArticles.length})
                  </button>
                  <button
                    onClick={() => setWriterArticleSubTab('drafts')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      writerArticleSubTab === 'drafts'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>المسودات ({myDraftArticles.length + (hasDraft ? 1 : 0)})</span>
                    {hasDraft && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  </button>
                </div>

                <button
                  onClick={onOpenArticleEditor}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>مقال جديد</span>
                </button>
              </div>

              {writerArticleSubTab === 'published' ? (
                <div className="space-y-3">
                  {myPublishedArticles.length === 0 ? (
                    <div className="text-center py-10 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-400 mb-2">لم تقم بنشر أي مقالات بعد.</p>
                      <button
                        onClick={onOpenArticleEditor}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold"
                      >
                        ابدأ كتابة أول مقال
                      </button>
                    </div>
                  ) : (
                    myPublishedArticles.map((art) => (
                      <div
                        key={art.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <img
                            src={art.featuredImage || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80'}
                            alt={art.title}
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 rounded-xl object-cover shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {art.category}
                              </span>
                              {art.isLocked && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                                  مقفول ({art.lockedPrice}$)
                                </span>
                              )}
                            </div>
                            <h4
                              onClick={() => onSelectArticle(art)}
                              className="font-bold text-sm text-slate-900 dark:text-white hover:text-teal-600 cursor-pointer line-clamp-1"
                            >
                              {art.title}
                            </h4>
                            <p className="text-xs text-slate-400">نُشر في: {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString('ar-EG') : 'الآن'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                          <div className="text-xs text-slate-500 text-end">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{(art.viewsCount || 0).toLocaleString()}</span> مشاهدة
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const p = promotions.find((pr) => pr.articleId === art.id && pr.status !== 'rejected' && pr.status !== 'expired');
                              if (!p) return null;
                              return (
                                <span
                                  className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                    p.status === 'pending'
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {p.status === 'pending' ? 'ترويج بانتظار المراجعة' : 'ترويج معتمد'}
                                </span>
                              );
                            })()}
                            {onPromoteArticle && (
                              <button
                                onClick={() => onPromoteArticle(art)}
                                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 hover:text-white text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors"
                                title="ترويج المقال في الصفحة الرئيسية"
                              >
                                <Rocket className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">ترويج</span>
                              </button>
                            )}
                            <button
                              onClick={() => onEditArticle ? onEditArticle(art) : onOpenArticleEditor()}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-500 hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors"
                              title="تعديل المقال"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteArticle && onDeleteArticle(art.id)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {myDraftArticles.map((art) => (
                    <div
                      key={art.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={art.featuredImage || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80'}
                          alt={art.title}
                          className="w-14 h-14 rounded-xl object-cover"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                              مسودة في السحابة
                            </span>
                            <span className="text-xs text-slate-400">{art.category}</span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                            {art.title || 'مسودة بدون عنوان'}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1">{art.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEditArticle ? onEditArticle(art) : onOpenArticleEditor()}
                          className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                        >
                          متابعة التحرير والنشر
                        </button>
                        {onDeleteArticle && (
                          <button
                            onClick={() => onDeleteArticle(art.id)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300"
                            title="حذف المسودة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {hasDraft && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          مسودة محلية غير محفوظة
                        </span>
                        <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1">
                          {savedDraft.title || 'مسودة مقال أدبي بدون عنوان'}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1">{savedDraft.description || 'اضغط لمتابعة التحرير والنشر'}</p>
                      </div>
                      <button
                        onClick={onOpenArticleEditor}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm active:scale-95"
                      >
                        متابعة الكتابة والنشر
                      </button>
                    </div>
                  )}

                  {myDraftArticles.length === 0 && !hasDraft && (
                    <div className="text-center py-10 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-400">لا توجد مسودات معلقة حالياً.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Writer Tab 2: Earnings & Withdrawals */}
          {writerTab === 'stats_earnings' && (
            <div className="space-y-5">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-teal-400">الرصيد المتاح للسحب الفوري</span>
                  <h3 className="text-3xl font-black text-white mt-1">${(currentUser.totalEarnings || 0).toFixed(2)}</h3>
                  <p className="text-xs text-slate-400 mt-1">الحد الأدنى للسحب: 10$ • السحب عبر: USDT، PayPal، Stripe، الحساب البنكي</p>
                </div>
                <button
                  onClick={onOpenWallet}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-teal-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>طلب سحب الأرباح الآن</span>
                </button>
              </div>

              {/* Earnings breakdown table — computed from this writer's own
                  articles rather than fixed placeholder figures. */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">تفاصيل ومصادر الأرباح</h4>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">عائد الإعلانات داخل المقالات (حصة الكاتب)</span>
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                      ${myAllArticles.reduce((sum, a) => sum + (a.revenueFromAds || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      مبيعات المقالات المقفولة (حصة الكاتب {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%)
                    </span>
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                      ${myAllArticles.reduce((sum, a) => sum + (a.revenueFromSales || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Writer Tab 3: Literary Profile Settings */}
          {writerTab === 'literary_profile' && (
            <>
            {onSaveSocialLinks && (
              <SocialLinksEditor currentUser={currentUser} onSave={onSaveSocialLinks} />
            )}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">الملف الأدبي وتوثيق الهوية</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الأدبي (Pen Name)</label>
                  <input
                    type="text"
                    defaultValue={currentUser.penName || currentUser.fullName}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">حالة توثيق الكاتب (KYC)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onOpenKyc}
                      className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold"
                    >
                      {currentUser.isKycVerified ? 'الهوية موثقة ✓' : 'تقديم وثائق التوثيق'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ADVERTISER SPECIFIC VIEW */}
      {/* ========================================================================= */}
      {currentUser.role === 'advertiser' && (
        <div className="space-y-6">
          {/* Advertiser 4 KPI Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">الحملات النشطة</span>
                <Megaphone className="w-4 h-4 text-cyan-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {myCampaigns.length}
              </h3>
              <p className="text-[11px] text-cyan-600 font-bold mt-1">تصل للقراء الآن</p>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">مرات الظهور (Impressions)</span>
                <Eye className="w-4 h-4 text-purple-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {totalImpressions.toLocaleString()}
              </h3>
              <p className="text-[11px] text-purple-600 font-bold mt-1">ظهور مؤكد في المقالات</p>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">إجمالي النقرات (Clicks)</span>
                <MousePointerClick className="w-4 h-4 text-teal-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {totalClicks.toLocaleString()}
              </h3>
              <p className="text-[11px] text-teal-600 font-bold mt-1">معدل التحويل (CTR): {avgCtr}%</p>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">رصيد الإعلانات المتاح</span>
                <DollarSign className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                ${(currentUser.totalEarnings || 0).toFixed(2)}
              </h3>
              <p className="text-[11px] text-amber-600 font-bold mt-1">جاهز لتمويل الحملات</p>
            </div>
          </div>

          {/* Advertiser Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setAdvertiserTab('campaigns')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                advertiserTab === 'campaigns'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>الحملات الإعلانية الحالية ({myCampaigns.length})</span>
            </button>

            <button
              onClick={() => setAdvertiserTab('create_ad')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                advertiserTab === 'create_ad'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء حملة إعلانية جديدة</span>
            </button>

            <button
              onClick={() => setAdvertiserTab('billing')}
              className={`pb-3 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                advertiserTab === 'billing'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>الرصيد وطرق الدفع والشحن</span>
            </button>
          </div>

          {/* Advertiser Tab 1: Current Campaigns */}
          {advertiserTab === 'campaigns' && (
            <div className="space-y-3">
              {(myCampaigns.length > 0 ? myCampaigns : [
                {
                  id: 'camp_1',
                  title: 'إعلان منصة مدار للكتب الرقمية',
                  advertiserName: currentUser.companyName || 'شركة أفق للحلول الرقمية',
                  bannerUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1200&auto=format&fit=crop&q=80',
                  targetUrl: 'https://example.com/books',
                  targetCategory: 'literature',
                  status: 'active' as const,
                  budget: 150,
                  impressionsCount: 84200,
                  clicksCount: 2610,
                  durationHours: 72,
                  createdAt: '2026-03-10'
                },
                {
                  id: 'camp_2',
                  title: 'خدمات الاستضافة السحابية للمؤلفين',
                  advertiserName: currentUser.companyName || 'شركة أفق للحلول الرقمية',
                  bannerUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
                  targetUrl: 'https://example.com/cloud',
                  targetCategory: 'technology',
                  status: 'active' as const,
                  budget: 90,
                  impressionsCount: 40300,
                  clicksCount: 1210,
                  durationHours: 48,
                  createdAt: '2026-03-12'
                }
              ]).map((camp) => (
                <div
                  key={camp.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <img
                      src={camp.bannerUrl}
                      alt={camp.title}
                      referrerPolicy="no-referrer"
                      className="w-24 h-16 rounded-2xl object-cover shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          نشطة • {camp.durationHours} ساعة
                        </span>
                        <span className="text-xs text-slate-400 font-mono">الميزانية: ${camp.budget}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{camp.title}</h4>
                      <p className="text-xs text-cyan-600 dark:text-cyan-400">{camp.targetUrl}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="text-center">
                      <span className="text-[11px] text-slate-400 block">الظهور</span>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                        {camp.impressionsCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[11px] text-slate-400 block">النقرات</span>
                      <span className="font-extrabold text-xs text-teal-600 dark:text-teal-400">
                        {camp.clicksCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[11px] text-slate-400 block">معدل النقر CTR</span>
                      <span className="font-extrabold text-xs text-cyan-600 dark:text-cyan-400">
                        {((camp.clicksCount / (camp.impressionsCount || 1)) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Advertiser Tab 2: Create Ad */}
          {advertiserTab === 'create_ad' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-black text-base text-slate-900 dark:text-white">إطلاق حملة إعلانية مخصصة</h4>
              <p className="text-xs text-slate-500">اختر نوع الحملة والجمهور المستهدف لظهور إعلانك فوراً في المنصة.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان الإعلان</label>
                  <input
                    type="text"
                    placeholder="مثال: خصم 50% على أحدث الروايات والكتب"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رابط الوجهة (URL)</label>
                  <input
                    type="url"
                    placeholder="https://yourbrand.com/landing"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>
              <button
                onClick={onOpenWallet}
                className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md transition-all mt-2"
              >
                تأكيد وتمويل الحملة من الرصيد
              </button>
            </div>
          )}

          {/* Advertiser Tab 3: Billing */}
          {advertiserTab === 'billing' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">طرق الدفع وشحن الحساب المعلن</h4>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">الرصيد المالي المتاح للحملات</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">$180.00</h3>
                </div>
                <button
                  onClick={onOpenWallet}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                >
                  إيداع رصيد جديد
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logout Row */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={onLogout}
          className="px-6 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 border border-rose-200 dark:border-rose-900/40 transition-all active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج من الحساب</span>
        </button>
      </div>
    </div>
  );
};
