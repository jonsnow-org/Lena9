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
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const syriaTime = now.toLocaleTimeString('ar', {
    timeZone: 'Asia/Damascus',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const dateLabel = now.toLocaleDateString('ar', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const sameTime = turkeyTime === syriaTime;

  return (
    <div className="hidden sm:flex flex-col items-end leading-none px-2.5 py-1 rounded-xl bg-slate-900/60 border border-brand-500/20">
      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-brand-200" dir="ltr">
        {sameTime ? (
          <span title="توقيت تركيا وسوريا">🇹🇷🇸🇾 {turkeyTime}</span>
        ) : (
          <>
            <span title="توقيت تركيا">🇹🇷 {turkeyTime}</span>
            <span className="text-slate-600">|</span>
            <span title="توقيت سوريا">🇸🇾 {syriaTime}</span>
          </>
        )}
      </div>
      <span className="text-[10px] text-slate-400 mt-0.5">{dateLabel}</span>
    </div>
  );
};

/**
 * نقطة خضراء نابضة بحتة عبر CSS (بلا أي حالة أو مؤقّت JS)، توحي بأن
 * الموقع متصل ويعمل الآن — بلا أي كلفة أداء لأنها لا تعيد رسم شيء إطلاقاً.
 */
export const LiveStatusDot: React.FC = () => (
  <span className="relative flex w-2.5 h-2.5" title="الموقع يعمل الآن">
    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
    <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-500" />
  </span>
);
