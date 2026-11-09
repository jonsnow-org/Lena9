import React from 'react';
import { BookOpen, MessageSquare } from 'lucide-react';

export type HomeFeedMode = 'blog' | 'tweet';

interface HomeFeedModeSwitcherProps {
  mode: HomeFeedMode;
  onChange: (mode: HomeFeedMode) => void;
}

/**
 * مبدّل "الستارة": القسم النشط بطاقة مملوءة بالكامل بلونها، والقسم الآخر
 * بطاقة أصغر بنفس اللون لكن بخلفية باهتة — كلاهما يعرض الأيقونة + الاسم
 * دائماً (لم يعد القسم غير النشط يُطوى لأيقونة مجرّدة بلا نص، كان ذلك
 * يجعله يبدو زراً معطّلاً بلا وظيفة واضحة بدل تبويب ثانٍ فعلي).
 */
export const HomeFeedModeSwitcher: React.FC<HomeFeedModeSwitcherProps> = ({ mode, onChange }) => {
  return (
    <div className="flex items-stretch gap-2 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5">
      <button
        type="button"
        onClick={() => onChange('blog')}
        className={`flex-1 flex items-center justify-center gap-2 rounded-xl font-extrabold text-sm transition-all duration-300 ease-in-out px-3 ${
          mode === 'blog'
            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
            : 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 dark:text-orange-400/80 hover:text-orange-600'
        }`}
        title="المدونة"
      >
        <BookOpen className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">المدونة</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('tweet')}
        className={`flex-1 flex items-center justify-center gap-2 rounded-xl font-extrabold text-sm transition-all duration-300 ease-in-out px-3 ${
          mode === 'tweet'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
            : 'bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400/80 hover:text-blue-600'
        }`}
        title="تغريد"
      >
        <MessageSquare className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">تغريد</span>
      </button>
    </div>
  );
};
