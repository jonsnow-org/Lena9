import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Ban,
  Image as ImageIcon
} from 'lucide-react';
import { User, Article, AdCampaign, FraudFlag, ArticlePromotion } from '../types';
import { evaluateAdEventBatch, calculateEventCost } from '../utils/fraudFilters';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { THEME_PRESETS, ThemePresetKey, DEFAULT_THEME_PRESET } from '../constants/themePresets';
import { BACKGROUND_PRESETS, BackgroundPresetKey, DEFAULT_BACKGROUND_PRESET } from '../constants/backgroundPresets';
import { ExternalAdsConfig, ExternalAdNetworkConfig } from '../utils/externalAdsStore';

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  articles: Article[];
  campaigns: AdCampaign[];
  fraudFlags: FraudFlag[];
  onUpdateUserRole?: (userId: string, newRole: User['role']) => void;
  onToggleUserVerified?: (userId: string) => void;
  onApproveKyc?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
  onUpdateCampaignStatus?: (campaignId: string, status: AdCampaign['status']) => void;
  onUpdateArticleStatus?: (articleId: string, status: Article['status']) => void;
  onResolveFraudFlag?: (flagId: string, action: 'resolved' | 'dismissed') => void;
  onSelectArticle?: (article: Article) => void;
  onSelectUser?: (user: User) => void;
  // Lets a parent (the bottom nav) drive which internal tab is shown.
  // Optional — the component still manages its own tab state if these
  // aren't supplied, so it keeps working when used standalone.
  activeTab?: 'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'promotions' | 'money' | 'accounting' | 'settings';
  onActiveTabChange?: (tab: 'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'promotions' | 'money' | 'accounting' | 'settings') => void;
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
  /** القالب اللوني الحالي المُطبَّق على كل التطبيق لكل المستخدمين */
  currentThemePreset?: ThemePresetKey;
  /** يغيّر القالب اللوني للجميع فوراً (يُكتب في Firestore) */
  onChangeThemePreset?: (preset: ThemePresetKey) => void;
  /** خلفية القالب الحالية المُطبَّقة على كل التطبيق */
  currentBackgroundPreset?: BackgroundPresetKey;
  /** يغيّر خلفية القالب للجميع فوراً (يُكتب في Firestore) */
  onChangeBackgroundPreset?: (preset: BackgroundPresetKey) => void;
  /** هل إعلانات المنصة العامة (Platform Ads) مفعّلة حالياً لكل المستخدمين */
  platformAdsEnabled?: boolean;
  /** يشغّل/يوقف إعلانات المنصة العامة للجميع فوراً (يُكتب في Firestore) */
  onTogglePlatformAds?: (enabled: boolean) => void;
  /** إعدادات الشبكات الإعلانية الخارجية الاحتياطية (PropellerAds/Adsterra) */
  externalAdsConfig?: ExternalAdsConfig;
  /** يحفظ إعدادات الشبكات الإعلانية الخارجية فوراً (يُكتب في Firestore) */
  onSaveExternalAdsConfig?: (config: ExternalAdsConfig) => void;
  /** عدد المتابعين الحقيقي لكل مستخدم، محسوب من مجموعة follows الفعلية —
   *  بخلاف user.followersCount المخزَّن الذي لا يُحدَّث من أي مسار ويبقى
   *  صفراً دائماً. */
  followersCountByUserId?: Record<string, number>;
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
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-1.5 py-1 text-[10px] focus:outline-none focus:border-brand-500"
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
          className="w-20 bg-slate-950 border border-slate-800 text-white rounded-lg px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-brand-500"
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
        className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-1.5 py-1 text-[10px] focus:outline-none focus:border-brand-500"
      />
      {confirming && (
        <p className="text-[10px] text-amber-400 font-bold">
          مبلغ كبير — اضغط "تطبيق" مرة أخرى للتأكيد النهائي.
        </p>
      )}
      <button
        onClick={handleApply}
        disabled={!canApply}
        className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold transition-all"
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
  onUpdateUserRole,
  onToggleUserVerified,
  onApproveKyc,
  onBanUser,
  onUpdateCampaignStatus,
  onUpdateArticleStatus,
  onResolveFraudFlag,
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
  onActiveTabChange,
  currentThemePreset = DEFAULT_THEME_PRESET,
  onChangeThemePreset,
  currentBackgroundPreset = DEFAULT_BACKGROUND_PRESET,
  onChangeBackgroundPreset,
  platformAdsEnabled = true,
  onTogglePlatformAds,
  externalAdsConfig,
  onSaveExternalAdsConfig,
  followersCountByUserId = {}
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<
    'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'settings'
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

  // مسوّدة تحرير محلية لإعدادات الشبكات الإعلانية الخارجية الاحتياطية —
  // تُزامَن مرة واحدة فقط من أول قيمة حقيقية تصل من Firestore (عبر props)
  // كي لا تُفقَد تعديلات الأدمن الجارية إذا وصل تحديث onSnapshot أثناء الكتابة.
  const [externalAdsDraft, setExternalAdsDraft] = useState<ExternalAdsConfig>(
    externalAdsConfig || {
      propellerAds: { enabled: false, snippet: '' },
      adsterra: { enabled: false, snippet: '' }
    }
  );
  const hasSyncedExternalAdsRef = useRef(false);
  useEffect(() => {
    if (hasSyncedExternalAdsRef.current || !externalAdsConfig) return;
    setExternalAdsDraft(externalAdsConfig);
    hasSyncedExternalAdsRef.current = true;
  }, [externalAdsConfig]);
  const [externalAdsSavedFlash, setExternalAdsSavedFlash] = useState(false);
  const handleSaveExternalAds = () => {
    onSaveExternalAdsConfig?.(externalAdsDraft);
    setExternalAdsSavedFlash(true);
    setTimeout(() => setExternalAdsSavedFlash(false), 2000);
  };

  // Financial Metrics Calculation strictly from real Firestore data.
  // ⚠️ ملفوفة بـ useMemo لسبب أداء حقيقي: هذه اللوحة تستقبل كل مجموعات
  // Firestore تقريباً (users/campaigns/articles/fraudFlags/adEvents...)
  // كخصائص props، فأي تحديث onSnapshot لأي منها في أي مكان بالتطبيق —
  // حتى لو لم يكن الأدمن يتصفّح هذا التبويب إطلاقاً — كان يعيد تنفيذ كل
  // عمليات filter/reduce هذه من الصفر على المصفوفات الكاملة في كل مرة.
  // على موقع حقيقي تتراكم فيه بيانات فعلية (لا بيانات تجريبية فارغة)،
  // هذا يعني عملاً حسابياً متكرراً وغير ضروري على نفس اللحظة التي قد
  // يحاول فيها المستخدم التمرير بإصبعه — يزاحمها ويجعل التمرير يبدو
  // متقطعاً أو عالقاً. الآن لا تُعاد هذه الحسابات إلا عند تغيّر campaigns
  // أو articles أو fraudFlags فعلياً.
  const {
    totalPlatformAdRevenue,
    totalWriterAdRevenue,
    platformAdSenseCut,
    writersAdSenseCut,
    totalLockedArticlesSales,
    platformSalesCut,
    writersSalesCut,
    netPlatformRevenue,
    totalBlockedFraudRevenue
  } = useMemo(() => {
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

    return {
      totalPlatformAdRevenue,
      totalWriterAdRevenue,
      platformAdSenseCut,
      writersAdSenseCut,
      totalLockedArticlesSales,
      platformSalesCut,
      writersSalesCut,
      netPlatformRevenue,
      totalBlockedFraudRevenue
    };
  }, [campaigns, articles, fraudFlags]);

  // طلبات السحب الحقيقية المعلَّقة — من مجموعة payoutRequests الفعلية
  // (وليس من transactions التي كانت مصدرها الحقيقي أرباح المالك الخاصة
  // فقط، فتُظهر رقماً لا علاقة له بطلبات سحب بقية المستخدمين).
  const pendingPayoutRequests = useMemo(
    () => payoutRequests.filter((r: any) => r.status === 'pending'),
    [payoutRequests]
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
        const matchSearch =
          userSearch === '' ||
          u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(userSearch.toLowerCase());
        return matchRole && matchSearch;
      }),
    [users, userRoleFilter, userSearch]
  );

  const filteredFraudFlags = useMemo(
    () =>
      fraudFlags.filter((f) => {
        if (fraudFilter === 'all') return true;
        if (fraudFilter === 'high_critical') return f.severity === 'high' || f.severity === 'critical';
        if (fraudFilter === 'self_click') return f.triggerType === 'self_click';
        if (fraudFilter === 'cpc') return f.pricingModel === 'cpc';
        if (fraudFilter === 'cpm') return f.pricingModel === 'cpm';
        return true;
      }),
    [fraudFlags, fraudFilter]
  );

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
      <div className="bg-gradient-to-r from-brand-950/80 via-slate-900 to-brand-950/80 border-b border-brand-500/20 px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  مركز قيادة <span className="text-brand-400">ليتيريوم</span>
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  👑 مالك المنصة
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                أهلاً {currentUser.fullName} • مراقبة النزاهة الإعلانية، الحوكمة المالية، ومكافحة الاحتيال
              </p>
            </div>
          </div>

          {/* Quick Realtime Shield Status — أرقام محسوبة فعلياً من بيانات
              الاحتيال الحقيقية، وليست نسبة ثابتة مزيَّفة */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 border border-brand-500/20 rounded-2xl p-2.5 px-4 shadow-inner">
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2.5 h-2.5 rounded-full ${fraudFlags.length > 0 ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
              <span className="text-slate-300 font-medium">درع مكافحة الاحتيال:</span>
              <span className={`font-bold ${fraudFlags.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {fraudFlags.length > 0 ? `${fraudFlags.length} حادثة مكتشفة` : 'نشط — لا حوادث حالياً'}
              </span>
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
            { id: 'promotions', label: 'طلبات ترويج المقالات', icon: Rocket, badge: promotions.filter((p) => p.status === 'pending').length },
            { id: 'users', label: 'إدارة المستخدمين وKYC', icon: Users, badge: users.length },
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
                    ? 'bg-gradient-to-r from-brand-600 to-brand-600 text-white shadow-lg shadow-brand-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-brand-300'
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
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-brand-950/40 border border-brand-500/20 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">إجمالي دخل المنصة الصافي</span>
                  <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  ${netPlatformRevenue.toFixed(2)}
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  إجمالي حصة المنصة من الإعلانات والمبيعات (محتسب من بيانات حقيقية)
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
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-brand-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-brand-400" />
                  هيكلية النظام الإعلاني المزدوج (Dual Advertising System)
                </h3>
                <span className="text-xs text-brand-300 font-mono bg-brand-950/60 px-3 py-1 rounded-full border border-brand-500/30">
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
                <div className="p-5 rounded-xl bg-gradient-to-br from-brand-950/30 to-slate-900 border border-brand-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      إعلانات الكُتّاب التشاركية (Writer Ads)
                    </span>
                    <span className="text-xs font-black text-brand-400 font-mono">
                      تقاسم {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% كاتب / {REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% منصة
                    </span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                      <span>تظهر داخل مقالات الكاتب (55% للكاتب / 45% للمنصة) وفي صفحته الشخصية (50% / 50%).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                      <span>المبيعات للمقالات الحصرية: 85% للكاتب / 15% للمنصة.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
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
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
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
                    <Activity className="w-4 h-4 text-brand-400" />
                    المهام والإجراءات المعلقة
                  </h4>
                  <span className="text-xs text-slate-400">مراجعة فورية</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">طلبات سحب أرباح الكُتّاب</div>
                      <div className="text-[11px] text-slate-400">
                        {pendingPayoutRequests.length} طلبات بانتظار التحويل المالي
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('money')}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-500 text-xs"
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
                      className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-500 text-xs"
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
                        ? 'bg-brand-600 text-white'
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
                          <div className="font-mono font-bold text-brand-300">{flag.id}</div>
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
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-brand-300">
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
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-brand-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-brand-400" />
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
                  onClick={() => onTogglePlatformAds?.(!platformAdsEnabled)}
                  title={platformAdsEnabled ? 'إيقاف إعلانات المنصة لكل المستخدمين' : 'تشغيل إعلانات المنصة لكل المستخدمين'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    platformAdsEnabled ? 'bg-brand-600' : 'bg-slate-700'
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

            {/* شبكات إعلانية خارجية احتياطية (PropellerAds/Adsterra) */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/20 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-amber-400" />
                  شبكات إعلانية خارجية احتياطية
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  تُعرض فقط في مواضع إعلانات المنصة (وليس مواضع الكتّاب)، وفقط عندما لا توجد
                  حملة معلن داخلية مناسبة للموضع — طبقة احتياطية إضافية لزيادة العائد. الصق
                  كود HTML/JS الجاهز من لوحة كل شبكة كما هو دون أي تعديل.
                </p>
                <p className="text-xs text-amber-400/90 mt-2 font-semibold">
                  ⚠️ تجنّب صيغ Popunder أو Interstitial (نوافذ منبثقة/شاشات اعتراضية) — قد تُصنَّف
                  مخالفة من Google Safe Browsing وتُعطّل قبول AdSense لاحقاً حتى لو لم تشترك فيه بعد.
                </p>
              </div>

              {(
                [
                  { key: 'propellerAds' as const, label: 'PropellerAds' },
                  { key: 'adsterra' as const, label: 'Adsterra' }
                ]
              ).map(({ key, label }) => {
                const network: ExternalAdNetworkConfig = externalAdsDraft[key];
                return (
                  <div key={key} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-200">{label}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setExternalAdsDraft((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], enabled: !prev[key].enabled }
                          }))
                        }
                        title={network.enabled ? `إيقاف ${label}` : `تشغيل ${label}`}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          network.enabled ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            network.enabled ? 'translate-x-1' : 'translate-x-6'
                          }`}
                        />
                      </button>
                    </div>
                    <textarea
                      value={network.snippet}
                      onChange={(e) =>
                        setExternalAdsDraft((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], snippet: e.target.value }
                        }))
                      }
                      placeholder={`الصق كود ${label} الجاهز هنا (HTML/JS)...`}
                      rows={4}
                      dir="ltr"
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono p-2.5 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                );
              })}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveExternalAds}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                >
                  حفظ إعدادات الشبكات الخارجية
                </button>
                {externalAdsSavedFlash && (
                  <span className="text-xs font-semibold text-emerald-400">تم الحفظ ✓</span>
                )}
              </div>
            </div>

            {/* Campaign Cards Grid — الحملات المسودة (draft) مستبعدة هنا عمداً:
                لها بالفعل بطاقتها الكاملة القابلة للاعتماد/الرفض في صندوق
                "حملات بانتظار الاعتماد" أعلاه، فعرضها هنا أيضاً كان يكرر
                نفس زرَي "اعتماد وتفعيل"/"رفض" لنفس الحملة في مكانين على نفس
                الشاشة دفعة واحدة. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.filter((c: any) => c.status !== 'draft').map((camp) => {
                // نفس فحص الرصيد المطبَّق في قسم "حملات بانتظار الاعتماد" أعلاه —
                // حملة draft لم تُفحص ميزانيتها بعد، فلا يجوز تفعيلها من هذه
                // البطاقة متجاوزةً الفحص (كانت تتيح ذلك سابقاً بلا أي تحقق).
                const adv: any = users.find((u: any) => u.id === camp.advertiserId);
                const advBalance = adv?.walletBalance ?? 0;
                const requested = (camp as any).requestedBudget ?? 0;
                const draftBlocked = camp.status === 'draft' && advBalance < requested;
                return (
                <div
                  key={camp.id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-brand-500/30 transition-all shadow-lg"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono">
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
                        <div className="text-xs font-bold text-brand-300 font-mono">
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
                        disabled={draftBlocked}
                        title={draftBlocked ? `رصيد المعلن ($${advBalance.toFixed(2)}) أقل من المطلوب ($${requested.toFixed(2)})` : undefined}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
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
              );
              })}
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
                  <FileText className="w-5 h-5 text-brand-400" />
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
                        ? 'bg-brand-600 text-white'
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
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-brand-500/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
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
                          <div className="font-bold text-brand-300 font-mono">${art.revenueFromAds}</div>
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
                        className="flex-1 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                {['all', 'admin', 'writer', 'advertiser', 'reader'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setUserRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      userRoleFilter === r
                        ? 'bg-brand-600 text-white'
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
                          <button
                            type="button"
                            onClick={() => onSelectUser?.(u)}
                            disabled={!onSelectUser}
                            className="flex items-center gap-3 text-start disabled:cursor-default enabled:hover:opacity-80 transition-opacity"
                            title={onSelectUser ? 'عرض الملف الشخصي' : undefined}
                          >
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl object-cover border border-brand-500/20"
                            />
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {u.fullName}
                                {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">@{u.username} • {u.email}</div>
                            </div>
                          </button>
                        </td>

                        <td className="p-3.5">
                          <select
                            value={u.role}
                            onChange={(e) => onUpdateUserRole?.(u.id, e.target.value as any)}
                            className="bg-slate-950 border border-slate-800 text-brand-300 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:border-brand-500"
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
                          {followersCountByUserId[u.id] ?? 0} متابع • {u.articlesCount || 0} مقال
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
        {/* TAB: AD REVENUE ACCOUNTING */}
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
                          <div className="font-black text-brand-400 font-mono text-sm">
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
            {onChangeThemePreset && (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-400" />
                  لون قالب التطبيق (لكل المستخدمين)
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  اختيارك هنا يغيّر اللون الأساسي للتطبيق فوراً لكل المستخدمين المتصلين حالياً
                  (الأزرار، شريط التنقل، الشارات، الروابط النشطة)، دون الحاجة لإعادة نشر التطبيق.
                  ألوان النجاح/التحذير/الخطر (أخضر/أصفر/أحمر) لا تتغيّر أبداً — تبقى واضحة الدلالة دائماً.
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-3">
                  {Object.values(THEME_PRESETS).map((preset) => {
                    const isActive = currentThemePreset === preset.key;
                    return (
                      <button
                        key={preset.key}
                        onClick={() => onChangeThemePreset(preset.key)}
                        title={preset.label}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all ${
                          isActive ? 'border-white shadow-lg scale-105' : 'border-transparent hover:border-slate-600'
                        }`}
                      >
                        <span
                          className="w-9 h-9 rounded-full ring-2 ring-slate-800"
                          style={{ backgroundColor: preset.swatch }}
                        />
                        <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                          {preset.label}
                        </span>
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {onChangeBackgroundPreset && (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-brand-400" />
                    خلفية قالب التطبيق (لكل المستخدمين)
                  </h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-medium">
                    ✓ تحافظ على تباين الحروف وراحة القراءة
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  اختر خلفية جمالية عالية الجودة لقالب المنصة. تأتي كل خلفية بطبقة تظليل ذكية ومتناسقة تلقائياً
                  مع الوضعين الفاتح والداكن لضمان أقصى درجات الوضوح والراحة البصرية للقراء والكتّاب.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.values(BACKGROUND_PRESETS).map((preset) => {
                    const isActive = currentBackgroundPreset === preset.key;
                    return (
                      <button
                        key={preset.key}
                        onClick={() => onChangeBackgroundPreset(preset.key)}
                        className={`text-start p-3 rounded-2xl border-2 transition-all flex items-center gap-3 relative overflow-hidden group ${
                          isActive
                            ? 'border-brand-500 bg-brand-950/40 ring-2 ring-brand-500/20'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-700 bg-slate-800 flex items-center justify-center relative">
                          {preset.imageUrl ? (
                            <img
                              src={preset.previewUrl}
                              alt={preset.label}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          ) : preset.cssBackground ? (
                            <div
                              className="w-full h-full group-hover:scale-110 transition-transform duration-300"
                              style={{ backgroundImage: preset.cssBackground }}
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 text-xs font-bold">
                              نقية
                            </div>
                          )}
                          {isActive && (
                            <div className="absolute inset-0 bg-brand-600/30 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`text-xs font-bold truncate ${isActive ? 'text-brand-300 font-black' : 'text-white'}`}>
                              {preset.label}
                            </div>
                            {isActive && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500 text-white font-bold shrink-0">
                                مفعّلة
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                            {preset.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-400" />
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
                  <span className="font-mono font-bold text-brand-400 text-sm">{REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}% (يحصل الكاتب {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%)</span>
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
