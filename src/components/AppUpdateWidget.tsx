import React, {useState} from 'react';
import {Download, RefreshCw} from 'lucide-react';
import {useAppUpdate} from '../hooks/useAppUpdate';

// عنصر عائم مستقل تماماً عن App (كشاشة البدء SplashScreen) — لا يحتاج أي
// بيانات من حالة التطبيق الضخمة. يفرّق بين سياقين باستخدام معيار قياسي
// لاكتشاف تطبيقات TWA/PWA المثبَّتة: display-mode:standalone (أندرويد/كل
// المتصفحات) أو document.referrer ببادئة android-app:// (خاص بالـ TWA).
//
//  - داخل تطبيق الهاتف المثبَّت: زر "تحديث" فقط، ويظهر فقط عند وجود نسخة
//    أحدث منشورة، ويختفي تلقائياً (يُفكَّك العنصر بالكامل) بعد تطبيق التحديث
//    لأن إعادة التحميل تجلب رقم البناء الجديد فتصبح النسختان متطابقتين.
//  - داخل متصفح عادي (لم يُثبَّت بعد): زر "تحميل التطبيق" يظهر دائماً، ويظهر
//    بجانبه زر "تحديث" أيضاً لو كانت نسخة الموقع المحمَّلة قديمة.
function isRunningAsInstalledApp(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (document.referrer.startsWith('android-app://')) return true;
    if ((window.navigator as unknown as {standalone?: boolean}).standalone) return true;
  } catch {
    // بيئات نادرة قد ترمي هنا (بعض متصفحات الويب فيو) — نتعامل معها كمتصفح عادي
  }
  return false;
}

export const AppUpdateWidget: React.FC = () => {
  const {updateAvailable, applyUpdate} = useAppUpdate();
  const [isInstalledApp] = useState(isRunningAsInstalledApp);
  const isArabic = (localStorage.getItem('literium_lang') || 'ar') === 'ar';

  if (isInstalledApp && !updateAvailable) return null;

  const labels = isArabic
    ? {download: 'تحميل التطبيق', update: 'تحديث'}
    : {download: 'Download App', update: 'Update'};

  return (
    // ملاحظة: bottom-36/40 مقصودة — مرتفعة عمداً فوق صف الأزرار العائمة
    // الموجود أصلاً في App.tsx (زر الكتابة وزر الصعود، كلاهما bottom-20/24)
    // لتفادي التراكب فوقهما، خصوصاً أن الموقع dir="rtl" فيجعل end-4 يقع
    // فعلياً بنفس مكان زر "ابدأ الكتابة" (left-4) لو استخدمنا نفس الارتفاع.
    // z-40 (وليس z-50) عمداً: هذا العنصر مُركَّب كشقيق لاحق لـ App في main.tsx،
    // فلو ساوى ترتيبه ترتيب طبقة النوافذ المنبثقة (z-50) في App لظهر فوقها
    // بسبب ترتيب الـ DOM لا تحتها — z-40 يطابق طبقة عناصر الواجهة الثابتة
    // (الشريط العلوي/السفلي والأزرار العائمة) فيختفي تلقائياً خلف أي نافذة
    // منبثقة مفتوحة، تماماً كبقية عناصر الواجهة الدائمة.
    <div className="fixed bottom-36 sm:bottom-40 end-4 sm:end-6 z-40 flex flex-col items-end gap-2">
      {updateAvailable && (
        <button
          type="button"
          onClick={applyUpdate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{labels.update}</span>
        </button>
      )}

      {!isInstalledApp && (
        <a
          href="/downloads/Literium.apk"
          download="Literium.apk"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-600 hover:from-brand-500 hover:to-brand-500 text-white text-sm font-black shadow-lg shadow-brand-600/30 active:scale-95 transition-all"
        >
          <Download className="w-4 h-4" />
          <span>{labels.download}</span>
        </a>
      )}
    </div>
  );
};
