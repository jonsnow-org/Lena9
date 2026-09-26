import React, { useState } from 'react';
import {
  Megaphone,
  PlusCircle,
  TrendingUp,
  Eye,
  MousePointerClick,
  DollarSign,
  Play,
  Pause,
  Clock,
  Sparkles,
  ExternalLink,
  Target,
  ShieldCheck,
  ShieldAlert,
  Zap,
  CheckCircle2,
  BarChart3,
  Layers,
  HelpCircle,
  Trash2
} from 'lucide-react';
import { AdCampaign } from '../types';
import { SmartAiGuidanceCard } from './SmartAiGuidanceCard';
import { REVENUE_SHARES, WRITER_MONETIZATION_ENABLED } from '../constants/revenueShares';

interface AdvertiserDashboardProps {
  campaigns: AdCampaign[];
  onOpenNewCampaign: () => void;
  onToggleCampaignStatus: (campaignId: string) => void;
  onDeleteCampaign?: (campaignId: string) => void;
  advertiserBalance: number;
  onOpenDeposit: () => void;
  activeUsersCount?: number;
}

export const AdvertiserDashboard: React.FC<AdvertiserDashboardProps> = ({
  campaigns,
  onOpenNewCampaign,
  onToggleCampaignStatus,
  onDeleteCampaign,
  advertiserBalance,
  onOpenDeposit,
  activeUsersCount
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'analytics' | 'billing'>('campaigns');

  const totalImpressions = campaigns.reduce((acc, c) => acc + c.impressionsCount, 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + c.clicksCount, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.totalSpent, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  // كانت تقرأ camp.fraudBlockedCount — حقل غير موجود إطلاقاً في AdCampaign
  // (types.ts يعرّف blockedFraudClicks فقط)، فتظهر البطاقة صفراً دائماً
  // مهما بلغ عدد النقرات المحظورة فعلياً.
  const totalFraudBlocked = campaigns.reduce((acc, c) => acc + (c.blockedFraudClicks || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-brand-950 via-slate-900 to-brand-950 text-white shadow-2xl border border-brand-500/30">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300">
              <Megaphone className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black">لوحة تحكم المعلن والحملات الإعلانية</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            أطلق إعلاناتك بنماذج تسعير ذكية (Fixed / CPM / CPC) مع حماية فائقة ضد النقرات الوهمية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDeposit}
            className="px-4 py-2.5 rounded-2xl bg-brand-900/40 hover:bg-brand-900/70 border border-brand-500/40 text-brand-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>الرصيد: ${advertiserBalance.toFixed(2)}</span>
          </button>

          <button
            onClick={onOpenNewCampaign}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-600 hover:from-brand-500 hover:to-brand-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-600/30 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إنشاء حملة جديدة</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-brand-500/20 overflow-x-auto scrollbar-none">
        {[
          { id: 'campaigns', label: `الحملات النشطة (${campaigns.length})`, icon: Megaphone },
          { id: 'analytics', label: 'تقارير الأداء ومكافحة الاحتيال', icon: BarChart3 },
          { id: 'billing', label: 'الميزانية وشحن الرصيد', icon: DollarSign }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* AI Guidance for Campaign Strategy */}
      <SmartAiGuidanceCard context="campaign_creation" />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold">إجمالي الظهور الصالح</span>
            <Eye className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">
            {totalImpressions.toLocaleString('ar-EG')}
          </p>
          <span className="text-[10px] text-emerald-400 font-bold">فحص بقاء 50% لأكثر من 1ث</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold">النقرات المؤكدة</span>
            <MousePointerClick className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">
            {totalClicks.toLocaleString('ar-EG')}
          </p>
          <span className="text-[10px] text-brand-300 font-bold">معدل النقر {avgCtr}%</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold">النقرات المشبوهة المحجوبة</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-400">
            {totalFraudBlocked.toLocaleString('ar-EG')}
          </p>
          <span className="text-[10px] text-emerald-400 font-bold">تم توفير ميزانيتك 100%</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold">إجمالي الإنفاق الفعلي</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            ${totalSpent.toFixed(2)}
          </p>
          <span className="text-[10px] text-brand-300 font-bold">من أصل ${campaigns.reduce((a, c) => a + c.totalBudget, 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Main Tab 1: Campaigns List */}
      {activeSubTab === 'campaigns' && (
        <div className="rounded-3xl bg-slate-900 border border-brand-500/20 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-brand-400" />
              <span>إدارة الحملات الإعلانية ومعدلات الأمان</span>
            </h3>

            <button
              onClick={onOpenNewCampaign}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إنشاء حملة جديدة</span>
            </button>
          </div>

          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-brand-500/10">
                <Megaphone className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-300 font-bold text-sm">لا توجد حملات إعلانية منشأة بعد</p>
                <button
                  onClick={onOpenNewCampaign}
                  className="mt-3 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold"
                >
                  إنشاء أول إعلان الآن
                </button>
              </div>
            ) : (
              campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 rounded-2xl border border-brand-500/15 bg-slate-950/60 hover:border-brand-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={camp.imageUrl}
                      alt={camp.campaignName}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white">{camp.campaignName}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            camp.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : camp.status === 'paused'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {camp.status === 'active' ? 'نشطة 🟢' : camp.status === 'paused' ? 'متوقفة مؤقتاً ⏸️' : 'مكتملة'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-bold">
                          {camp.pricingModel === 'fixed' ? 'ثابت (مدة)' : camp.pricingModel === 'cpm' ? 'CPM (ظهور)' : 'CPC (نقرات)'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-bold">
                          {camp.placementType === 'platform' ? 'إعلان المنصة (100%)' : WRITER_MONETIZATION_ENABLED ? `إعلان مقالات الكُتّاب (${REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}/${REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT})` : 'إعلان داخل المقالات'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mt-1 line-clamp-1">{camp.adText}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                        <span className="text-brand-300">الظهور: {camp.impressionsCount}</span>
                        <span className="text-cyan-300">النقرات: {camp.clicksCount}</span>
                        <span className="text-emerald-400">الإنفاق: ${camp.totalSpent.toFixed(2)} / ${camp.totalBudget.toFixed(2)}</span>
                        {camp.blockedFraudClicks !== undefined && camp.blockedFraudClicks > 0 && (
                          <span className="text-rose-400 font-bold">حظر {camp.blockedFraudClicks} نقرة مشبوهة 🛡️</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => onToggleCampaignStatus(camp.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        camp.status === 'active'
                          ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                      }`}
                    >
                      {camp.status === 'active' ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>إيقاف</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>تفعيل</span>
                        </>
                      )}
                    </button>

                    <a
                      href={camp.destinationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                      title="معاينة الرابط"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {onDeleteCampaign && (
                      <button
                        onClick={() => onDeleteCampaign(camp.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                        title="حذف الحملة نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Tab 2: Analytics & Anti-Fraud */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-brand-500/20 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">درع الحماية ومكافحة الاحتيال الإعلاني</h3>
                  <p className="text-xs text-slate-400">قواعد آلية للتحقق من صحة النقرات والمشاهدات قبل احتسابها</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                الحماية مفعلة ونشطة
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-brand-500/15">
                <span className="text-xs font-bold text-brand-300 block mb-1">فحص الرؤية (Viewability)</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  لا تُخصم أي ميزانية لنموذج CPM إلا بعد ثبات 50% من مساحة الإعلان في شاشة القارئ لثانية متصلة.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-brand-500/15">
                <span className="text-xs font-bold text-cyan-300 block mb-1">منع النقر الذاتي (Anti Self-Click)</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  حظر فوري لأي نقرات يقوم بها صاحب المقال على إعلاناتك، وحماية ميزانيتك من الهدر.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-brand-500/15">
                <span className="text-xs font-bold text-rose-300 block mb-1">كشف البوتات والنقرات المتسارعة</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  استبعاد النقرات التي تحدث في أقل من 1.5 ثانية من فتح الصفحة وفلترة الزيارات الآلية.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 3: Billing */}
      {activeSubTab === 'billing' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-brand-500/20 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">رصيد الإعلانات والفوترة</h3>
              <p className="text-xs text-slate-400">اشحن رصيدك عبر البطاقات البنكية، Apple Pay، أو USDT TRC20</p>
            </div>

            <button
              onClick={onOpenDeposit}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-600 text-white font-bold text-xs shadow-lg shadow-brand-600/30"
            >
              شحن الرصيد الآن
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-slate-950 border border-brand-500/15 text-center">
            <span className="text-xs text-slate-400 block mb-1">الرصيد المتاح حالياً</span>
            <div className="text-3xl font-black text-emerald-400 font-mono mb-2">
              ${advertiserBalance.toFixed(2)}
            </div>
            <p className="text-xs text-slate-300">يتم السحب تلقائياً من الرصيد مع كل ظهور أو نقرة مؤكدة وصالحة فقط</p>
          </div>
        </div>
      )}

    </div>
  );
};
