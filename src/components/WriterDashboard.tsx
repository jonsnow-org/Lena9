import React, { useState } from 'react';
import {
  PenTool,
  Rocket,
  TrendingUp,
  Eye,
  Heart,
  DollarSign,
  Lock,
  Sparkles,
  ArrowUpRight,
  Plus,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Zap,
  BarChart2,
  FileText,
  Wallet
} from 'lucide-react';
import { Article, User, ArticlePromotion } from '../types';
import { SmartAiGuidanceCard } from './SmartAiGuidanceCard';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { MIN_PAYOUT_USD, EARNINGS_HOLD_DAYS } from '../constants/payoutRules';
import { timeAgoAr } from '../utils/dateFormat';
import { getCreatorEligibility } from '../utils/creatorEligibility';
import { CreatorEligibilityCard } from './CreatorEligibilityCard';

interface WriterDashboardProps {
  writer: User;
  articles: Article[];
  onOpenArticleEditor: (article?: Article) => void;
  onOpenWallet: () => void;
  onOpenKyc?: () => void;
  onSelectArticle: (article: Article) => void;
  onDeleteArticle?: (articleId: string) => void;
  onPromoteArticle?: (article: Article) => void;
  promotions?: ArticlePromotion[];
  /** عدد المتابعين الحقيقي المحسوب من مجموعة follows الفعلية — بخلاف
   *  writer.followersCount المخزَّن الذي لا يُحدَّث أبداً من أي مسار
   *  ويبقى صفراً دائماً. */
  followersCount?: number;
}

