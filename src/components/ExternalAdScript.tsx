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
  /** عرض الحاوية بالبكسل — لوحدات إعلانية أضيق من عرض الحاوية الأب
   *  (مثل 160×300/160×600/468×60/728×90 من Adsterra)، بدل تمديدها لعرض
   *  100% وترك الوحدة الحقيقية صغيرة داخل مساحة أوسع بلا داعٍ. تُترك
   *  المساحة الزائدة حول الوحدة فارغة ومُوسَّطة (margin: 0 auto). القيمة
   *  الافتراضية `undefined` تعني عرض 100% كالسابق تماماً (Native Banner
   *  وبقية الشبكات التي لا مقاس ثابت لها). */
  widthPx?: number;
}

export const ExternalAdScript: React.FC<ExternalAdScriptProps> = ({
  snippet,
  className,
  heightPx = 90,
  widthPx
}) => {
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
    // ⚠️ allow-same-origin أُزيلت نهائياً — تجربة سابقة أضافتها لحل مشكلة
    // "الصندوق فارغ" فأعادت فتح مشكلة "يغطي الشاشة" الأصلية بشكل أخطر:
    // عندما يكون allow-scripts و allow-same-origin معاً على iframe مُقيّد،
    // فإن srcdoc لا يُعامَل كأصل معزول (opaque) بل يرث أصل صفحتنا الحقيقي —
    // ما يمنح سكربت الشبكة وصولاً برمجياً حقيقياً إلى window.parent.document
    // (نفس الأصل تماماً)، فيستطيع حرفياً حقن عناصره مباشرة داخل body صفحتنا
    // الحقيقية متجاوزاً حدود الـ iframe كلياً — وهذا بالضبط ما رآه المستخدم:
    // البطاقة عادت تغطي أعلى الشاشة وزر X التابع للشبكة لم يعد يستجيب (لأنه
    // لم يعد داخل الإطار المعزول أصلاً بل حقيقة في صفحتنا، متعارضاً مع منطق
    // صفحتنا نفسها).
    //
    // الحل الدائم: عزل كامل بلا allow-same-origin (أصل معزول/opaque) — يمنع
    // نهائياً أي وصول من سكربت الشبكة إلى document.body الحقيقي مهما كان
    // الكود المُلصَق عدائياً. الأثر الجانبي المقبول: تنسيقات "Social
    // Bar"/"In-Page Push"/"Popunder" (إشعارات تغطي الشاشة بطبيعتها، وليست
    // بانرات) قد لا تعرض محتوى داخل هذا الصندوق الصغير إطلاقاً — وهذا ليس
    // خللاً في الكود، بل لأن هذه التنسيقات مصمَّمة أصلاً لتغطية الشاشة على
    // أي موقع، لا لتلائم صندوقاً صغيراً. الحل الحقيقي لذلك من جهة المستخدم:
    // توليد كود الإعلان من نوع "Banner"/"Native Banner" (مقاسات ثابتة مثل
    // 300x250 أو 320x50) من لوحة الشبكة (Adsterra/PropellerAds/Monetag) بدل
    // "Social Bar"/"In-Page Push"/"Popunder" — هذه التنسيقات مصمَّمة أصلاً
    // لتُعرض داخل حاوية بحجم ثابت وتعمل بشكل طبيعي داخل iframe معزول.
    iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
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
  return (
    <div
      ref={containerRef}
      className={className}
      style={
        widthPx
          ? { height: heightPx, width: widthPx, maxWidth: '100%', margin: '0 auto', overflow: 'hidden' }
          : { height: heightPx, overflow: 'hidden' }
      }
    />
  );
};
