import {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {SplashScreen} from './components/SplashScreen.tsx';
import './index.css';
import {applyStoredThemePresetImmediately} from './utils/themeEngine';

// يُطبَّق قبل أول رسم للواجهة — يمنع أي "وميض" للون الافتراضي البنفسجي
// قبل تحميل القالب اللوني الذي اختاره المالك سابقاً لهذا الجهاز.
applyStoredThemePresetImmediately();

// تسجيل Service Worker للأصول الثابتة فقط (انظر شرح public/sw.js) — بعد
// اكتمال تحميل الصفحة حتى لا يزاحم أول رسم، وفي وضع الإنتاج فقط تفادياً
// لتضارب أي تخزين مؤقت مع إعادة التحميل الفوري (HMR) أثناء التطوير المحلي.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
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
      <App />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
