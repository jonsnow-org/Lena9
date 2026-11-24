// يُشغَّل تلقائياً قبل كل بناء (npm run build يستدعي prebuild). يكتب رقم
// إصدار فريد لهذه النسخة إلى public/version.json — vite.config.ts يقرأ
// نفس الملف ويحقن نفس القيمة داخل الحزمة المبنية عبر define. بهذا تصبح
// القيمة المخبوزة في الجافاسكربت المحمَّل في المتصفح، والقيمة التي يجلبها
// عبر الشبكة من /version.json بعد أي نشر جديد، قابلتين للمقارنة لاكتشاف
// وجود تحديث دون أي خادم إضافي أو منطق Service Worker معقّد.
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildId = Date.now().toString(36);
const outPath = join(__dirname, '..', 'public', 'version.json');

writeFileSync(outPath, JSON.stringify({ build: buildId }), 'utf8');
console.log(`[stamp-version] build=${buildId} -> ${outPath}`);