export const WriterDashboard: React.FC<WriterDashboardProps> = ({
  writer,
  articles,
  onOpenArticleEditor,
  onOpenWallet,
  onOpenKyc,
  onSelectArticle,
  onDeleteArticle,
  onPromoteArticle,
  promotions = [],
  followersCount
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'articles' | 'revenue' | 'payouts'>('overview');

  const realFollowersCount = followersCount ?? writer.followersCount ?? 0;
  const eligibility = getCreatorEligibility(writer, articles, realFollowersCount);
  const writerArticles = articles.filter((a) => a.writerId === writer.id);
  const totalViews = writerArticles.reduce((acc, a) => acc + a.viewsCount, 0);
  const totalLikes = writerArticles.reduce((acc, a) => acc + a.likesCount, 0);
  const totalSalesRevenue = writerArticles.reduce((acc, a) => acc + (a.revenueFromSales || 0), 0);
  const totalAdsRevenue = writerArticles.reduce((acc, a) => acc + (a.revenueFromAds || 0), 0);
  const grandTotal = totalSalesRevenue + totalAdsRevenue;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-brand-950 via-slate-900 to-brand-950 text-white shadow-2xl border border-brand-500/30">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300">
              <PenTool className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black">استوديو الكاتب والمؤلف</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            أهلاً بك {writer.fullName}، تابع تفاعل القراء ومشاركتك في عوائد الإعلانات ({REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%) والمبيعات ({REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenWallet}
            className="px-4 py-2.5 rounded-2xl bg-brand-900/40 hover:bg-brand-900/70 border border-brand-500/40 text-brand-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>الأرباح: ${grandTotal.toFixed(2)}</span>
          </button>

          <button
            onClick={() => onOpenArticleEditor()}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-600 hover:from-brand-500 hover:to-brand-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-600/30 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>كتابة مقال جديد</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-brand-500/20 overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'الإحصائيات العامة', icon: TrendingUp },
          { id: 'articles', label: `مقالاتي ومسوداتي (${writerArticles.length})`, icon: BookOpen },
          { id: 'revenue', label: 'تفاصيل الأرباح والإعلانات', icon: DollarSign },
          { id: 'payouts', label: 'السحب والتحويل المالي', icon: Wallet }
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

      {/* Tab 1: Overview */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Smart AI Writer Guidance */}
          <SmartAiGuidanceCard context="article_editor" />

          {/* شروط تفعيل احتساب الأرباح / شارة منشئ المحتوى الموثّق (للكُتّاب فقط وليس لمدير المنصة) */}
          {writer.role !== 'admin' && (
            <CreatorEligibilityCard eligibility={eligibility} onOpenKyc={onOpenKyc} />
          )}

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">إجمالي القراءات</span>
                <Eye className="w-4 h-4 text-brand-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {totalViews.toLocaleString('ar-EG')}
              </p>
              <span className="text-[10px] text-emerald-400 font-bold">مشاهدات حقيقية مؤكدة</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">المتابعون</span>
                <Heart className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {realFollowersCount.toLocaleString('ar-EG')}
              </p>
              <span className="text-[10px] text-brand-400 font-bold">جمهور متفاعل</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">عوائد المقالات الحصرية</span>
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                ${totalSalesRevenue.toFixed(2)}
              </p>
              <span className="text-[10px] text-amber-400 font-bold">حصة الكاتب {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/20 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold">عوائد إعلانات AdSense والمعلنين</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                ${totalAdsRevenue.toFixed(2)}
              </p>
              <span className="text-[10px] text-emerald-400 font-bold">حصة الكاتب {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%</span>
            </div>
          </div>

          {/* Quick List of recent articles */}
          <div className="rounded-3xl bg-slate-900 border border-brand-500/20 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-400" />
                <span>أحدث المقالات المنشورة</span>
              </h3>
              <button
                onClick={() => setActiveSubTab('articles')}
                className="text-xs font-bold text-brand-400 hover:underline"
              >
                عرض كل المقالات ({writerArticles.length})
              </button>
            </div>

            <div className="space-y-3">
              {writerArticles.slice(0, 3).map((art) => (
                <div
                  key={art.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-brand-500/15 bg-slate-950/60 hover:border-brand-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={art.featuredImage || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80'}
                      alt={art.title}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          onClick={() => onSelectArticle(art)}
                          className="font-bold text-sm text-white hover:text-brand-300 cursor-pointer"
                        >
                          {art.title}
                        </h4>
                        {art.status === 'draft' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                            مسودة
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {art.viewsCount} قراءة
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-rose-400" />
                          {art.likesCount} إعجاب
                        </span>
                        <span className="text-emerald-400 font-bold">
                          +${((art.revenueFromAds || 0) + (art.revenueFromSales || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => onOpenArticleEditor(art)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => onSelectArticle(art)}
                      className="px-3 py-1.5 rounded-xl bg-brand-600/30 hover:bg-brand-600/50 text-brand-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>عرض</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Articles & Drafts */}
      {activeSubTab === 'articles' && (
        <div className="rounded-3xl bg-slate-900 border border-brand-500/20 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-400" />
              <span>إدارة كافة المقالات والمسودات</span>
            </h3>
            <button
              onClick={() => onOpenArticleEditor()}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>مقال جديد</span>
            </button>
          </div>

          <div className="space-y-3">
            {writerArticles.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-brand-500/10">
                <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-300 font-bold text-sm">لم تنشر أي مقالات بعد</p>
                <button
                  onClick={() => onOpenArticleEditor()}
                  className="mt-3 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold"
                >
                  ابدأ كتابة أول مقال
                </button>
              </div>
            ) : (
              writerArticles.map((art) => (
                <div
                  key={art.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl border border-brand-500/15 bg-slate-950/60 hover:border-brand-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={art.featuredImage || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80'}
                      alt={art.title}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          onClick={() => onSelectArticle(art)}
                          className="font-bold text-sm text-white hover:text-brand-300 cursor-pointer"
                        >
                          {art.title}
                        </h4>
                        {art.status === 'draft' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                            مسودة
                          </span>
                        ) : art.isLocked ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            مقفل (${art.lockedPrice || 3})
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            منشور ومفتوح
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5">
                        <span>{art.category}</span>
                        <span>•</span>
                        <span>{timeAgoAr(art.publishedAt)}</span>
                        <span>•</span>
                        <span>{art.viewsCount || 0} قراءة</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => onOpenArticleEditor(art)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                      title="تعديل المقال"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSelectArticle(art)}
                      className="px-3 py-1.5 rounded-xl bg-brand-600/30 hover:bg-brand-600/50 text-brand-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>عرض</span>
                    </button>
                    {onPromoteArticle && (
                      <button
                        onClick={() => onPromoteArticle(art)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5"
                        title="ترويج المقال في الصفحة الرئيسية"
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        <span>ترويج</span>
                      </button>
                    )}
                    {onDeleteArticle && (
                      <button
                        onClick={() => onDeleteArticle(art.id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold"
                        title="حذف المقال"
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

      {/* Tab 3: Revenue Breakdown */}
      {activeSubTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-6 rounded-3xl bg-slate-900 border border-brand-500/20 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">إعلانات Google AdSense والمعلنين ({REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%)</h3>
                </div>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  ${totalAdsRevenue.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                يتم احتساب أرباح ظهور الإعلانات والنقرات الصالحة داخل مقالاتك بنسبة {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% لصالحك و{REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% للمنصة. الحساب يتم بعد فحص المشاهدة عبر خوارزمية Viewability (بقاء 50% من الإعلان لمدة ثانية كاملة).
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-brand-500/20 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">مبيعات المقالات الحصرية ({REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%)</h3>
                </div>
                <span className="text-xl font-black text-amber-400 font-mono">
                  ${totalSalesRevenue.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                عند قفل مقالك وتحديد سعر شراء، تذهب {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% من قيمة كل عملية شراء مباشرة لمحفظتك، وتقتطع المنصة {REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}% فقط لتغطية رسوم البوابات الرقمية والسيرفرات.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-brand-500/20 shadow-sm text-center">
            <h4 className="text-sm font-bold text-white mb-2">إجمالي الأرباح المستحقة للسحب</h4>
            <div className="text-3xl font-black text-emerald-400 font-mono mb-4">
              ${grandTotal.toFixed(2)}
            </div>
            <button
              onClick={onOpenWallet}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-600 text-white font-bold text-sm shadow-lg shadow-brand-600/30"
            >
              طلب سحب الأرباح (USDT / تحويل بنكي)
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Payouts */}
      {activeSubTab === 'payouts' && (
        <div className="rounded-3xl bg-slate-900 border border-brand-500/20 p-6 shadow-sm space-y-4">
          <SmartAiGuidanceCard context="wallet_payout" />
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-brand-400" />
              <span>إدارة المحفظة وطلبات السحب</span>
            </h3>
            <button
              onClick={onOpenWallet}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs"
            >
              فتح المحفظة
            </button>
          </div>
          <p className="text-xs text-slate-300">
            الحد الأدنى لطلب السحب هو ${MIN_PAYOUT_USD}، وتخضع الأرباح لفترة تجميد {EARNINGS_HOLD_DAYS} يوماً من تاريخ تسجيلها قبل أن تصبح قابلة للسحب. تتم مراجعة الطلبات واعتمادها يدوياً من فريق الإدارة عبر شبكة USDT TRC20 أو الحسابات البنكية المحلية المعتمدة.
          </p>
        </div>
      )}
    </div>
  );
};
