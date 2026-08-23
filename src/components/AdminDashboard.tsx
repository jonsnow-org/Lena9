import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  Settings,
  AlertTriangle,
  BadgePercent,
  CheckCircle2,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  Activity
} from 'lucide-react';
import { User, Article, AdCampaign, FraudFlag, ArticlePromotion } from '../types';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { ThemePresetKey } from '../constants/themePresets';
import { BackgroundPresetKey } from '../constants/backgroundPresets';
import { ExternalAdsConfig } from '../utils/externalAdsStore';

// Subcomponents
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminFinanceTab } from './admin/AdminFinanceTab';
import { AdminAdsTab } from './admin/AdminAdsTab';
import { AdminContentTab } from './admin/AdminContentTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminFraudTab } from './admin/AdminFraudTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';
import { AdminAnalyticsTab } from './admin/AdminAnalyticsTab';
import { BalanceAdjustModal, AdjustableBalanceField } from './admin/BalanceAdjustModal';
import { KycReviewModal } from './admin/KycReviewModal';

export interface AdminDashboardProps {
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
    field: AdjustableBalanceField,
    amount: number,
    reason: string
  ) => void;
  onUpdatePurchaseRequest?: (requestId: string, status: 'approved' | 'rejected') => void;
  onUpdateMoneyRequest?: (
    collectionName: 'depositRequests' | 'payoutRequests',
    requestId: string,
    status: 'approved' | 'rejected' | 'paid'
  ) => void;
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
  currentThemePreset?: ThemePresetKey;
  onChangeThemePreset?: (preset: ThemePresetKey) => void;
  currentBackgroundPreset?: BackgroundPresetKey;
  onChangeBackgroundPreset?: (preset: BackgroundPresetKey) => void;
  platformAdsEnabled?: boolean;
  onTogglePlatformAds?: (enabled: boolean) => void;
  externalAdsConfig?: ExternalAdsConfig;
  onSaveExternalAdsConfig?: (config: ExternalAdsConfig) => void;
  followersCountByUserId?: Record<string, number>;
  onBroadcastMessage?: (text: string) => Promise<{ sent: number; failed: number }>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  users,
  articles,
  campaigns,
  fraudFlags,
  onUpdateUserRole,
  onToggleUserVerified,
  onApproveKyc,
  onBanUser,
  onUpdateCampaignStatus,
  onUpdateArticleStatus,
  onResolveFraudFlag,
  onSelectArticle,
  onSelectUser,
  activeTab: externalActiveTab,
  onActiveTabChange,
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
  currentThemePreset,
  onChangeThemePreset,
  currentBackgroundPreset,
  onChangeBackgroundPreset,
  platformAdsEnabled,
  onTogglePlatformAds,
  externalAdsConfig,
  onSaveExternalAdsConfig,
  onBroadcastMessage
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<
    'overview' | 'analytics' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'promotions' | 'money' | 'accounting' | 'settings'
  >('overview');

  const currentTab = externalActiveTab ?? internalActiveTab;
  const setTab = onActiveTabChange ?? setInternalActiveTab;

  // Selected User for Modals
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<User | null>(null);
  const [selectedUserForKyc, setSelectedUserForKyc] = useState<User | null>(null);

  // Sub-navigation overrides when clicking from Overview
  const [financeSubTab, setFinanceSubTab] = useState<
    'payouts' | 'deposits' | 'releasable' | 'locked_sales' | 'ad_accounting'
  >('payouts');
  const [adsSubTab, setAdsSubTab] = useState<'ad_campaigns' | 'promotions' | 'external_networks'>(
    'ad_campaigns'
  );

  // Handle direct navigation with subTab
  const handleNavigate = (tab: string, subTab?: string) => {
    if (tab === 'money') {
      if (subTab) setFinanceSubTab(subTab as any);
      setTab('money');
    } else if (tab === 'accounting') {
      setFinanceSubTab('ad_accounting');
      setTab('money');
    } else if (tab === 'campaigns') {
      if (subTab) setAdsSubTab(subTab as any);
      setTab('campaigns');
    } else if (tab === 'promotions') {
      setAdsSubTab('promotions');
      setTab('campaigns');
    } else {
      setTab(tab as any);
    }
  };

  // Synchronize incoming externalTab
  const effectiveTab = useMemo(() => {
    if (currentTab === 'accounting') return 'money';
    if (currentTab === 'promotions') return 'campaigns';
    return currentTab;
  }, [currentTab]);

  // Financial Metrics Calculation
  const metrics = useMemo(() => {
    const totalPlatformAdRevenue = campaigns
      .filter((c) => c.placementType === 'platform' || c.type === 'fixed')
      .reduce((acc, c) => acc + (c.totalSpent || 0), 0);

    const totalWriterAdRevenue = campaigns
      .filter((c) => c.placementType === 'writer' || c.type === 'cpm' || c.type === 'cpc')
      .reduce((acc, c) => acc + (c.totalSpent || 0), 0);

    const platformAdSenseCut = totalWriterAdRevenue * REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM;
    const writersAdSenseCut = totalWriterAdRevenue * REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;

    const totalLockedArticlesSales = articles
      .filter((a) => a.isLocked)
      .reduce((acc, a) => acc + (a.revenueFromSales || 0), 0);

    const platformSalesCut = totalLockedArticlesSales * REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM;
    const writersSalesCut = totalLockedArticlesSales * REVENUE_SHARES.LOCKED_ARTICLES.WRITER;

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

  // Badges count
  const pendingMoneyCount =
    payoutRequests.filter((r) => r.status === 'pending').length +
    depositRequests.filter((r) => r.status === 'pending').length;

  const pendingAdsCount =
    campaigns.filter((c) => c.status === 'pending').length +
    promotions.filter((p) => p.status === 'pending').length;

  const pendingKycCount = users.filter((u) => u.kycDetails?.status === 'pending').length;
  const pendingFraudCount = fraudFlags.filter((f) => f.status === 'flagged' || f.status === 'auto_blocked').length;

  // Main Navigation Tabs Definition (Clean 7 Super-Sections)
  const navTabs = [
    {
      id: 'overview',
      label: 'نظرة عامة',
      icon: TrendingUp,
      badge: 0
    },
    {
      id: 'analytics',
      label: 'الإحصائيات والزوار',
      icon: Activity,
      badge: 0
    },
    {
      id: 'money',
      label: 'العمليات المالية',
      icon: DollarSign,
      badge: pendingMoneyCount
    },
    {
      id: 'campaigns',
      label: 'الإعلانات والترويج',
      icon: Megaphone,
      badge: pendingAdsCount
    },
    {
      id: 'moderation',
      label: 'المحتوى والمقالات',
      icon: FileText,
      badge: 0
    },
    {
      id: 'users',
      label: 'المستخدمون وKYC',
      icon: Users,
      badge: pendingKycCount
    },
    {
      id: 'fraud',
      label: 'مكافحة الاحتيال',
      icon: ShieldAlert,
      badge: pendingFraudCount
    },
    {
      id: 'settings',
      label: 'إعدادات المنظومة',
      icon: Settings,
      badge: 0
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Banner Header */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-brand-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white">لوحة قيادة إدارة المنصة</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/10 text-brand-300 border border-brand-500/20">
                  Platform Owner
                </span>
              </div>
              <p className="text-xs text-slate-400">
                مرحباً {currentUser.fullName} • التحكم المركزي في العمليات المالية، المحتوى، والمستخدمين
              </p>
            </div>
          </div>

          {/* Quick Metrics Pill */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-900 px-3 py-1.5 rounded-2xl border border-slate-800 text-xs">
            <span className="text-slate-400">صافي دخل المنصة:</span>
            <span className="font-mono font-bold text-emerald-400">
              ${metrics.netPlatformRevenue.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Categorized Super-Tabs Navigation Bar */}
        <div className="max-w-7xl mx-auto mt-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800/80 min-w-max">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleNavigate(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-slate-950'
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
      </div>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* Active Department Context Header */}
        <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600/30 to-emerald-500/30 border border-brand-500/30 flex items-center justify-center text-brand-400">
              {effectiveTab === 'overview' && <TrendingUp className="w-6 h-6" />}
              {effectiveTab === 'analytics' && <Activity className="w-6 h-6 text-emerald-400" />}
              {effectiveTab === 'money' && <DollarSign className="w-6 h-6 text-amber-400" />}
              {effectiveTab === 'campaigns' && <Megaphone className="w-6 h-6 text-cyan-400" />}
              {effectiveTab === 'moderation' && <FileText className="w-6 h-6 text-emerald-400" />}
              {effectiveTab === 'users' && <Users className="w-6 h-6 text-blue-400" />}
              {effectiveTab === 'fraud' && <ShieldAlert className="w-6 h-6 text-rose-400" />}
              {effectiveTab === 'settings' && <Settings className="w-6 h-6 text-purple-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  {effectiveTab === 'overview' && 'مركز التقارير والنظرة العامة'}
                  {effectiveTab === 'analytics' && 'قسم الإحصائيات العامة وحركة الزوار'}
                  {effectiveTab === 'money' && 'قسم العمليات المالية والحسابات'}
                  {effectiveTab === 'campaigns' && 'قسم إدارة الإعلانات والترويج'}
                  {effectiveTab === 'moderation' && 'قسم حوكمة المحتوى والمقالات'}
                  {effectiveTab === 'users' && 'قسم إدارة المستخدمين وتوثيق KYC'}
                  {effectiveTab === 'fraud' && 'مركز مكافحة الاحتيال والأمان (SOC)'}
                  {effectiveTab === 'settings' && 'قسم إعدادات المنظومة والمظهر'}
                </h2>
                {effectiveTab === 'money' && pendingMoneyCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono">
                    {pendingMoneyCount} طلب معلق
                  </span>
                )}
                {effectiveTab === 'campaigns' && pendingAdsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono">
                    {pendingAdsCount} حملة معلقة
                  </span>
                )}
                {effectiveTab === 'users' && pendingKycCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono">
                    {pendingKycCount} طلب KYC
                  </span>
                )}
                {effectiveTab === 'fraud' && pendingFraudCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono">
                    {pendingFraudCount} إنذار احتيال
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {effectiveTab === 'overview' && 'الملخص التنفيذي للمنصة، إجمالي الإيرادات، ومؤشرات الأداء التشغيلي'}
                {effectiveTab === 'analytics' && 'رصد لحظي للزوار في آخر 24 ساعة، المسجلين الجدد، قراءات المقالات، والأجهزة المستخدمة'}
                {effectiveTab === 'money' && 'إدارة طلبات السحب، شحن الأرصدة، تحرير الأرباح المجمّدة، وتدقيق مبيعات المقالات'}
                {effectiveTab === 'campaigns' && 'حوكمة حملات المعلنين (CPC/CPM)، طلبات ترويج المقالات، وإعدادات الشبكات الإعلانية الخارجية'}
                {effectiveTab === 'moderation' && 'مراجعة وتدقيق المقالات المنشورة، أرشفة المخالف، وإدارة المقالات الحصرية'}
                {effectiveTab === 'users' && 'سجل الأعضاء، تدقيق بطاقات الهوية الرسمية KYC، وتعديل الصلاحيات والأرصدة'}
                {effectiveTab === 'fraud' && 'رصد النقر الذاتي والبوتات، حماية ميزانيات المعلنين وعوائد المنصة، وحظر المعتدين'}
                {effectiveTab === 'settings' && 'تخصيص السمة البصرية، خلفيات القالب، والاطلاع على نسب تقاسم الأرباح'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] text-slate-500 font-mono">
              قسم متخصص: <span className="text-slate-300 font-bold">{effectiveTab}</span>
            </span>
          </div>
        </div>

        {effectiveTab === 'overview' && (
          <AdminOverviewTab
            currentUser={currentUser}
            users={users}
            articles={articles}
            campaigns={campaigns}
            fraudFlags={fraudFlags}
            promotions={promotions}
            depositRequests={depositRequests}
            payoutRequests={payoutRequests}
            purchaseRequests={purchaseRequests}
            adEvents={adEvents}
            onNavigateTab={handleNavigate}
            metrics={metrics}
          />
        )}

        {effectiveTab === 'analytics' && (
          <AdminAnalyticsTab
            users={users}
            articles={articles}
            campaigns={campaigns}
            onSelectUser={onSelectUser}
            onSelectArticle={onSelectArticle}
          />
        )}

        {effectiveTab === 'money' && (
          <AdminFinanceTab
            users={users}
            campaigns={campaigns}
            depositRequests={depositRequests}
            payoutRequests={payoutRequests}
            purchaseRequests={purchaseRequests}
            adEvents={adEvents}
            earningsRecords={earningsRecords}
            initialSubTab={financeSubTab}
            onUpdateMoneyRequest={onUpdateMoneyRequest}
            onUpdatePurchaseRequest={onUpdatePurchaseRequest}
            onReleaseEarning={onReleaseEarning}
            onProcessAdEvents={onProcessAdEvents}
            onOpenAdjustBalance={(u) => setSelectedUserForBalance(u)}
          />
        )}

        {effectiveTab === 'campaigns' && (
          <AdminAdsTab
            campaigns={campaigns}
            promotions={promotions}
            users={users}
            platformAdsEnabled={platformAdsEnabled}
            onTogglePlatformAds={onTogglePlatformAds}
            externalAdsConfig={externalAdsConfig}
            onSaveExternalAdsConfig={onSaveExternalAdsConfig}
            onUpdateCampaignStatus={onUpdateCampaignStatus}
            onUpdatePromotionStatus={onUpdatePromotionStatus}
            initialSubTab={adsSubTab}
          />
        )}

        {effectiveTab === 'moderation' && (
          <AdminContentTab
            articles={articles}
            users={users}
            onSelectArticle={onSelectArticle}
            onUpdateArticleStatus={onUpdateArticleStatus}
          />
        )}

        {effectiveTab === 'users' && (
          <AdminUsersTab
            users={users}
            currentUser={currentUser}
            onUpdateUserRole={onUpdateUserRole}
            onToggleUserVerified={onToggleUserVerified}
            onApproveKyc={onApproveKyc}
            onBanUser={onBanUser}
            onSelectUser={onSelectUser}
            onBroadcastMessage={onBroadcastMessage}
            onOpenAdjustBalance={(u) => setSelectedUserForBalance(u)}
            onOpenKycReview={(u) => setSelectedUserForKyc(u)}
          />
        )}

        {effectiveTab === 'fraud' && (
          <AdminFraudTab
            fraudFlags={fraudFlags}
            users={users}
            onResolveFraudFlag={onResolveFraudFlag}
            onBanUser={onBanUser}
            totalBlockedFraudRevenue={metrics.totalBlockedFraudRevenue}
          />
        )}

        {effectiveTab === 'settings' && (
          <AdminSettingsTab
            currentThemePreset={currentThemePreset}
            onChangeThemePreset={onChangeThemePreset}
            currentBackgroundPreset={currentBackgroundPreset}
            onChangeBackgroundPreset={onChangeBackgroundPreset}
          />
        )}
      </main>

      {/* Manual Balance Adjustment Modal */}
      <BalanceAdjustModal
        isOpen={Boolean(selectedUserForBalance)}
        user={selectedUserForBalance}
        onClose={() => setSelectedUserForBalance(null)}
        onAdjustBalance={onAdjustBalance}
      />

      {/* KYC Review Modal */}
      <KycReviewModal
        isOpen={Boolean(selectedUserForKyc)}
        user={selectedUserForKyc}
        onClose={() => setSelectedUserForKyc(null)}
        onApproveKyc={onApproveKyc}
      />
    </div>
  );
};
