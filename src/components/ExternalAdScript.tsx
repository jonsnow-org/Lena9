import React, { useEffect, useRef, useState } from 'react';

interface ExternalAdScriptProps {
  snippet: string;
  className?: string;
  /** الارتفاع الحقيقي للوحدة الإعلانية بالبكسل */
  heightPx?: number;
  /** العرض الحقيقي للوحدة؛ إن زاد عن عرض الحاوية تُصغَّر الوحدة كاملة بنسبة ثابتة بدل قصّها */
  widthPx?: number;
  onHide?: () => void;
}

export const ExternalAdScript: React.FC<ExternalAdScriptProps> = ({
  snippet,
  className,
  heightPx = 90,
  widthPx,
  onHide
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const adLoadedRef = useRef(adLoaded);
  adLoadedRef.current = adLoaded;

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer || !widthPx) return;
    const measure = () => setAvailableWidth(outer.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [widthPx]);

  useEffect(() => {
    const container = containerRef.current;
    const trimmed = snippet.trim();
    if (!container || !trimmed) return;

    setAdLoaded(false);
    setHidden(false);
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    // text-align:center يوسّط وحدة الإعلان داخل إطارها؛ بدونه تلتصق الوحدة
    // بالحافة اليسرى للإطار فتبدو منزاحة داخل صفحة عربية.
    iframe.srcdoc =
      '<!DOCTYPE html><html dir="ltr"><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;text-align:center}' +
      'iframe,img{display:inline-block;vertical-align:top;max-width:none}</style></head><body>' +
      trimmed +
      '</body></html>';

    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try {
          const doc = iframe.contentDocument;
          if (doc) {
            const body = doc.body;
            const hasVisibleContent =
              body.scrollHeight > 10 &&
              (body.children.length > 0 || body.innerHTML.trim().length > 100);
            const imgs = body.querySelectorAll('img, iframe, canvas, video, object, embed');
            const hasMedia = imgs.length > 0;
            const hasText = body.innerText.trim().length > 5;
            if (hasVisibleContent && (hasMedia || hasText)) {
              setAdLoaded(true);
            } else {
              setHidden(true);
              onHideRef.current?.();
            }
          } else {
            setAdLoaded(true);
          }
        } catch {
          setAdLoaded(true);
        }
      }, 3000);
    });

    container.appendChild(iframe);

    const fallbackTimer = setTimeout(() => {
      if (!adLoadedRef.current) {
        setHidden(true);
        onHideRef.current?.();
      }
    }, 8000);

    return () => {
      clearTimeout(fallbackTimer);
      container.innerHTML = '';
    };
  }, [snippet]);

  if (!snippet.trim()) return null;
  if (hidden) return null;

  const scale = widthPx && availableWidth ? Math.min(1, availableWidth / widthPx) : 1;
  const scaledHeight = Math.round(heightPx * scale);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        height: scaledHeight,
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        opacity: adLoaded ? 1 : 0.3,
        transition: 'opacity 0.3s ease'
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: widthPx ? widthPx : '100%',
          height: heightPx,
          flex: 'none',
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center'
        }}
      />
    </div>
  );
};
