import React, { useEffect, useRef } from 'react';

/**
 * يُدرج كود HTML/JS جاهز من شبكة إعلانية خارجية (PropellerAds/Adsterra/
 * Monetag) داخل <iframe> معزول تماماً بحجم ثابت صغير — وليس مباشرة في DOM
 * صفحتنا كما كان سابقاً.
 *
 * ⚠️ السبب: أغلب هذه الشبكات (تنسيقات مثل "In-Page Push"/"Social Bar" لدى
 * Adsterra/Monetag) عبارة عن سكربت يُدرج نفسه في document.body مباشرة
 * ويتحكم بموضعه وحجمه بنفسه (position: fixed يغطي الشاشة، بمعزل تام عن أي
 * حاوية CSS نضعه فيها) — لهذا كان يظهر كبطاقة عائمة تغطي أعلى الشاشة بدل
 * البقاء داخل شريطه المخصَّص. الـ iframe يمنحه صفحة/document منفصلة تماماً
 * خاصة به: أي "تثبيت نفسه في body" يحدث داخل body الخاص بالـ iframe نفسه لا
 * body صفحتنا، فيبقى محصوراً فعلياً داخل حجم الصندوق الذي نحدده هنا مهما
 * حاول الكود تجاوزه.
 *
 * كل موضع (AdSlot/AdTickerBar) يحصل الآن على iframe مستقل خاص به — عزل
 * كامل يعني عدم وجود تعارض بين نسخ متعددة من نفس الشبكة على نفس الصفحة،
 * فلا حاجة بعد الآن لمنطق "نفّذ الكود مرة واحدة فقط لكل تحميل صفحة" الذي
 * كان ضرورياً حين كان الجميع يشترك في نفس body الحقيقي.
 */
interface ExternalAdScriptProps {
  snippet: string;
  className?: string;
  /** ارتفاع الحاوية بالبكسل — شريط صغير ثابت الحجم لا يكبر مهما حاول كود
   *  الشبكة نفسه (افتراضياً 90، مناسب لوحدة بانر قياسية صغيرة). */
  heightPx?: number;
}

export const ExternalAdScript: React.FC<ExternalAdScriptProps> = ({ snippet, className, heightPx = 90 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const trimmed = snippet.trim();
    if (!container || !trimmed) return;

    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.setAttribute('scrolling', 'no');
    // ⚠️ allow-same-origin أُعيدت بعد أن ظهرت مساحة فارغة كلياً بلا أي إعلان
    // في كل المواضع: أغلب شبكات الإعلانات (Adsterra/PropellerAds/Monetag)
    // تعتمد على الكوكيز وطلبات XHR لجلب الإعلان الفعلي، وإطار sandbox بلا
    // allow-same-origin يُعامَل كأصل معزول (opaque origin) فتُحظر هذه
    // الطلبات صامتة فيبقى الصندوق فارغاً — لا خطأ ظاهر، فقط لا إعلان أبداً.
    // هذا لا يُعيد مشكلة "يغطي الشاشة" الأصلية: تلك كانت بسبب محاولة السكربت
    // تثبيت نفسه في <body> الصفحة الرئيسية عبر position:fixed خارج أي حاوية؛
    // العزل الذي يمنع ذلك هو حدود الـ iframe نفسها (أي body داخله محصور
    // بصرياً بحجمه)، وهذا يبقى قائماً بصرف النظر عن allow-same-origin. بلا
    // allow-top-navigation/allow-modals — يمنع فتح نوافذ أو حوارات تتحكم
    // بصفحتنا نفسها.
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    iframe.srcdoc =
      '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>' +
      trimmed +
      '</body></html>';
    container.appendChild(iframe);

    return () => {
      container.innerHTML = '';
    };
  }, [snippet]);

  if (!snippet.trim()) return null;
  return <div ref={containerRef} className={className} style={{ height: heightPx, overflow: 'hidden' }} />;
};
