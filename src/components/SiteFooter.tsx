import React from 'react';
import { LegalSection } from './LegalPages';

interface SiteFooterProps {
  onOpenLegal: (section: LegalSection) => void;
}

/**
 * تذييل الموقع.
 *
 * ⚠️ مهم: وجود روابط سياسة الخصوصية وشروط الاستخدام ومعلومات التواصل،
 * وكونها قابلة للوصول من كل صفحة، شرط إلزامي لقبول حساب AdSense.
 * لا تحذف هذا المكوّن ولا تُخفِ روابطه.
 */
export const SiteFooter: React.FC<SiteFooterProps> = ({ onOpenLegal }) => {
  const year = new Date().getFullYear();

  const links: { id: LegalSection; label: string }[] = [
    { id: 'privacy', label: 'سياسة الخصوصية' },
    { id: 'terms', label: 'شروط الاستخدام' },
    { id: 'about', label: 'من نحن' },
    { id: 'contact', label: 'اتصل بنا' }
  ];

  return (
    <footer
      dir="rtl"
      className="mt-10 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-start">
            <div className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
              LITERIUM
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              منصة عربية للأدب والفكر والمعرفة
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {links.map((link) => (
              <button
                key={link.id}
                onClick={() => onOpenLegal(link.id)}
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 text-center text-[10px] text-slate-400 dark:text-slate-500">
          © {year} ليتيريوم — جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
};
