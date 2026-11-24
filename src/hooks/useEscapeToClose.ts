import { useEffect } from 'react';

/**
 * يُغلق أي نافذة منبثقة بضغطة "Esc" — سلوك متوقَّع في كل نظام تشغيل/متصفح
 * لأي نافذة حوارية، لكنه لم يكن مطبَّقاً في أي نافذة عبر المشروع (أكثر من
 * 20 نافذة تعتمد فقط على زر X أو النقر خارج النافذة). يُستدعى بلا شرط في
 * أعلى المكوّن (قبل أي `if (!isOpen) return null`، احتراماً لقاعدة عدم
 * استدعاء Hooks بشرط) — `enabled=false` يجعله بلا أي أثر فعلي.
 *
 * `enabled` اختياري (افتراضه true) للنوافذ التي لا تملك خاصية isOpen أصلاً
 * ويتحكم أبوها بعرضها عبر التركيب الشرطي نفسه ({condition && <Modal/>}) —
 * وجودها في الشجرة يعني ظهورها دائماً، فلا حاجة لأي شرط إضافي هنا.
 */
export function useEscapeToClose(onClose: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onClose]);
}
