import React from 'react';
import { Eye, Heart, MessageSquare, Lock, CheckCircle2, Bookmark, Calendar, ArrowLeft, Sparkles, Clock } from 'lucide-react';
import { Article } from '../types';
import { formatDateTimeAr, formatDateAr } from '../utils/dateFormat';
import { WRITER_MONETIZATION_ENABLED } from '../constants/revenueShares';

interface ArticleCardProps {
  article: Article;
  onSelect: (article: Article) => void;
  onFollowAuthor?: (writerId: string) => void;
  isFollowing?: boolean;
  onSaveBookmark?: (articleId: string) => void;
  isSaved?: boolean;
  onWriterProfileClick?: (writerId: string) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onSelect,
  onFollowAuthor,
  isFollowing = false,
  onSaveBookmark,
  isSaved = false,
  onWriterProfileClick
}) => {
  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'literature': return 'الأدب والشعر';
      case 'technology': return 'التقنية والذكاء الاصطناعي';
      case 'history': return 'التاريخ والحضارات';
      case 'philosophy': return 'الفلسفة والفكر';
      case 'business': return 'ريادة الأعمال والمال';
      case 'science': return 'العلوم والفضاء';
      case 'health': return 'الصحة والرفاهية';
      case 'arts': return 'الفنون والنقد';
      case 'politics': return 'سياسي';
      case 'education': return 'تعليمي';
      case 'beauty_fashion': return 'مكياج وموضة وجمال';
      case 'sports': return 'رياضة';
      case 'food': return 'طبخ وأكلات';
      case 'travel': return 'سفر وسياحة';
      case 'family': return 'تربية وأسرة';
      default: return 'عام';
    }
  };

  return (
    <article
      id={`article-card-${article.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 shadow-xs hover:shadow-md hover:border-teal-400/40 dark:hover:border-teal-500/30 transition-all duration-200 active:scale-[0.99] touch-manipulation literium-card"
    >
      {/* Featured Image & Overlays */}
      <div
        className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer"
        onClick={() => onSelect(article)}
      >
        <img
          src={article.featuredImage}
          alt={article.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/90 px-3 py-1 text-[11px] font-bold text-teal-300 border border-teal-500/20 shadow-xs">
            {getCategoryLabel(article.category)}
          </span>

          {WRITER_MONETIZATION_ENABLED && article.isLocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-black text-slate-950 shadow-md">
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>مقال حصري ({article.lockedPrice || 2.99}$)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow-xs">
              قراءة مجانية
            </span>
          )}
        </div>

        {/* Publish Date & Time — تاريخ وساعة النشر بدقة واضحة للقارئ */}
        <div className="absolute bottom-2.5 start-3 flex items-center gap-1.5 rounded-xl bg-slate-950/95 px-2.5 py-1 text-[11px] font-bold text-teal-300 border border-teal-500/30 shadow-sm">
          <Clock className="w-3 h-3 text-teal-400" />
          <span>{formatDateTimeAr(article.publishedAt)}</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Author row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div
            className="flex items-center gap-2.5 cursor-pointer py-1"
            onClick={() => onWriterProfileClick && onWriterProfileClick(article.writerId)}
          >
            <img loading="lazy" decoding="async"
              src={article.writerAvatar}
              alt={article.writerName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-2xl object-cover ring-2 ring-teal-500/30 group-hover:ring-teal-500 transition-all duration-300"
            />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                  {article.writerName}
                </span>
                {article.writerIsVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 fill-teal-500/10" />
                )}
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                <span>{formatDateAr(article.publishedAt)}</span>
              </span>
            </div>
          </div>

          {onFollowAuthor && (
            <button
              type="button"
              onClick={() => onFollowAuthor(article.writerId)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation active:scale-95 ${
                isFollowing
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 border border-teal-200/70 dark:border-teal-800/70'
              }`}
            >
              {isFollowing ? 'مُتابَع' : '+ متابعة'}
            </button>
          )}
        </div>

        {/* Title */}
        <h3
          className="font-black text-slate-900 dark:text-white text-base sm:text-lg line-clamp-2 leading-snug mb-2 cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          onClick={() => onSelect(article)}
        >
          {article.title}
        </h3>

        {/* Description */}
        <p
          className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4 flex-1 cursor-pointer"
          onClick={() => onSelect(article)}
        >
          {article.description}
        </p>

        {/* Footer Metrics */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium" title={`${article.viewsCount} مشاهدة`}>
              <Eye className="w-3.5 h-3.5 text-teal-500" />
              <span className="tabular-nums">{article.viewsCount.toLocaleString('ar-EG')}</span>
            </span>

            <span className="flex items-center gap-1 font-medium" title={`${article.likesCount} إعجاب`}>
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span className="tabular-nums">{article.likesCount.toLocaleString('ar-EG')}</span>
            </span>

            <span className="flex items-center gap-1 font-medium" title={`${article.commentsCount} تعليق`}>
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span className="tabular-nums">{article.commentsCount.toLocaleString('ar-EG')}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onSaveBookmark && (
              <button
                type="button"
                onClick={() => onSaveBookmark(article.id)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all touch-manipulation active:scale-95 ${
                  isSaved
                    ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60'
                    : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={isSaved ? 'تم الحفظ في المفضلة' : 'حفظ للمفضلة'}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelect(article)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 active:scale-95 text-white font-bold text-xs shadow-xs shadow-teal-500/20 transition-all touch-manipulation flex items-center gap-1.5"
            >
              <span>قراءة الآن</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

