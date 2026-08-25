// معيار قياسي لاكتشاف تشغيل الموقع كتطبيق مثبَّت (TWA على أندرويد أو PWA
// عبر "أضف للشاشة الرئيسية"): display-mode:standalone، أو referrer ببادئة
// android-app:// (خاص بالـ TWA)، أو navigator.standalone (سفاري iOS القديم).
export function isRunningAsInstalledApp(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (document.referrer.startsWith('android-app://')) return true;
    if ((window.navigator as unknown as {standalone?: boolean}).standalone) return true;
  } catch {
    // بيئات نادرة قد ترمي هنا (بعض متصفحات الويب فيو) — نتعامل معها كمتصفح عادي
  }
  return false;
}
