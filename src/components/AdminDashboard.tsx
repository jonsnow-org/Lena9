import React, { useState } from 'react';
import {
  Rocket,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  ArrowUpRight,
  Sparkles,
  Settings,
  RefreshCw,
  Search,
  Lock,
  Unlock,
  BadgePercent,
  Layers,
  Activity,
  UserCheck,
  Ban
} from 'lucide-react';
import { User, Article, AdCampaign, FraudFlag, Transaction, Wallet, ArticlePromotion } from '../types';
import { evaluateAdEventBatch, calculateEventCost } from '../utils/fraudFilters';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  articles: Article[];
  campaigns: AdCampaign[];
  fraudFlags: FraudFlag[];
  transactions: Transaction[];
  platformBalance?: number;
  onUpdateUserRole?: (userId: string, newRole: User['role']) => void;
  onToggleUserVerified?: (userId: string) => void;
  onApproveKyc?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
  onUpdateCampaignStatus?: (campaignId: string, status: AdCampaign['status']) => void;
  onUpdateArticleStatus?: (articleId: string, status: Article['status']) => void;
  onResolveFraudFlag?: (flagId: string, action: 'resolved' | 'dismissed') => void;
  onApprovePayout?: (transactionId: string) => void;
  onSelectArticle?: (article: Article) => void;
  onSelectUser?: (user: User) => void;
  // Lets a parent (the bottom nav) drive which internal tab is shown.
  // Optional — the component still manages its own tab state if these
  // aren't supplied, so it keeps working when used standalone.
  activeTab?: 'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'finance' | 'promotions' | 'money' | 'accounting' | 'settings';
  onActiveTabChange?: (tab: 'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'finance' | 'promotions' | 'money' | 'accounting' | 'settings') => void;
  promotions?: ArticlePromotion[];
  onUpdatePromotionStatus?: (promotionId: string, status: 'approved' | 'rejected') => void;
  depositRequests?: any[];
  payoutRequests?: any[];
  purchaseRequests?: any[];
  adEvents?: any[];
  onProcessAdEvents?: () => void;
  onAdjustBalance?: (
    userId: string,
    field: 'walletBalance' | 'availableBalance' | 'pendingEarnings' | 'lifetimeEarnings',
    amount: number,
    reason: string
  ) => void;
  onUpdatePurchaseRequest?: (requestId: string, status: 'approved' | 'rejected') => void;
  onUpdateMoneyRequest?: (
    collectionName: 'depositRequests' | 'payoutRequests',
    requestId: string,
    status: 'approved' | 'rejected' | 'paid'
  ) => void;
  // الأرباح الفردية المجمّدة (لكل مقال/حملة)، تحمل موعد استحقاق تحريرها
  // بعد 30 يوماً من التسجيل — كانت هذه البيانات تُحسب وتُخزَّن فعلياً من
  // قبل لكن لا توجد أي واجهة لرؤيتها أو تحريرها، فتبقى الأرباح مجمّدة
  // للأبد فعلياً رغم انقضاء المدة.
  earningsRecords?: {
    id: string;
    userId: string;
    amount: number;
    source: string;
    status: string;
    createdAt: string;
    releasableAt: string;
    description?: string;
  }[];
  onReleaseEarning?: (earning: { id: string; userId: string; amount: number }) => void;
}

type AdjustableBalanceField = 'walletBalance' | 'availableBalance' | 'pendingEarnings' | 'lifetimeEarnings';

const BALANCE_FIELD_LABELS: Record<AdjustableBalanceField, string> = {
  walletBalance: 'رصيد المحفظة',
  availableBalance: 'متاح للسحب',
  pendingEarnings: 'أرباح مجمّدة',
  lifetimeEarnings: 'إجمالي تراكمي'
};

/**
 * أداة تعديل رصيد مستخدم يدوياً من الأدمن — البديل المتعمَّد لأي بوابة
 * دفع آلية (Stripe/PayPal فعلي) التي تتطلب خطة Firebase مدفوعة (Blaze)
 * لتشغيل Cloud Functions بأمان. كل الإيداع والسحب في هذه المنصة يمر عبر
 * طلب يراجعه المالك يدوياً ثم يُطبَّق هنا بضغطة واحدة — يحافظ هذا تماماً
 * على نفس الأسلوب (لا اشتراك مدفوع، لا معالجة تلقائية) الذي بُنيت عليه
 * كل شاشات الإيداع والسحب الأخرى في التطبيق.
 */
// أي تعديل يدوي فوق هذا المبلغ يتطلب تأكيداً ثانياً — حماية من رقم زائد
// يُطبَّق مباشرة على رصيد حقيقي بلا أي فرصة للمراجعة.
const LARGE_ADJUSTMENT_CONFIRM_THRESHOLD = 500;

