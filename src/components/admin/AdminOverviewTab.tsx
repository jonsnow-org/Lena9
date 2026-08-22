import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Megaphone,
  BadgePercent,
  ShieldCheck,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ArrowRight,
  Sparkles,
  Users,
  FileText
} from 'lucide-react';
import { User, Article, AdCampaign, FraudFlag, ArticlePromotion } from '../../types';
import { REVENUE_SHARES } from '../../constants/revenueShares';

interface AdminOverviewTabProps {
  currentUser: User;
  users: User[];
  articles: Article[];
  campaigns: AdCampaign[];
  fraudFlags: FraudFlag[];
  promotions?: ArticlePromotion[];
  depositRequests?: any[];
  payoutRequests?: any[];
  purchaseRequests?: any[];
  adEvents?: any[];
  onNavigateTab: (tab: string, subTab?: string) => void;
  metrics: {
    totalPlatformAdRevenue: number;
    totalWriterAdRevenue: number;
    platformAdSenseCut: number;
    writersAdSenseCut: number;
    totalLockedArticlesSales: number;
    platformSalesCut: number;
    writersSalesCut: number;
    netPlatformRevenue: number;
    totalBlockedFraudRevenue: number;
  };
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  users,
  articles,
  campaigns,
  fraudFlags,
  promotions = [],
  depositRequests = [],
  payoutRequests = [],
  purchaseRequests = [],
  adEvents = [],
  onNavigateTab,
  metrics
}) => {
  const pendingPayouts = payoutRequests.filter((r: any) => r.status === 'pending');
  const pendingDeposits = depositRequests.filter((r: any) => r.status === 'pending');
  const pendingPurchases = purchaseRequests.filter((r: any) => r.status === 'pending');
  const pendingKycUsers = users.filter((u) => u.kycDetails?.status === 'pending');
  const pendingCampaigns = campaigns.filter((c) => c.status === 'pending' || (c as any).status === 'draft');
  const pendingPromotions = promotions.filter((p) => p.status === 'pending');
  const unprocessedEvents = adEvents.filter((e: any) => !e.processed);

  const totalActionItems =
    pendingPayouts.length +
    pendingDeposits.length +
    pendingPurchases.length +
    pendingKycUsers.length +
    pendingCampaigns.length +
    pendingPromotions.length +
    (unprocessedEvents.length > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Quick Action Center Banner if there are items pending */}
      {totalActionItems > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-brand-950/40 border border-amber-500/30 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  مركز المهام العاجلة
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500 text-slate-950">
                    {totalActionItems} إجراءات معلقة
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  هناك طلبات سحب، إيداع، توثيق هوية، أو حملات تنتظر مراجعتك واعتمادك.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pendingPayouts.length > 0 && (
                <button
                  onClick={() => onNavigateTab('money', 'payouts')}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
                >
                  سحب أرباح ({pendingPayouts.length})
                </button>
              )}
              {pendingDeposits.length > 0 && (
                <button
                  onClick={() => onNavigateTab('money', 'deposits')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all"
                >
                  إيداعات معلقة ({pendingDeposits.length})
                </button>
              )}
              {pendingKycUsers.length > 0 && (
                <button
                  onClick={() => onNavigateTab('users')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-bold border border-blue-500/30 transition-all"
                >
                  فحص KYC ({pendingKycUsers.length})
                </button>
              )}
              {pendingCampaigns.length > 0 && (
                <button
                  onClick={() => onNavigateTab('campaigns', 'ad_campaigns')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-brand-300 text-xs font-bold border border-brand-500/30 transition-all"
                >
                  حملات جديدة ({pendingCampaigns.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Platform Revenue */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-brand-950/40 border border-brand-500/20 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">إجمالي دخل المنصة الصافي</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            ${metrics.netPlatformRevenue.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            شامل إعلانات المنصة 100% + حصة الكُتّاب 45% + المبيعات 15%
          </div>
        </div>

        {/* Platform Ads (100%) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">إعلانات المنصة العامة (100%)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            ${metrics.totalPlatformAdRevenue.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            عائدات كاملة للمالك بدون أي تقاسم
          </div>
        </div>

        {/* Writer Ads Platform Share */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">
              إعلانات الكُتّاب التشاركية ({REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BadgePercent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            ${metrics.platformAdSenseCut.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            وحصل الكُتّاب على ${metrics.writersAdSenseCut.toFixed(2)} ({REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%)
          </div>
        </div>

        {/* Blocked Fraud Shield */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-amber-500/20 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">أموال محمية بدرع الاحتيال</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
            ${metrics.totalBlockedFraudRevenue.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-amber-300/80">
            {fraudFlags.length} محاولات محجوبة آلياً
          </div>
        </div>
      </div>

      {/* Dual System Revenue Architecture Visualizer */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-brand-500/20 shadow-xl">
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
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>تظهر في الصفحة الرئيسية، الاستكشاف، وتغذية المنشورات العامة.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>لا تخضع لمشاركة الأرباح، وإيراداتها تذهب كاملة للمنصة.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>تدعم الحجز الثابت (Fixed) ورعاية الأقسام والشبكات الخارجية.</span>
              </li>
            </ul>
            <div className="p-3 rounded-lg bg-slate-900/80 text-xs flex items-center justify-between">
              <span className="text-slate-400">إجمالي إيراد المنصة من هذا الباب:</span>
              <span className="font-bold text-white font-mono">
                ${metrics.totalPlatformAdRevenue.toFixed(2)}
              </span>
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
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>داخل مقالات الكاتب (55% للكاتب / 45% للمنصة) وملفه الشخصي (50% / 50%).</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>مبيعات المقالات الحصرية المقفولة: 85% للكاتب / 15% للمنصة.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>محمية بالكامل بدرع منع النقر الذاتي (Self-Click) والتحقق الزمني.</span>
              </li>
            </ul>
            <div className="p-3 rounded-lg bg-slate-900/80 text-xs flex items-center justify-between">
              <span className="text-slate-400">إجمالي المولد للكُتّاب:</span>
              <span className="font-bold text-emerald-400 font-mono">
                ${metrics.writersAdSenseCut.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Security Incidents */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              أحدث إنذارات مكافحة الاحتيال
            </h4>
            <button
              onClick={() => onNavigateTab('fraud')}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              عرض الكل ({fraudFlags.length})
            </button>
          </div>

          {fraudFlags.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/60 text-center text-xs text-slate-400">
              الدرع نشط ومستقر — لا توجد إنذارات احتيال حالياً.
            </div>
          ) : (
            <div className="space-y-2.5">
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
                    <div className="text-[11px] text-slate-400 font-mono">
                      IP: {flag.userIp} • {flag.detectedAt}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[11px]">
                    تم الحجب
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Platform Metrics */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-400" />
              إحصائيات المجتمع والمحتوى
            </h4>
            <span className="text-xs text-slate-400">مباشر</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Users className="w-3.5 h-3.5 text-brand-400" />
                <span>إجمالي المستخدمين</span>
              </div>
              <div className="text-xl font-black text-white font-mono">{users.length}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                {users.filter((u) => u.role === 'writer').length} كتاب • {users.filter((u) => u.role === 'advertiser').length} معلنين
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>إجمالي المقالات</span>
              </div>
              <div className="text-xl font-black text-white font-mono">{articles.length}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                {articles.filter((a) => a.isLocked).length} حصرية مقفولة
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                <span>الحملات الإعلانية</span>
              </div>
              <div className="text-xl font-black text-white font-mono">{campaigns.length}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                {campaigns.filter((c) => c.status === 'active').length} نشطة حالياً
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>الموثقون رسمياً</span>
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {users.filter((u) => u.isVerified || u.isKycVerified).length}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">حسابات موثقة بالكامل</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
