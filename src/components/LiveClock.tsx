import React, { useEffect, useState } from 'react';

/**
 * ساعة رقمية حيّة بتوقيت تركيا وسوريا (كلاهما UTC+3 حالياً، لكن نحسبهما
 * بمنطقتين زمنيتين حقيقيتين منفصلتين عبر Intl بدل افتراض تطابق دائم —
 * فتبقى صحيحة تلقائياً إن تغيّر أي منهما مستقبلاً).
 *
 * ⚠️ التحديث كل ثانية معزول محلياً داخل هذا المكوّن الصغير فقط عبر
 * useState/useEffect خاصين به — لا يُرفع أي شيء إلى حالة App.tsx، حتى لا
 * يتكرر خطأ إعادة رسم شجرة التطبيق الضخمة كل ثانية (نفس سبب مشكلة تجمّد
 * التمرير التي أُصلحت سابقاً في نظام "اسحب للتحديث").
 */
export const LiveClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const turkeyTime = now.toLocaleTimeString('ar', {
    timeZone: 'Europe/Istanbul',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const syriaTime = now.toLocaleTimeString('ar', {
    timeZone: 'Asia/Damascus',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const dateLabel = now.toLocaleDateString('ar-SY', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const sameTime = turkeyTime === syriaTime;

  return (
    <div
      id="header-live-clock"
      className="flex flex-col items-end leading-tight px-2 sm:px-3 py-1 rounded-xl bg-slate-100/95 dark:bg-slate-900/90 border border-slate-300/80 dark:border-brand-500/30 shadow-xs backdrop-blur-xs select-none transition-colors"
    >
      <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-[11px] sm:text-xs font-black text-slate-900 dark:text-emerald-300 tracking-tight" dir="ltr">
        {sameTime ? (
          <span title="توقيت تركيا وسوريا الموحد (UTC+3)" className="flex items-center gap-1">
            <span className="text-[10px] opacity-90">🇹🇷🇸🇾</span>
            <span className="text-teal-700 dark:text-teal-300 font-bold">{turkeyTime}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span title="توقيت تركيا">🇹🇷 {turkeyTime}</span>
            <span className="text-slate-400 dark:text-slate-600 font-normal">|</span>
            <span title="توقيت سوريا">🇸🇾 {syriaTime}</span>
          </span>
        )}
      </div>
      <span className="text-[9px] sm:text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5 tracking-tight">
        {dateLabel}
      </span>
    </div>
  );
};

/**
 * نقطة خضراء نابضة بحتة عبر CSS (بلا أي حالة أو مؤقّت JS)، توحي بأن
 * الموقع متصل ويعمل الآن — بلا أي كلفة أداء لأنها لا تعيد رسم شيء إطلاقاً.
 */
export const LiveStatusDot: React.FC = () => (
  <div
    id="header-live-status"
    className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300/80 dark:border-emerald-700/60 shadow-xs"
    title="المنصة متصلة وتعمل الآن مباشرة"
  >
    <span className="relative flex w-2 sm:w-2.5 h-2 sm:h-2.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full w-2 sm:w-2.5 h-2 sm:h-2.5 bg-emerald-500" />
    </span>
    <span className="text-[9px] sm:text-[10px] font-bold text-emerald-800 dark:text-emerald-300 hidden sm:inline">
      مباشر
    </span>
  </div>
);