const BalanceAdjustCell: React.FC<{
  user: User;
  onAdjustBalance?: (userId: string, field: AdjustableBalanceField, amount: number, reason: string) => void;
}> = ({ user, onAdjustBalance }) => {
  const [field, setField] = useState<AdjustableBalanceField>('walletBalance');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const currentValue = Number((user as any)[field] ?? 0);
  const parsedAmount = Number(amountInput);
  const canApply =
    amountInput.trim() !== '' && !Number.isNaN(parsedAmount) && parsedAmount !== 0 && reason.trim() !== '';

  const commit = () => {
    onAdjustBalance?.(user.id, field, parsedAmount, reason.trim());
    setAmountInput('');
    setReason('');
    setConfirming(false);
  };

  const handleApply = () => {
    if (!canApply) return;
    if (Math.abs(parsedAmount) >= LARGE_ADJUSTMENT_CONFIRM_THRESHOLD && !confirming) {
      setConfirming(true);
      return;
    }
    commit();
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[210px]">
      <div className="text-[10px] text-slate-500">
        {BALANCE_FIELD_LABELS[field]}: <span className="font-mono font-bold text-slate-300">${currentValue.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1">
        <select
          value={field}
          onChange={(e) => {
            setField(e.target.value as AdjustableBalanceField);
            setConfirming(false);
          }}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-1.5 py-1 text-[10px] focus:outline-none focus:border-purple-500"
        >
          {(Object.keys(BALANCE_FIELD_LABELS) as AdjustableBalanceField[]).map((f) => (
            <option key={f} value={f}>{BALANCE_FIELD_LABELS[f]}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          value={amountInput}
          onChange={(e) => {
            setAmountInput(e.target.value);
            setConfirming(false);
          }}
          placeholder="± المبلغ"
          title="أدخل رقماً موجباً للإضافة أو سالباً للخصم"
          className="w-20 bg-slate-950 border border-slate-800 text-white rounded-lg px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-purple-500"
        />
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setConfirming(false);
        }}
        placeholder="سبب التعديل (إلزامي — يُسجَّل في سجل التدقيق)"
        className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-1.5 py-1 text-[10px] focus:outline-none focus:border-purple-500"
      />
      {confirming && (
        <p className="text-[10px] text-amber-400 font-bold">
          مبلغ كبير — اضغط "تطبيق" مرة أخرى للتأكيد النهائي.
        </p>
      )}
      <button
        onClick={handleApply}
        disabled={!canApply}
        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold transition-all"
      >
        {confirming ? 'تأكيد نهائي' : 'تطبيق'}
      </button>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  users = [],
  articles = [],
  campaigns = [],
  fraudFlags = [],
  transactions = [],
  onUpdateUserRole,
  onToggleUserVerified,
  onApproveKyc,
  onBanUser,
  onUpdateCampaignStatus,
  onUpdateArticleStatus,
  onResolveFraudFlag,
  onApprovePayout,
  onSelectArticle,
  onSelectUser,
  promotions = [],
  onUpdatePromotionStatus,
  depositRequests = [],
  payoutRequests = [],
  purchaseRequests = [],
  adEvents = [],
  onProcessAdEvents,
  onAdjustBalance,
  onUpdatePurchaseRequest,
  onUpdateMoneyRequest,
  earningsRecords = [],
  onReleaseEarning,
  activeTab: externalActiveTab,
  onActiveTabChange
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<
    'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'finance' | 'settings'
  >('overview');
  // Controlled-if-provided pattern: use the parent's tab + setter when given
  // (so the bottom nav's admin buttons actually drive this screen), fall
  // back to local state otherwise.
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onActiveTabChange ?? setInternalActiveTab;

  const [fraudFilter, setFraudFilter] = useState<string>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState<string>('');
  const [articleFilter, setArticleFilter] = useState<string>('all');
  const [platformAdsEnabled, setPlatformAdsEnabled] = useState<boolean>(true);

  // Financial Metrics Calculation strictly from real Firestore data
  const totalPlatformAdRevenue = campaigns
    .filter((c) => c.placementType === 'platform' || c.type === 'fixed')
    .reduce((acc, c) => acc + (c.totalSpent || 0), 0);

  const totalWriterAdRevenue = campaigns
    .filter((c) => c.placementType === 'writer' || c.type === 'cpm' || c.type === 'cpc')
    .reduce((acc, c) => acc + (c.totalSpent || 0), 0);

  // In-article writer ads: 45% platform / 55% writer
  const platformAdSenseCut = totalWriterAdRevenue * REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM;
  const writersAdSenseCut = totalWriterAdRevenue * REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;

  const totalLockedArticlesSales = articles
    .filter((a) => a.isLocked)
    .reduce((acc, a) => acc + (a.revenueFromSales || 0), 0);

  // Locked articles sales: 15% platform / 85% writer
  const platformSalesCut = totalLockedArticlesSales * REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM;
  const writersSalesCut = totalLockedArticlesSales * REVENUE_SHARES.LOCKED_ARTICLES.WRITER;

  // Purely computed from actual transactions and campaigns without artificial add-ons
  const netPlatformRevenue = totalPlatformAdRevenue + platformAdSenseCut + platformSalesCut;

  const totalBlockedFraudRevenue = fraudFlags.reduce(
    (acc, f) => acc + (f.revenueBlocked || 0),
    0
  );

  const pendingWithdrawals = transactions.filter(
    (t) => t.type === 'withdrawal' && t.status === 'pending'
  );

  const filteredUsers = users.filter((u) => {
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchSearch =
      userSearch === '' ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    return matchRole && matchSearch;
  });

  const filteredFraudFlags = fraudFlags.filter((f) => {
    if (fraudFilter === 'all') return true;
    if (fraudFilter === 'high_critical') return f.severity === 'high' || f.severity === 'critical';
    if (fraudFilter === 'self_click') return f.triggerType === 'self_click';
    if (fraudFilter === 'cpc') return f.pricingModel === 'cpc';
    if (fraudFilter === 'cpm') return f.pricingModel === 'cpm';
    return true;
  });

  // دفاع محلي إضافي — بجانب قواعد أمان Firestore التي تبقى خط الدفاع
  // الحقيقي الذي يرفض أي كتابة فعلية من غير الأدمن — لا تُعرض أدوات
  // الإدارة إطلاقاً لغير الأدمن حتى لو وصل هذا المكوّن للعرض بطريق غير
  // متوقع (حالة عالقة، رابط مباشر، ...)، بدل الاعتماد على القواعد وحدها
  // وترك المستخدم يرى كل الأزرار ثم يفاجَأ برفض كل نقرة.
  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">غير مصرّح بالدخول</h2>
          <p className="text-sm text-slate-400">
            هذه اللوحة مخصصة لحسابات الإدارة فقط.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Admin Header Bar */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/20 px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  لوحة الإدارة المركزية والمالك
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  صلاحيات كاملة 🛡️
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                مرحباً {currentUser.fullName} • مراقبة النزاهة الإعلانية، الحوكمة المالية، ومكافحة الاحتيال
              </p>
            </div>
          </div>

          {/* Quick Realtime Shield Status */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 border border-purple-500/20 rounded-2xl p-2.5 px-4 shadow-inner">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-300 font-medium">درع مكافحة الاحتيال:</span>
              <span className="text-emerald-400 font-bold">نشط بنسبة 99.8%</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="text-xs text-slate-300">
              أموال محجوبة ومحمية: <span className="font-bold text-amber-400 font-mono">${totalBlockedFraudRevenue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-6 flex overflow-x-auto gap-2 scrollbar-none pb-1">
          {[
            { id: 'overview', label: 'نظرة عامة والمالية', icon: TrendingUp },
            { id: 'fraud', label: 'فحص الاحتيال والأمان', icon: ShieldCheck, badge: fraudFlags.length },
            { id: 'campaigns', label: 'إدارة الحملات والإعلانات', icon: Megaphone, badge: campaigns.length },
            { id: 'moderation', label: 'حوكمة المحتوى والمقالات', icon: FileText, badge: articles.length },
            { id: 'users', label: 'إدارة المستخدمين وKYC', icon: Users, badge: users.length },
            { id: 'finance', label: 'طلبات السحب والفوترة', icon: DollarSign, badge: pendingWithdrawals.length },
            { id: 'promotions', label: 'طلبات ترويج المقالات', icon: Rocket, badge: promotions.filter((p) => p.status === 'pending').length },
            { id: 'money', label: 'الإيداع والسحب', icon: DollarSign, badge: [...depositRequests, ...payoutRequests, ...purchaseRequests].filter((r) => r.status === 'pending').length },
            { id: 'accounting', label: 'احتساب أرباح الإعلانات', icon: TrendingUp, badge: adEvents.filter((e) => !e.processed).length },
            { id: 'settings', label: 'إعدادات المنظومة', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-purple-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        {/* ============================================================ */}
        {/* TAB 1: OVERVIEW & FINANCIALS */}
        {/* ============================================================ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-purple-950/40 border border-purple-500/20 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">إجمالي دخل المنصة الصافي</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  ${netPlatformRevenue.toFixed(2)}
                </div>
                <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+18.4% نمو شهري</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">إعلانات المنصة العامة (100%)</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Megaphone className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  ${totalPlatformAdRevenue.toFixed(2)}
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  عائدات كاملة لمالك المنصة بدون تقاسم
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">إعلانات الكُتّاب المتقاسمة (55/45)</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <BadgePercent className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  ${platformAdSenseCut.toFixed(2)}
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  حصة المنصة {REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% (وحصل الكُتّاب على ${writersAdSenseCut.toFixed(2)})
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-amber-500/20 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">الاحتيال المحجوب (درع الحماية)</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                  ${totalBlockedFraudRevenue.toFixed(2)}
                </div>
                <div className="mt-2 text-[11px] text-amber-300/80">
                  {fraudFlags.length} محاولات محجوبة آلياً
                </div>
              </div>
            </div>

            {/* Dual System Revenue Architecture Visualizer */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-purple-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  هيكلية النظام الإعلاني المزدوج (Dual Advertising System)
                </h3>
                <span className="text-xs text-purple-300 font-mono bg-purple-950/60 px-3 py-1 rounded-full border border-purple-500/30">
                  Zero Revenue Leakage Guaranteed
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Platform Ads Box */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-950/30 to-slate-900 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      إعلانات المنصة العامة (Platform Ads)
                    </span>
                    <span className="text-xs font-black text-blue-400 font-mono">100% للمالك</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>تظهر في الصفحة الرئيسية وقسم الاستكشاف وقوائم التغذية العامة.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>لا تخضع لمشاركة الأرباح مع أي كاتب، وتذهب إيراداتها كاملة للمنصة.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>تدعم نماذج الحجز الثابت (Fixed Duration) ومساحات الرعاية.</span>
                    </li>
                  </ul>
                  <div className="p-3 rounded-lg bg-slate-900/80 text-xs flex items-center justify-between">
                    <span className="text-slate-400">إجمالي إيراد المنصة من هذا الباب:</span>
                    <span className="font-bold text-white font-mono">${totalPlatformAdRevenue.toFixed(2)}</span>
                  </div>
                </div>

                {/* Writer Ads Box */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-950/30 to-slate-900 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      إعلانات الكُتّاب التشاركية (Writer Ads)
                    </span>
                    <span className="text-xs font-black text-purple-400 font-mono">
                      تقاسم {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% كاتب / {REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% منصة
                    </span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>تظهر داخل مقالات الكاتب (55% للكاتب / 45% للمنصة) وفي صفحته الشخصية (50% / 50%).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>المبيعات للمقالات الحصرية: 85% للكاتب / 15% للمنصة.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>محمية بالكامل بدرع منع النقر الذاتي (Self-Click Shield) وفحص CPM.</span>
                    </li>
                  </ul>
                  <div className="p-3 rounded-lg bg-slate-900/80 text-xs flex items-center justify-between">
                    <span className="text-slate-400">إجمالي المولد للكُتّاب:</span>
                    <span className="font-bold text-emerald-400 font-mono">${writersAdSenseCut.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Live Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Fraud Actions */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    أحدث إنذارات مكافحة الاحتيال
                  </h4>
                  <button
                    onClick={() => setActiveTab('fraud')}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    عرض الكل ({fraudFlags.length})
                  </button>
                </div>

                <div className="space-y-3">
                  {fraudFlags.slice(0, 3).map((flag) => (
                    <div
                      key={flag.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{flag.details}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-mono ${
                              flag.severity === 'high' || flag.severity === 'critical'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {flag.severity}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          IP: {flag.userIp} • {flag.detectedAt}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[11px]">
                        تم الحجب آلياً
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Approvals */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    المهام والإجراءات المعلقة
                  </h4>
                  <span className="text-xs text-slate-400">مراجعة فورية</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">طلبات سحب أرباح الكُتّاب</div>
                      <div className="text-[11px] text-slate-400">
                        {pendingWithdrawals.length} طلبات بانتظار التحويل المالي
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('finance')}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-500 text-xs"
                    >
                      معالجة
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">مراجعة توثيق الهوية (KYC)</div>
                      <div className="text-[11px] text-slate-400">
                        {users.filter((u) => u.kycDetails?.status === 'pending').length} ملفات جاهزة للتدقيق
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500 text-xs"
                    >
                      فحص KYC
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">حملات إعلانية قيد المراجعة</div>
                      <div className="text-[11px] text-slate-400">
                        {campaigns.filter((c) => c.status === 'pending').length} حملات جديدة
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('campaigns')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 text-xs"
                    >
                      مراجعة الحملات
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: ANTI-FRAUD SECURITY CENTER */}
        {/* ============================================================ */}
        {activeTab === 'fraud' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-red-950/30 via-slate-900 to-amber-950/30 border border-red-500/20">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  مركز مراقبة مكافحة الاحتيال وفحص النقرات (Anti-Fraud SOC)
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  حماية تسعير Fixed و CPM و CPC ضد النقر الذاتي والنقرات الآلية وتحديثات الصفحة الخاطفة.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'جميع السجلات' },
                  { id: 'high_critical', label: 'عالي وحرج ⚠️' },
                  { id: 'self_click', label: 'نقر ذاتي (Self-Click)' },
                  { id: 'cpc', label: 'نقرات CPC' },
                  { id: 'cpm', label: 'مشاهدات CPM' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFraudFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      fraudFilter === f.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fraud Table */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">الرقم والتاريخ</th>
                      <th className="p-3.5">نوع الاحتيال والنموذج</th>
                      <th className="p-3.5">المستهدف / المقال / الحملة</th>
                      <th className="p-3.5">المعرف وعنوان IP</th>
                      <th className="p-3.5">الخطورة</th>
                      <th className="p-3.5">المبلغ المحجوب</th>
                      <th className="p-3.5">الإجراء المتخذ</th>
                      <th className="p-3.5 text-center">التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredFraudFlags.map((flag) => (
                      <tr key={flag.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-purple-300">{flag.id}</div>
                          <div className="text-[11px] text-slate-500">{flag.detectedAt}</div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-white">
                            {flag.triggerType === 'self_click' && 'نقر ذاتي من الكاتب'}
                            {flag.triggerType === 'insufficient_dwell' && 'نقر فوري دون مكوث'}
                            {flag.triggerType === 'rapid_refresh' && 'تحديث سريع متكرر'}
                            {flag.triggerType === 'click_throttle' && 'تكرار نقرات محظور'}
                            {flag.triggerType === 'bot_pattern' && 'نمط بوت مشبوه'}
                          </div>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300">
                            {flag.pricingModel}
                          </span>
                        </td>

                        <td className="p-3.5 max-w-xs">
                          <div className="font-medium text-slate-200 truncate">
                            {flag.articleTitle || flag.campaignName || 'حملة عامة'}
                          </div>
                          {flag.writerName && (
                            <div className="text-[11px] text-slate-400">الكاتب: {flag.writerName}</div>
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-[11px]">
                          <div className="text-slate-300">{flag.userIp}</div>
                          <div className="text-slate-500">{flag.userId || 'مجهول'}</div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              flag.severity === 'critical'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : flag.severity === 'high'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {flag.severity}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono font-bold text-emerald-400">
                          +${flag.revenueBlocked?.toFixed(2) || '0.00'}
                        </td>

                        <td className="p-3.5 text-[11px] text-slate-300">
                          {flag.mitigationAction}
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onResolveFraudFlag?.(flag.id, 'resolved')}
                              title="اعتماد وتأكيد الحظر"
                              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onResolveFraudFlag?.(flag.id, 'dismissed')}
                              title="تجاهل / مسموح"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: CAMPAIGNS & ADS MANAGEMENT */}
        {/* ============================================================ */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            {/* الحملات المسودة بانتظار الاعتماد */}
            {campaigns.filter((c: any) => c.status === 'draft').length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <h3 className="font-black text-amber-300 text-sm mb-1">
                  حملات بانتظار الاعتماد ({campaigns.filter((c: any) => c.status === 'draft').length})
                </h3>
                <p className="text-[11px] text-amber-200/70 mb-3 leading-relaxed">
                  تحقّق من رصيد محفظة المعلن قبل الاعتماد. عند التفعيل، اخصم الميزانية
                  المطلوبة من رصيده يدوياً من تبويب المستخدمين.
                </p>
                <div className="space-y-2.5">
                  {campaigns.filter((c: any) => c.status === 'draft').map((camp: any) => {
                    const adv: any = users.find((u: any) => u.id === camp.advertiserId);
                    const advBalance = adv?.walletBalance ?? 0;
                    const requested = camp.requestedBudget ?? 0;
                    const canAfford = advBalance >= requested;
                    return (
                      <div key={camp.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white truncate">{camp.campaignName}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {adv ? adv.fullName : camp.advertiserId} • {camp.pricingModel}
                            {camp.placementType === 'category_sponsor' && ' • رعاية قسم'}
                          </div>
                          <div className={`text-[11px] mt-1 font-bold ${canAfford ? 'text-emerald-400' : 'text-rose-400'}`}>
                            المطلوب ${requested.toFixed(2)} • رصيده ${advBalance.toFixed(2)}
                            {!canAfford && ' — الرصيد غير كافٍ'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onUpdateCampaignStatus && onUpdateCampaignStatus(camp.id, 'active' as any)}
                            disabled={!canAfford}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
                          >
                            اعتماد وتفعيل
                          </button>
                          <button
                            onClick={() => onUpdateCampaignStatus && onUpdateCampaignStatus(camp.id, 'rejected' as any)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold"
                          >
                            رفض
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Master Controls Header */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-purple-400" />
                  إدارة الحملات ونظام الإعلانات المركزي
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  التحكم في إعلانات المنصة العامة وإعلانات الكُتّاب واعتماد الحملات الجديدة.
                </p>
              </div>

              {/* Master Platform Ads Toggle */}
              <div className="flex items-center gap-3 bg-slate-950 p-2.5 px-4 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-300">إعلانات المنصة العامة (100% للمالك):</span>
                <button
                  type="button"
                  onClick={() => setPlatformAdsEnabled(!platformAdsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    platformAdsEnabled ? 'bg-purple-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      platformAdsEnabled ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Campaign Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-purple-500/30 transition-all shadow-lg"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                          {camp.pricingModel.toUpperCase()}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1 line-clamp-1">
                          {camp.campaignName}
                        </h4>
                        <div className="text-xs text-slate-400">{camp.advertiserName}</div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          camp.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {camp.status === 'active' ? 'نشطة' : 'قيد المراجعة'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 mb-4">
                      {camp.adText || camp.description}
                    </p>

                    {/* Stats Box */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center mb-4">
                      <div>
                        <div className="text-[10px] text-slate-400">الميزانية</div>
                        <div className="text-xs font-bold text-white font-mono">${camp.totalBudget}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">المنفق</div>
                        <div className="text-xs font-bold text-emerald-400 font-mono">${camp.totalSpent}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">النقرات/الظهور</div>
                        <div className="text-xs font-bold text-purple-300 font-mono">
                          {camp.clicksCount}/{camp.impressionsCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                    {camp.status !== 'active' ? (
                      <button
                        onClick={() => onUpdateCampaignStatus?.(camp.id, 'active')}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                      >
                        اعتماد وتفعيل
                      </button>
                    ) : (
                      <button
                        onClick={() => onUpdateCampaignStatus?.(camp.id, 'paused')}
                        className="flex-1 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold transition-all"
                      >
                        إيقاف مؤقت
                      </button>
                    )}
                    <button
                      onClick={() => onUpdateCampaignStatus?.(camp.id, 'rejected')}
                      className="px-3 py-1.5 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white text-xs font-bold transition-all"
                    >
                      رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: CONTENT MODERATION */}
        {/* ============================================================ */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  حوكمة المحتوى والمقالات المنشورة
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  مراجعة مقالات الكُتّاب، والمحتوى الحصري المقفول، ومراقبة جودة الطرح.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {['all', 'published', 'locked', 'free'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setArticleFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      articleFilter === f
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {f === 'all' && 'الكل'}
                    {f === 'published' && 'المنشورة'}
                    {f === 'locked' && 'المقفولة (مدفوعة) 🔒'}
                    {f === 'free' && 'المجانية'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles
                .filter((a) => {
                  if (articleFilter === 'locked') return a.isLocked;
                  if (articleFilter === 'free') return !a.isLocked;
                  return true;
                })
                .map((art) => (
                  <div
                    key={art.id}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-purple-500/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          {art.category}
                        </span>
                        {art.isLocked && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
                            <Lock className="w-3 h-3" />
                            ${art.lockedPrice}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white mb-1 line-clamp-2">
                        {art.title}
                      </h4>
                      <p className="text-xs text-slate-400 mb-2">بقلم: {art.writerName}</p>
                      <p className="text-xs text-slate-300 line-clamp-2 mb-4">{art.description}</p>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950 text-center text-xs mb-4">
                        <div>
                          <div className="text-[10px] text-slate-400">المشاهدات</div>
                          <div className="font-bold text-white font-mono">{art.viewsCount}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">إيراد الإعلانات</div>
                          <div className="font-bold text-purple-300 font-mono">${art.revenueFromAds}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">إيراد المبيعات</div>
                          <div className="font-bold text-emerald-400 font-mono">${art.revenueFromSales || 0}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => onSelectArticle?.(art)}
                        className="flex-1 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all"
                      >
                        معاينة المقال
                      </button>
                      <button
                        onClick={() => onUpdateArticleStatus?.(art.id, 'archived')}
                        className="px-3 py-1.5 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white text-xs font-bold transition-all"
                      >
                        إلغاء النشر
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: USERS & KYC MANAGEMENT */}
        {/* ============================================================ */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="البحث بالاسم، المعرف، أو البريد الإلكتروني..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                {['all', 'admin', 'writer', 'advertiser', 'reader'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setUserRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      userRoleFilter === r
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {r === 'all' && 'جميع الرتب'}
                    {r === 'admin' && 'الإدارة 👑'}
                    {r === 'writer' && 'الكُتّاب ✍️'}
                    {r === 'advertiser' && 'المعلنون 📢'}
                    {r === 'reader' && 'القرّاء 📖'}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">المستخدم</th>
                      <th className="p-3.5">الدور الحالي</th>
                      <th className="p-3.5">حالة التوثيق (KYC)</th>
                      <th className="p-3.5">المتابعين/المقالات</th>
                      <th className="p-3.5">الأرباح التراكمية</th>
                      <th className="p-3.5">تعديل الرصيد يدوياً</th>
                      <th className="p-3.5 text-center">إجراءات الحوكمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl object-cover border border-purple-500/20"
                            />
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {u.fullName}
                                {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">@{u.username} • {u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <select
                            value={u.role}
                            onChange={(e) => onUpdateUserRole?.(u.id, e.target.value as any)}
                            className="bg-slate-950 border border-slate-800 text-purple-300 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:border-purple-500"
                          >
                            <option value="reader">قارئ (Reader)</option>
                            <option value="writer">كاتب (Writer)</option>
                            <option value="advertiser">معلن (Advertiser)</option>
                            <option value="admin">مدير نظام (Admin)</option>
                          </select>
                        </td>

                        <td className="p-3.5">
                          {u.kycDetails?.status === 'verified' || u.isKycVerified ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                              موثق رسمياً ✅
                            </span>
                          ) : u.kycDetails?.status === 'pending' ? (
                            <button
                              onClick={() => onApproveKyc?.(u.id)}
                              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white border border-amber-500/30 text-[11px] font-bold transition-all"
                            >
                              مراجعة واعتماد KYC ⏳
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px]">غير مكتمل</span>
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-slate-300">
                          {u.followersCount} متابع • {u.articlesCount || 0} مقال
                        </td>

                        <td className="p-3.5 font-mono font-bold text-emerald-400">
                          ${u.totalEarnings?.toFixed(2) || '0.00'}
                        </td>

                        <td className="p-3.5">
                          <BalanceAdjustCell user={u} onAdjustBalance={onAdjustBalance} />
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onToggleUserVerified?.(u.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                u.isVerified
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {u.isVerified ? 'شارة التوثيق ✓' : 'منح التوثيق'}
                            </button>
                            <button
                              onClick={() => onBanUser?.(u.id)}
                              title={u.isBanned ? 'إلغاء الحظر' : 'حظر المستخدم'}
                              className={`p-1.5 rounded-lg transition-all ${
                                u.isBanned
                                  ? 'bg-red-600 text-white'
                                  : 'bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white'
                              }`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 6: FINANCE & PAYOUTS */}
        {/* ============================================================ */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-purple-500/20">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                معالجة طلبات سحب أرباح الكُتّاب
              </h3>
              <p className="text-xs text-slate-400">
                تدقيق السحوبات والتحويلات عبر USDT TRC20 والحوالات البنكية بعد التأكد من نزاهة الأرباح.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">رقم المعاملة والتاريخ</th>
                      <th className="p-3.5">النوع والبيان</th>
                      <th className="p-3.5">طريقة الدفع والحساب</th>
                      <th className="p-3.5">المبلغ</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono">
                          <div className="font-bold text-purple-300">{tx.referenceId || tx.id}</div>
                          <div className="text-[11px] text-slate-500">{tx.createdAt}</div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-white">{tx.description}</div>
                          {tx.relatedArticleTitle && (
                            <div className="text-[11px] text-slate-400">{tx.relatedArticleTitle}</div>
                          )}
                        </td>

                        <td className="p-3.5 text-slate-300 font-medium">
                          {tx.paymentMethod}
                        </td>

                        <td className="p-3.5 font-mono font-bold text-emerald-400 text-sm">
                          ${tx.amount.toFixed(2)}
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : tx.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {tx.status === 'completed' ? 'مكتمل' : 'قيد الانتظار'}
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          {tx.status === 'pending' ? (
                            <button
                              onClick={() => onApprovePayout?.(tx.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                            >
                              موافقة وصرف
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">تمت المعالجة</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 7: SYSTEM SETTINGS */}
        {/* ============================================================ */}
        {activeTab === 'accounting' && (() => {
          const unprocessed = adEvents.filter((e: any) => !e.processed);
          const advertiserByCampaign: Record<string, string> = {};
          campaigns.forEach((c: any) => {
            if (c.id && c.advertiserId) advertiserByCampaign[c.id] = c.advertiserId;
          });
          const { valid, suspicious } = evaluateAdEventBatch(unprocessed as any, advertiserByCampaign);

          // حساب المستحقات من الأحداث الصالحة فقط
          let totalCost = 0;
          const writerEarnings: Record<string, number> = {};
          valid.forEach((ev: any) => {
            const camp: any = campaigns.find((c: any) => c.id === ev.campaignId);
            if (!camp) return;
            const cost = calculateEventCost(ev, camp);
            if (cost <= 0) return;
            totalCost += cost;
            if (ev.writerId) {
              const share = ev.slotId && String(ev.slotId).startsWith('writer_profile')
                ? REVENUE_SHARES.WRITER_PROFILE_ADS.WRITER
                : REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;
              writerEarnings[ev.writerId] = (writerEarnings[ev.writerId] || 0) + cost * share;
            }
          });

          return (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <h3 className="font-black text-white text-base">احتساب أرباح الإعلانات</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  الأحداث تُسجَّل تلقائياً بدون أي احتساب مالي. راجع الأحداث المشبوهة أدناه،
                  ثم اضغط "احتساب" لخصم التكلفة من المعلنين وإضافة حصص الكتّاب إلى أرباحهم
                  المجمّدة. لا يُحتسب أي حدث مشبوه — لا يُخصم من المعلن ولا يُضاف للكاتب.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-2xl font-black text-white font-mono">{unprocessed.length}</div>
                  <div className="text-[11px] text-slate-400 mt-1">حدث غير محتسب</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30">
                  <div className="text-2xl font-black text-emerald-400 font-mono">{valid.length}</div>
                  <div className="text-[11px] text-slate-400 mt-1">حدث صالح</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30">
                  <div className="text-2xl font-black text-rose-400 font-mono">{suspicious.length}</div>
                  <div className="text-[11px] text-slate-400 mt-1">حدث مشبوه</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30">
                  <div className="text-2xl font-black text-amber-400 font-mono">${totalCost.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-400 mt-1">إجمالي المستحق</div>
                </div>
              </div>

              {Object.keys(writerEarnings).length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <h4 className="font-bold text-white text-sm mb-3">حصص الكتّاب المستحقة</h4>
                  <div className="space-y-2">
                    {Object.entries(writerEarnings).map(([wId, amt]) => {
                      const w: any = users.find((u: any) => u.id === wId);
                      return (
                        <div key={wId} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{w ? w.fullName : wId}</span>
                          <span className="font-mono font-bold text-emerald-400">
                            ${amt.toFixed(4)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {suspicious.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                  <h4 className="font-bold text-rose-300 text-sm mb-3">
                    أحداث مشبوهة — لن تُحتسب
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {suspicious.slice(0, 30).map((ev: any) => (
                      <div key={ev.id} className="p-2.5 rounded-xl bg-slate-900/60 text-[11px]">
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-bold">
                            {ev.eventType === 'click' ? 'نقرة' : 'ظهور'}
                          </span>
                          <span className="text-slate-500">{ev.slotId}</span>
                        </div>
                        <ul className="mt-1 space-y-0.5 pe-4">
                          {ev.reasons.map((r: string, i: number) => (
                            <li key={i} className="list-disc text-rose-300/80">{r}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unprocessed.length > 0 && onProcessAdEvents && (
                <button
                  onClick={onProcessAdEvents}
                  className="w-full px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm"
                >
                  احتساب الأحداث الصالحة وتعليم الكل كمعالَج
                </button>
              )}

              {unprocessed.length === 0 && (
                <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                  لا توجد أحداث بانتظار الاحتساب.
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === 'money' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <h3 className="font-black text-amber-300 text-sm">تعليمات إلزامية قبل الاعتماد</h3>
              <ul className="text-xs text-amber-200/80 mt-2 space-y-1 leading-relaxed pe-4">
                <li className="list-disc">لا تعتمد أي إيداع قبل تأكيد وصول المال فعلياً إلى حسابك.</li>
                <li className="list-disc">راجع سجل أرباح الكاتب قبل اعتماد أي سحب، خصوصاً إن كانت مرتفعة بشكل غير متناسب.</li>
                <li className="list-disc">بعد الاعتماد، عدّل رصيد المستخدم يدوياً من تبويب المستخدمين.</li>
              </ul>
            </div>

            {/* الأرباح المجمّدة القابلة للتحرير بعد انقضاء 30 يوماً —
                محسوبة فعلياً من تاريخ التسجيل الحقيقي (releasableAt)،
                وليست قائمة وهمية. لا تظهر إلا الأرباح التي حان أوان
                تحريرها فعلاً؛ الباقي لا يزال ضمن فترة التجميد. */}
            <div>
              {(() => {
                const now = Date.now();
                const releasable = earningsRecords.filter(
                  (e) =>
                    (e.status === 'pending_hold' || e.status === 'pending') &&
                    new Date(e.releasableAt).getTime() <= now
                );
                return (
                  <>
                    <h3 className="font-black text-white text-base mb-3">
                      أرباح جاهزة للتحرير ({releasable.length})
                    </h3>
                    {releasable.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                        لا توجد أرباح تجاوزت فترة التجميد (30 يوماً) بعد.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {releasable.map((earning) => {
                          const u = users.find((x) => x.id === earning.userId);
                          return (
                            <div
                              key={earning.id}
                              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-white truncate">
                                  {u ? u.fullName : earning.userId}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {earning.description || earning.source} • جاهز منذ{' '}
                                  {new Date(earning.releasableAt).toLocaleDateString('ar-EG')}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="font-black text-emerald-400 font-mono text-sm">
                                  ${earning.amount.toFixed(2)}
                                </div>
                                {onReleaseEarning && (
                                  <button
                                    onClick={() => onReleaseEarning(earning)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                  >
                                    تحرير المبلغ
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* طلبات الإيداع */}
            <div>
              <h3 className="font-black text-white text-base mb-3">
                طلبات الإيداع ({depositRequests.filter((r) => r.status === 'pending').length} معلّق)
              </h3>
              {depositRequests.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                  لا توجد طلبات إيداع.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {depositRequests.map((req) => {
                    const u = users.find((x: any) => x.id === req.userId);
                    return (
                      <div key={req.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              req.status === 'pending' ? 'bg-amber-500 text-slate-950'
                              : req.status === 'approved' ? 'bg-emerald-500 text-slate-950'
                              : 'bg-rose-500 text-white'
                            }`}>
                              {req.status === 'pending' ? 'بانتظار التحقق' : req.status === 'approved' ? 'معتمد' : 'مرفوض'}
                            </span>
                            <span className="text-[11px] text-slate-400">{req.method}</span>
                          </div>
                          <div className="font-bold text-sm text-white mt-1 truncate">
                            {u ? (u as any).fullName : req.userId}
                          </div>
                          {req.reference && (
                            <div className="text-[11px] text-slate-400 mt-0.5">مرجع: {req.reference}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-end">
                            <div className="font-black text-emerald-400 font-mono text-sm">
                              ${(req.amount || 0).toFixed(2)}
                            </div>
                          </div>
                          {req.status === 'pending' && onUpdateMoneyRequest && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onUpdateMoneyRequest('depositRequests', req.id, 'approved')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                              >
                                تأكيد الوصول
                              </button>
                              <button
                                onClick={() => onUpdateMoneyRequest('depositRequests', req.id, 'rejected')}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold"
                              >
                                رفض
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* طلبات شراء المقالات المقفولة */}
            <div>
              <h3 className="font-black text-white text-base mb-3">
                طلبات شراء المقالات ({purchaseRequests.filter((r) => r.status === 'pending').length} معلّق)
              </h3>
              {purchaseRequests.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                  لا توجد طلبات شراء.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {purchaseRequests.map((req) => {
                    const buyer: any = users.find((x: any) => x.id === req.buyerId || x.id === req.userId);
                    const writer: any = users.find((x: any) => x.id === req.writerId);
                    const writerShare = (req.amount || 0) * REVENUE_SHARES.LOCKED_ARTICLES.WRITER;
                    return (
                      <div key={req.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.status === 'pending' ? 'bg-amber-500 text-slate-950'
                            : req.status === 'approved' ? 'bg-emerald-500 text-slate-950'
                            : 'bg-rose-500 text-white'
                          }`}>
                            {req.status === 'pending' ? 'بانتظار الاعتماد' : req.status === 'approved' ? 'معتمد' : 'مرفوض'}
                          </span>
                          <div className="font-bold text-sm text-white mt-1 truncate">
                            {req.articleTitle || req.articleId}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            المشتري: {buyer ? buyer.fullName : req.buyerId} • الكاتب: {writer ? writer.fullName : req.writerId}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-end">
                            <div className="font-black text-amber-400 font-mono text-sm">
                              ${(req.amount || 0).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              للكاتب ${writerShare.toFixed(2)}
                            </div>
                          </div>
                          {req.status === 'pending' && onUpdatePurchaseRequest && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onUpdatePurchaseRequest(req.id, 'approved')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                              >
                                اعتماد
                              </button>
                              <button
                                onClick={() => onUpdatePurchaseRequest(req.id, 'rejected')}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold"
                              >
                                رفض
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* طلبات السحب */}
            <div>
              <h3 className="font-black text-white text-base mb-3">
                طلبات السحب ({payoutRequests.filter((r) => r.status === 'pending').length} معلّق)
              </h3>
              {payoutRequests.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                  لا توجد طلبات سحب.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {payoutRequests.map((req) => {
                    const u = users.find((x: any) => x.id === req.userId);
                    return (
                      <div key={req.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              req.status === 'pending' ? 'bg-amber-500 text-slate-950'
                              : req.status === 'paid' ? 'bg-emerald-500 text-slate-950'
                              : req.status === 'approved' ? 'bg-sky-500 text-slate-950'
                              : 'bg-rose-500 text-white'
                            }`}>
                              {req.status === 'pending' ? 'بانتظار المراجعة'
                                : req.status === 'approved' ? 'معتمد — بانتظار التحويل'
                                : req.status === 'paid' ? 'تم الدفع' : 'مرفوض'}
                            </span>
                            <span className="text-[11px] text-slate-400">{req.method}</span>
                          </div>
                          <div className="font-bold text-sm text-white mt-1 truncate">
                            {u ? (u as any).fullName : req.userId}
                          </div>
                          {req.destination && (
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              الوجهة: {req.destination}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="font-black text-purple-400 font-mono text-sm">
                            ${(req.amount || 0).toFixed(2)}
                          </div>
                          {onUpdateMoneyRequest && req.status !== 'paid' && req.status !== 'rejected' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onUpdateMoneyRequest('payoutRequests', req.id, 'paid')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                              >
                                تم الدفع
                              </button>
                              <button
                                onClick={() => onUpdateMoneyRequest('payoutRequests', req.id, 'rejected')}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold"
                              >
                                رفض
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'promotions' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <Rocket className="w-4 h-4 text-amber-400" />
                طلبات ترويج المقالات
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                يطلب الكاتب ترويج مقاله مقابل مبلغ يُخصم من رصيد أرباحه. تحقّق من رصيده
                أولاً، ثم اعتمد الطلب واخصم المبلغ يدوياً من صفحة المستخدم.
              </p>
            </div>

            {promotions.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                لا توجد طلبات ترويج حتى الآن.
              </div>
            ) : (
              <div className="space-y-3">
                {promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            promo.status === 'pending'
                              ? 'bg-amber-500 text-slate-950'
                              : promo.status === 'approved'
                              ? 'bg-emerald-500 text-slate-950'
                              : promo.status === 'rejected'
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {promo.status === 'pending'
                            ? 'بانتظار المراجعة'
                            : promo.status === 'approved'
                            ? 'معتمد'
                            : promo.status === 'rejected'
                            ? 'مرفوض'
                            : 'منتهي'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {promo.pricingModel === 'fixed'
                            ? `ثابت — ${promo.durationHours} ساعة`
                            : 'حسب النقرات'}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white mt-1 truncate">
                        {promo.articleTitle || promo.articleId}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        الكاتب: {promo.writerName || promo.writerId}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <div className="font-black text-amber-400 font-mono text-sm">
                          ${(promo.cost || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">التكلفة</div>
                      </div>

                      {promo.status === 'pending' && onUpdatePromotionStatus && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdatePromotionStatus(promo.id, 'approved')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                          >
                            اعتماد
                          </button>
                          <button
                            onClick={() => onUpdatePromotionStatus(promo.id, 'rejected')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold"
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                معايير الأمان المالي وتقاسم الأرباح
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <div className="font-bold text-white">نسبة الكاتب من إعلانات المقالات (AdSense Share)</div>
                    <div className="text-[11px] text-slate-400">الحصة الافتراضية للكاتب من مرات الظهور الصالحة</div>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <div className="font-bold text-white">حصة المنصة من مبيعات المقالات المقفولة</div>
                    <div className="text-[11px] text-slate-400">عمولة تشغيل المنصة واستضافة المحتوى المشفر</div>
                  </div>
                  <span className="font-mono font-bold text-purple-400 text-sm">{REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}% (يحصل الكاتب {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%)</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <div className="font-bold text-white">الحد الأدنى لمدة رؤية إعلان CPM</div>
                    <div className="text-[11px] text-slate-400">يجب أن يظهر 50% من الإعلان لمدة متصلة للتحقق</div>
                  </div>
                  <span className="font-mono font-bold text-blue-400 text-sm">1.0 ثانية</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <div className="font-bold text-white">درع منع النقر الذاتي (Self-Click Shield)</div>
                    <div className="text-[11px] text-slate-400">حجب نقرات الكاتب على إعلانات مقالاته آلياً</div>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">مفعل إجبارياً</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
