import React from 'react';
import { Sparkles, Calendar, Eye, Lock, ArrowLeft, Star, Bookmark } from 'lucide-react';
import { Article } from '../types';
import { timeAgoAr } from '../utils/dateFormat';

interface FeaturedArticlesSectionProps {
  articles?: Article[];
  onSelectArticle: (article: Article) => void;
  onBookmark?: (articleId: string) => void;
  bookmarkedIds?: string[];
}

export const FeaturedArticlesSection: React.FC<FeaturedArticlesSectionProps> = ({
  articles = [],
  onSelectArticle,
  onBookmark,
  bookmarkedIds = []
}) => {
  const safeArticles = Array.isArray(articles) ? articles : [];
  // Pick featured articles (e.g. high rating or specific IDs)
  const featured = safeArticles.slice(0, 4);

  if (featured.length === 0) return null;

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'literature': return 'الأدب والشعر';
      case 'technology': return 'التقنية والذكاء الاصطناعي';
      case 'history': return 'التاريخ والحضارات';
      case 'philosophy': return 'الفلسفة والفكر';
      case 'business': return 'ريادة الأعمال والمال';
      case 'science': return 'العلوم والفضاء';
      case 'health': return 'علم النفس والذات';
      default: return 'مقال مميز';
    }
  };

  return (
    <section className="mb-8" aria-label="مقالات مميزة مختارة">
      <div className="flex items-center justify-between gap-2 mb-3.5 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-teal-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 fill-white/20" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              مقالات مميزة ونخبة الاختيارات
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              أطروحات عميقة اختارها فريق التحرير للأسبوع الحالي
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hidden sm:inline">
          اسحب أفقياً للمزيد ←
        </span>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none snap-x snap-mandatory">
        {featured.map((article, index) => {
          const isBookmarked = bookmarkedIds.includes(article.id);

          return (
            <div
              key={article.id}
              className="snap-start shrink-0 w-[290px] sm:w-[360px] md:w-[410px] rounded-3xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-xs hover:shadow-lg hover:border-teal-400/50 transition-all duration-300 flex flex-col justify-between group cursor-pointer relative literium-card"
              onClick={() => onSelectArticle(article)}
            >
              {/* Header Image with Rich Overlays */}
              <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-108"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-[11px] font-extrabold text-teal-300 border border-teal-500/30 shadow-xs">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>مختار للتحرير</span>
                  </span>

                  {article.isLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md">
                      <Lock className="w-3 h-3 stroke-[2.5]" />
                      <span>{article.lockedPrice || 2.99}$</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-600/90 backdrop-blur-md text-[11px] font-bold text-white shadow-xs">
                      مجاني
                    </span>
                  )}
                </div>

                {/* Category & Publish Date over image */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-xs text-white/90">
                  <span className="px-2.5 py-0.5 rounded-lg bg-teal-950/80 backdrop-blur-sm text-[11px] font-bold text-teal-300 border border-teal-500/20">
                    {getCategoryLabel(article.category)}
                  </span>

                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-200">
                    <Calendar className="w-3 h-3 text-teal-400" />
                    <span>{timeAgoAr(article.publishedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base line-clamp-2 leading-snug mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {article.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {article.description}
                  </p>
                </div>

                {/* Author & Footer Action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={article.writerAvatar}
                      alt={article.writerName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-xl object-cover ring-1 ring-teal-500/30"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 line-clamp-1">
                        {article.writerName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {article.viewsCount.toLocaleString('ar-EG')} قراءة
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onBookmark && (
                      <button
                        type="button"
                        onClick={() => onBookmark(article.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
                          isBookmarked
                            ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60'
                            : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title="حفظ"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectArticle(article)}
                      className="min-h-[34px] px-3 py-1 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                    >
                      <span>قراءة</span>
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
