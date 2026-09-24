import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * عرض تدريجي للقوائم الطويلة كما في قوائم أندرويد: دفعة أولى صغيرة، ثم دفعة
 * جديدة كلما اقترب المستخدم من نهاية المعروض. تركيب مئات البطاقات دفعة واحدة
 * كان يُثقل فتح الخلاصة والتنقل بين الأقسام والتمرير داخل WebView.
 */
export function useIncrementalList<T>(
  items: T[],
  resetKey: unknown,
  pageSize = 12
): { visible: T[]; hasMore: boolean; sentinelRef: (node: HTMLElement | null) => void } {
  const [count, setCount] = useState(pageSize);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setCount(pageSize);
  }, [resetKey, pageSize]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      if (!node || typeof IntersectionObserver === 'undefined') return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setCount((c) => c + pageSize);
          }
        },
        { rootMargin: '1200px 0px' }
      );
      observerRef.current.observe(node);
    },
    // count في الاعتماديات عمداً: مرجع جديد بعد كل دفعة يعيد المراقبة من جديد، فإن
    // بقي المؤشر ظاهراً (قائمة قصيرة أو شاشة طويلة) تُحمَّل الدفعة التالية أيضاً.
    [pageSize, count]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    visible: items.slice(0, count),
    hasMore: items.length > count,
    sentinelRef
  };
}
