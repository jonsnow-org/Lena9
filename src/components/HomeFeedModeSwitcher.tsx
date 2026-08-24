import React from 'react';
import { BookOpen, MessageSquare } from 'lucide-react';

export type HomeFeedMode = 'blog' | 'tweet';

interface HomeFeedModeSwitcherProps {
  mode: HomeFeedMode;
  onChange: (mode: HomeFeedMode) => void;
}

/**
 * مبدّل "الستارة": القسم النشط يظهر بطاقة ملوّنة بحجم كلمتها فقط (وليس
 * ممدودة على كامل العرض)، والقسم الآخر يظهر مطوياً كأيقونة ضيقة بلون
 * باهت من نفس فئته اللونية — حتى يلاحظ الزائر فوراً وجود قسمين مختلفين:
 * "مدونة" برتقالي و"تغريد" أزرق، بدل لون موحّد للاثنين.
 */
export const HomeFeedModeSwitcher: React.FC<HomeFeedModeSwitcherProps> = ({ mode, onChange }) => {
  return (
    <div className="flex items-stretch gap-2 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5">
      <button
        type="button"
        onClick={() => onChange('blog')}
        className={`flex items-center gap-2 rounded-xl font-extrabold text-sm transition-all duration-300 ease-in-out ${
          mode === 'blog'
            ? 'px-4 bg-orange-500 text-white shadow-md shadow-orange-500/30'
            : 'w-12 justify-center bg-orange-50 dark:bg-orange-950/30 text-orange-400 dark:text-orange-500/70 hover:text-orange-600'
        }`}
        title="المدونة"
      >
        <BookOpen className="w-4 h-4 shrink-0" />
        {mode === 'blog' && <span className="whitespace-nowrap">المدونة</span>}
      </button>

      <button
        type="button"
        onClick={() => onChange('tweet')}
        className={`flex items-center gap-2 rounded-xl font-extrabold text-sm transition-all duration-300 ease-in-out ${
          mode === 'tweet'
            ? 'px-4 bg-blue-600 text-white shadow-md shadow-blue-600/30'
            : 'w-12 justify-center bg-blue-50 dark:bg-blue-950/30 text-blue-400 dark:text-blue-500/70 hover:text-blue-600'
        }`}
        title="تغريد"
      >
        <MessageSquare className="w-4 h-4 shrink-0" />
        {mode === 'tweet' && <span className="whitespace-nowrap">تغريد</span>}
      </button>
    </div>
  );
};
