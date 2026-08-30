// كشف تشغيل الموقع داخل تطبيق Literium المثبَّت (APK):
//  - "LiteriumNativeApp/" في navigator.userAgent — العلامة التي يُلحقها
//    غلاف WebView (flutter_app/lib/main.dart) بنهاية user agent حقيقي
//    (وليس افتراضي) حتى لا يرفض Google صفحة تسجيل الدخول — هذا هو الفحص
//    الفعلي لمعمارية التطبيق الحالية (WebView مباشر).
//  - الثلاثة الباقية (display-mode:standalone، referrer ببادئة
//    android-app://، navigator.standalone) من معمارية TWA السابقة
//    (bubblewrap) — أُبقيت لأنها غير ضارة ولا تُفعَّل إطلاقاً داخل WebView
//    الحالي، فقط احتياط لو أُعيد استخدام أرشيف TWA يوماً.
export function isRunningAsInstalledApp(): boolean {
  try {
    if (window.navigator.userAgent.includes('LiteriumNativeApp/')) return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (document.referrer.startsWith('android-app://')) return true;
    if ((window.navigator as unknown as {standalone?: boolean}).standalone) return true;
  } catch {
    // بيئات نادرة قد ترمي هنا (بعض متصفحات الويب فيو) — نتعامل معها كمتصفح عادي
  }
  return false;
}
