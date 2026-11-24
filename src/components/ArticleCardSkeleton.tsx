import React from 'react';

export const ArticleCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-xs animate-pulse flex flex-col justify-between">
      {/* Image Skeleton */}
      <div className="h-48 sm:h-52 w-full bg-slate-200 dark:bg-slate-800 relative">
        <div className="absolute top-3 inset-x-3 flex justify-between">
          <div className="w-20 h-5 bg-slate-300 dark:bg-slate-700 rounded-full" />
          <div className="w-16 h-5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>
      </div>

      {/* Body Skeleton */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Author */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="w-28 h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="w-16 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="w-5/6 h-3 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex gap-2">
            <div className="w-10 h-3 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="w-10 h-3 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="w-20 h-7 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
