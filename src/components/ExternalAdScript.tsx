import React, { useEffect, useRef } from 'react';

/**
 * يُدرج كود HTML/JS جاهز من شبكة إعلانية خارجية (PropellerAds/Adsterra/
 * Monetag) داخل حاوية معزولة. dangerouslySetInnerHTML وحده لا يُنفّذ وسوم
 * <script> (سلوك متصفح قياسي)، لذا نبني عناصر <script> حقيقية يدوياً
 * وندرجها في DOM كي تُنفَّذ فعلياً — وهذا سبب وجود هذا المكوّن بدل
 * استخدام dangerouslySetInnerHTML مباشرة.
 *
 * ⚠️ نفس كود الشبكة الخارجية الواحد يُعاد استخدامه في كل مواضع المنصة
 * المؤهَّلة (AdSlot) دفعة واحدة على نفس الصفحة (حتى 3 مواضع حسب
 * MAX_ADS_PER_PAGE) عندما لا توجد حملة داخلية تملأها. أغلب هذه الشبكات
 * (ومنها تنسيقات Monetag مثل In-Page Push) عبارة عن سكربت "أحادي" يُدرج
 * نفسه في document.body مباشرة ويدير عرضه بنفسه بمعزل عن أي حاوية —
 * فتشغيله أكثر من مرة في نفس تحميل الصفحة يعني تكرار طلب الشبكة وتكرار
 * وحدة الإعلان فعلياً بدل مرة واحدة. لذا نُنفِّذ كل نص كود مطابق حرفياً
 * مرة واحدة فقط لكل تحميل صفحة، بغض النظر عن عدد المواضع التي اختارته.
 */
const injectedSnippetsThisPageLoad = new Set<string>();

interface ExternalAdScriptProps {
  snippet: string;
  className?: string;
}

export const ExternalAdScript: React.FC<ExternalAdScriptProps> = ({ snippet, className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const trimmed = snippet.trim();
    if (!container || !trimmed) return;
    if (injectedSnippetsThisPageLoad.has(trimmed)) return;
    injectedSnippetsThisPageLoad.add(trimmed);

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = snippet;

    // ننسخ كل عقدة كما هي، ونستبدل أي <script> بنسخة جديدة قابلة
    // للتنفيذ فعلياً (نسخ السمات مثل src/async/data-* والمحتوى النصي).
    Array.from(wrapper.childNodes).forEach((node) => {
      if (node.nodeName === 'SCRIPT') {
        const oldScript = node as HTMLScriptElement;
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.text = oldScript.text;
        container.appendChild(newScript);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });

    return () => {
      container.innerHTML = '';
    };
  }, [snippet]);

  if (!snippet.trim()) return null;
  return <div ref={containerRef} className={className} />;
};
