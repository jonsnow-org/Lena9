import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {applyStoredThemePresetImmediately} from './utils/themeEngine';

// يُطبَّق قبل أول رسم للواجهة — يمنع أي "وميض" للون الافتراضي البنفسجي
// قبل تحميل القالب اللوني الذي اختاره المالك سابقاً لهذا الجهاز.
applyStoredThemePresetImmediately();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
