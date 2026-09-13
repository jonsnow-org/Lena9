import React from 'react';

/** هيكل تحميل بشكل بطاقة تغريدة حقيقية — نفس فلسفة ArticleCardSkeleton
 *  تماماً، لكن مصمم لبطاقة تغريد الأصغر والأبسط (بلا صورة غلاف كبيرة). */
export const TweetCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 shadow-xs animate-pulse space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="w-24 h-3 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="w-14 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="w-2/3 h-3 bg-slate-200 dark:bg-slate-800 rounded-md" />
      </div>
      <div className="flex items-center gap-4 pt-1">
        <div className="w-10 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="w-10 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="w-10 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    </div>
  );
};
