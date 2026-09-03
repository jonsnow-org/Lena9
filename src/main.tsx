import {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {SplashScreen} from './components/SplashScreen.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import {ErrorLogButton} from './components/ErrorLogButton.tsx';
import './index.css';
import {applyStoredThemePresetImmediately} from './utils/themeEngine';
import {initErrorLog} from './utils/errorLog';

// يُسجَّل قبل أي شيء آخر — يلتقط حتى الأعطال التي تحدث أثناء تحميل باقي
// الوحدات نفسها، قبل أن يُرسم أي شيء على الشاشة إطلاقاً.
initErrorLog();

// يُطبَّق قبل أول رسم للواجهة — يمنع أي "وميض" للون الافتراضي البنفسجي
// قبل تحميل القالب اللوني الذي اختاره المالك سابقاً لهذا الجهاز.
applyStoredThemePresetImmediately();

// تسجيل Service Worker للأصول الثابتة فقط (انظر شرح public/sw.js) — بعد
// اكتمال تحميل الصفحة حتى لا يزاحم أول رسم. لا يُقيَّد بفحص "وضع
// الإنتاج" (كان يعتمد على import.meta.env.PROD الذي لم يُتأكَّد من
// ضبطه بنفس الطريقة المتوقَّعة على كل بيئات النشر) — تسجيله في أي بيئة
// غير ضار: أسوأ حالة أنه يخزّن أصولاً ثابتة محلياً حتى أثناء التطوير.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// شاشة البدء (Splash) عنصر مستقل تماماً عن App — يُعرض فوقه كطبقة بينما
// App يُحمَّل بالفعل بالخلفية (مصادقة، بيانات...)، فتختفي الشاشة على
// محتوى جاهز فعلاً لا شاشة تحميل فارغة. وضعها هنا (لا داخل App نفسه)
// يتفادى أي خطر بترتيب الـ hooks داخل مكوّن App الضخم متعدد التفرعات.
function Root() {
  const [showSplash, setShowSplash] = useState(true);
  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      {/* عمداً خارج ErrorBoundary — يبقى يعمل حتى لو تعطّل App بالكامل. */}
      <ErrorLogButton />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
