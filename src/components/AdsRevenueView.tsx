import React, { useState } from 'react';
import {
  Megaphone,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  Sparkles,
  ShieldCheck,
  Zap,
  Layers,
  ArrowUpRight,
  Plus,
  Play,
  CheckCircle2,
  HelpCircle,
  Calculator,
  Wallet
} from 'lucide-react';
import { AdCampaign, User } from '../types';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface AdsRevenueViewProps {
  currentUser: User;
  campaigns: AdCampaign[];
  onCreateCampaign: (campaignData: Partial<AdCampaign>) => void;
  onOpenWallet: () => void;
  onSwitchRole?: (role: 'writer' | 'advertiser' | 'reader') => void;
}

export const AdsRevenueView: React.FC<AdsRevenueViewProps> = ({
  currentUser,
  campaigns,
  onCreateCampaign,
  onOpenWallet,
  onSwitchRole
}) => {
  const [estimatedViews, setEstimatedViews] = useState<number>(25000);
  const [lockedArticlesSales, setLockedArticlesSales] = useState<number>(50);
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newBudget, setNewBudget] = useState('50');

  // Profit calculations based on project specifications:
  // AdSense writer split, CPM ~$2.50
  const estimatedAdSenseEarnings = (estimatedViews / 1000) * 2.5 * REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;
  // Locked articles writer split ($2.99 average)
  const estimatedLockedEarnings = lockedArticlesSales * 2.99 * REVENUE_SHARES.LOCKED_ARTICLES.WRITER;
  const totalEstimatedEarnings = estimatedAdSenseEarnings + estimatedLockedEarnings;

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateCampaign({
      title: newTitle,
      targetUrl: newUrl || 'https://literium.app',
      budget: parseFloat(newBudget) || 50,
      cpcRate: 0.25,
      placement: 'in_feed',
      status: 'active'
    });

    setNewTitle('');
    setNewUrl('');
    setIsCreatingModalOpen(false);
    alert('تم إطلاق حملتك الإعلانية بنجاح!');
  };

  return (
    <div className="space-y-6 animate-android-in pb-16">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 text-white p-5 sm:p-7 shadow-lg relative overflow-hidden border border-teal-500/20">
        <div className="absolute -end-10 -bottom-10 w-48 h-48 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 backdrop-blur-md text-teal-300 text-xs font-bold border border-teal-500/30">
              <Megaphone className="w-3.5 h-3.5" />
              <span>منظومة إعلانات Google AdSense ونموذج تقاسم الأرباح</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">
              أرباحك وحملاتك الإعلانية في المنصة
            </h2>
            <p className="text-xs sm:text-sm text-teal-200/80 max-w-xl leading-relaxed">
              يحصل الكاتب على {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% من إجمالي أرباح Google AdSense و {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% من مبيعات المقالات المدفوعة، مع خيارات ترويجية متقدمة للمعلنين.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenWallet}
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-white text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all touch-manipulation hover:bg-teal-50"
            >
              <Wallet className="w-4 h-4 text-teal-600" />
              <span>رصيد المحفظة: {(currentUser.totalEarnings || 0).toFixed(2)}$</span>
            </button>

            <button
              onClick={() => setIsCreatingModalOpen(true)}
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all touch-manipulation"
            >
              <Plus className="w-4 h-4" />
              <span>إطلاق إعلان</span>
            </button>
          </div>
        </div>
      </div>

      {/* Revenue Sharing Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              نسبة الكاتب من AdSense
            </span>
            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center font-black text-xs">
              {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%
            </span>
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            حصة الكاتب المباشرة
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% مخصصة لسيرفرات المنصة وتطوير خوارزميات الذكاء الاصطناعي.
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              مبيعات المقالات المقفولة
            </span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-black text-xs">
              {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%
            </span>
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            أعلى عائد للكاتب
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            عمولة المنصة {REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}% فقط لمعالجة بوابات الدفع الإلكتروني.
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              سحب الأرباح التلقائي
            </span>
            <span className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 flex items-center justify-center font-black text-xs">
              20$
            </span>
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            الحد الأدنى للسحب
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            تحويل بنكي، PayPal، أو محفظة العملات الرقمية USDT.
          </p>
        </div>
      </div>

      {/* Interactive Revenue Calculator */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-teal-600" />
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              حاسبة العوائد التقديرية للكاتب
            </h3>
            <p className="text-xs text-slate-500">
              قم بتحريك المؤشرات لمعرفة الأرباح المتوقعة من مقالاتك شهرياً
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-700 dark:text-slate-300">
                المشاهدات الشهرية لمقالاتك:
              </span>
              <span className="text-teal-600 dark:text-teal-400 text-sm font-black">
                {estimatedViews.toLocaleString('ar-EG')} مشاهدة
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max="200000"
              step="1000"
              value={estimatedViews}
              onChange={(e) => setEstimatedViews(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-700 dark:text-slate-300">
                مبيعات المقالات الحصرية المقفولة:
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-black">
                {lockedArticlesSales} مشتري
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="5"
              value={lockedArticlesSales}
              onChange={(e) => setLockedArticlesSales(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
            />
          </div>

          {/* Calculator Output Result */}
          <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs text-teal-900 dark:text-teal-200 font-bold">
                صافي أرباحك المقدرة لحسابك:
              </p>
              <p className="text-[11px] text-teal-700 dark:text-teal-400">
                ({estimatedAdSenseEarnings.toFixed(2)}$ من AdSense + {estimatedLockedEarnings.toFixed(2)}$ من المقالات المقفولة)
              </p>
            </div>

            <div className="text-2xl sm:text-3xl font-black text-teal-700 dark:text-teal-300 tabular-nums">
              {totalEstimatedEarnings.toFixed(2)}$
            </div>
          </div>
        </div>
      </div>

      {/* Active Campaigns Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-teal-600" />
            <span>الحملات الإعلانية الحالية ({campaigns.length})</span>
          </h3>

          <button
            onClick={() => setIsCreatingModalOpen(true)}
            className="text-xs font-bold text-teal-600 hover:text-teal-700"
          >
            + إضافة إعلان جديد
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {campaigns.map((camp) => (
            <div
              key={camp.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[10px] font-bold mb-1">
                    {camp.placement === 'in_feed' ? 'إعلان داخل الخلاصة' : 'بانر في أسفل المقال'}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {camp.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                    {camp.targetUrl}
                  </p>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    camp.status === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {camp.status === 'active' ? 'نشط' : 'متوقف'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">النقرات</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {camp.clicksCount}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">المشاهدات</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {camp.impressionsCount}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">الميزانية المصروفة</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">
                    {camp.totalSpent.toFixed(2)}$ / {camp.budget}$
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Launch Ad Modal */}
      {isCreatingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-android-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              إطلاق حملة إعلانية جديدة
            </h3>

            <form onSubmit={handleQuickCreate} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  عنوان الإعلان / الحملة
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: دورة الكتابة الإبداعية والتحليل الأدبي"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  رابط الوجهة (URL)
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm dir-ltr"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  الميزانية الإجمالية ($)
                </label>
                <input
                  type="number"
                  min="10"
                  max="10000"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md"
                >
                  بدء الحملة الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
