import React from 'react';
import { BookOpen, MessageSquare } from 'lucide-react';

export type HomeFeedMode = 'blog' | 'tweet';

interface HomeFeedModeSwitcherProps {
  mode: HomeFeedMode;
  onChange: (mode: HomeFeedMode) => void;
}

/**
 * مبدّل "الستارة": القسم النشط يظهر ممتداً بعرضه الكامل، والقسم الآخر
 * يظهر مطوياً كشريط ضيق بجانبه — الضغط عليه يفتحه ويطوي الآخر مكانه،
 * بحركة انزلاق سلسة بدل تبديل فوري.
 */
export const HomeFeedModeSwitcher: React.FC<HomeFeedModeSwitcherProps> = ({ mode, onChange }) => {
  return (
    <div className="flex items-stretch gap-1.5 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden p-1.5">
      <button
        type="button"
        onClick={() => onChange('blog')}
        className={`flex items-center gap-2 rounded-xl font-extrabold text-sm transition-all duration-300 ease-in-out overflow-hidden ${
          mode === 'blog'
            ? 'flex-1 px-4 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-md'
            : 'w-12 justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title="المدونة"
      >
        <BookOpen className="w-4 h-4 shrink-0" />
        <span className={`whitespace-nowrap transition-opacity duration-200 ${mode === 'blog' ? 'opacity-100' : 'opacity-0 w-0'}`}>
          المدونة
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange('tweet')}
        className={`flex items-center gap-2 rounded-xl font-extrabold text-sm transition-all duration-300 ease-in-out overflow-hidden ${
          mode === 'tweet'
            ? 'flex-1 px-4 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-md'
            : 'w-12 justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title="تغريد"
      >
        <MessageSquare className="w-4 h-4 shrink-0" />
        <span className={`whitespace-nowrap transition-opacity duration-200 ${mode === 'tweet' ? 'opacity-100' : 'opacity-0 w-0'}`}>
          تغريد
        </span>
      </button>
    </div>
  );
};
