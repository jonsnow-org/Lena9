import React, { useEffect, useRef } from 'react';

/**
 * يُدرج كود HTML/JS جاهز من شبكة إعلانية خارجية (PropellerAds/Adsterra)
 * داخل حاوية معزولة. dangerouslySetInnerHTML وحده لا يُنفّذ وسوم
 * <script> (سلوك متصفح قياسي)، لذا نبني عناصر <script> حقيقية يدوياً
 * وندرجها في DOM كي تُنفَّذ فعلياً — وهذا سبب وجود هذا المكوّن بدل
 * استخدام dangerouslySetInnerHTML مباشرة.
 */
interface ExternalAdScriptProps {
  snippet: string;
  className?: string;
}

export const ExternalAdScript: React.FC<ExternalAdScriptProps> = ({ snippet, className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !snippet.trim()) return;

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
