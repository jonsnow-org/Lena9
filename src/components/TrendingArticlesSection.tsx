import React from 'react';
import { Flame, Eye, Clock, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { Article } from '../types';

interface TrendingArticlesSectionProps {
  articles?: Article[];
  onSelectArticle: (article: Article) => void;
}

export const TrendingArticlesSection: React.FC<TrendingArticlesSectionProps> = ({
  articles = [],
  onSelectArticle
}) => {
  const safeArticles = Array.isArray(articles) ? articles : [];
  // Sort by views / reads descending
  const trending = [...safeArticles]
    .sort((a, b) => b.viewsCount - a.viewsCount)
    .slice(0, 4);

  if (trending.length === 0) return null;

  return (
    <section className="mb-8" aria-label="الأكثر قراءة هذا الأسبوع">
      <div className="flex items-center justify-between gap-2 mb-3.5 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-xs">
            <Flame className="w-4 h-4 fill-white/30" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              الأكثر قراءة وتفاعلاً هذا الأسبوع
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              المقالات الأكثر رواجاً ونقاشاً بين مجتمع القراء
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {trending.map((article, idx) => {
          const rankColors = [
            'from-amber-500 to-amber-600 text-slate-950 shadow-amber-500/30',
            'from-slate-400 to-slate-500 text-white shadow-slate-400/30',
            'from-amber-700 to-amber-800 text-white shadow-amber-700/30',
            'from-teal-600 to-teal-700 text-white shadow-teal-600/30'
          ];

          return (
            <div
              key={article.id}
              onClick={() => onSelectArticle(article)}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-teal-400/50 dark:hover:border-teal-500/40 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group active:scale-[0.99] touch-manipulation literium-card relative"
            >
              {/* Rank Badge & Category */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span
                  className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${rankColors[idx] || rankColors[3]} font-black text-xs flex items-center justify-center shadow-xs`}
                >
                  #{idx + 1}
                </span>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {article.category === 'literature'
                    ? 'أدب'
                    : article.category === 'philosophy'
                    ? 'فلسفة'
                    : article.category === 'technology'
                    ? 'تقنية'
                    : article.category === 'history'
                    ? 'تاريخ'
                    : article.category === 'science'
                    ? 'علوم'
                    : article.category === 'business'
                    ? 'مال'
                    : 'عام'}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {article.title}
              </h3>

              {/* Author & Stats */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 line-clamp-1">
                  <img
                    src={article.writerAvatar}
                    alt={article.writerName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] truncate max-w-[90px]">
                    {article.writerName}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold shrink-0">
                  <Eye className="w-3 h-3" />
                  <span>{article.viewsCount.toLocaleString('ar-EG')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
