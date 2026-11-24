import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

// public/version.json يُكتَب طازجاً قبل كل بناء (انظر scripts/stamp-version.mjs،
// يُستدعى تلقائياً عبر "prebuild"). نقرأ نفس القيمة هنا لنخبزها داخل حزمة
// الجافاسكربت — هذا ما يتيح لمكوّن التحقق من التحديثات بالمتصفح مقارنة "النسخة
// المخبوزة في الكود الذي يعمل الآن" بـ"النسخة المنشورة فعلياً على الخادم".
function readBuildId(): string {
  try {
    const raw = readFileSync(path.resolve(__dirname, 'public/version.json'), 'utf8');
    return JSON.parse(raw).build ?? 'dev';
  } catch {
    return 'dev';
  }
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_BUILD__: JSON.stringify(readBuildId()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
