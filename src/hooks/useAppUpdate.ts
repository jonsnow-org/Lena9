import {useEffect, useRef, useState} from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * يقارن رقم البناء المخبوز داخل الكود الذي يعمل الآن في المتصفح (__APP_BUILD__)
 * برقم البناء المنشور فعلياً على الخادم (يُجلب من /version.json مع تعطيل أي
 * تخزين مؤقت). عند الاختلاف، هذا يعني أن نشراً جديداً حدث بعد تحميل الصفحة
 * الحالية — لا حاجة لأي منطق Service Worker: الملفات الثابتة مسمّاة ببصمة
 * محتوى (hash) من Vite، وindex.html غير مخزَّن في sw.js، فإعادة تحميل بسيطة
 * كافية لجلب النسخة الجديدة كاملة.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (checkingRef.current || updateAvailable) return;
      checkingRef.current = true;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {cache: 'no-store'});
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.build && data.build !== __APP_BUILD__) {
          setUpdateAvailable(true);
        }
      } catch {
        // فشل الشبكة هنا غير مهم — نحاول مجدداً بالفحص الدوري التالي
      } finally {
        checkingRef.current = false;
      }
    }

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [updateAvailable]);

  const applyUpdate = () => {
    window.location.reload();
  };

  return {updateAvailable, applyUpdate};
}
