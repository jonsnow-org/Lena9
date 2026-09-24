// كشف تشغيل الموقع داخل تطبيق Literium المثبَّت (APK — غلاف TWA):
//  - ?source=twa: يُضاف إلى رابط البدء في twa-init.cjs — العلامة الأوثق.
//  - display-mode:standalone / referrer ببادئة android-app://: علامات TWA
//    القياسية (الـreferrer يضيع بعد أي إعادة تحميل، لذا يُحفظ الكشف في
//    sessionStorage طوال الجلسة).
//  - "LiteriumNativeApp/": علامة غلاف WebView القديم، أُبقيت احتياطاً.
const SESSION_KEY = 'literium_in_app';
const DEVICE_KEY = 'literium_app_seen_at';
// تطبيق TWA يشارك تخزين Chrome على نفس الجهاز، فآخر فتح للتطبيق يُعرف من
// المتصفح أيضاً. بعد 30 يوماً بلا فتح نفترض أنه رُبما حُذف فيعود زر التحميل.
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function detectInstalledApp(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return true;
    if (new URLSearchParams(window.location.search).get('source') === 'twa') return true;
    if (window.navigator.userAgent.includes('LiteriumNativeApp/')) return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (document.referrer.startsWith('android-app://')) return true;
    if ((window.navigator as unknown as {standalone?: boolean}).standalone) return true;
  } catch {
    // بيئات نادرة قد ترمي هنا — نتعامل معها كمتصفح عادي
  }
  return false;
}

let cached: boolean | null = null;

export function isRunningAsInstalledApp(): boolean {
  if (cached !== null) return cached;
  cached = detectInstalledApp();
  if (cached) {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
      localStorage.setItem(DEVICE_KEY, String(Date.now()));
    } catch {
      // التخزين محجوب — الكشف الحالي يبقى صحيحاً لهذه الجلسة
    }
  }
  return cached;
}

/** هل هذا الجهاز يملك التطبيق (يعمل داخله الآن أو فُتح مؤخراً عليه)؟ */
export function hasAppOnThisDevice(): boolean {
  if (isRunningAsInstalledApp()) return true;
  try {
    const seenAt = Number(localStorage.getItem(DEVICE_KEY) || 0);
    return seenAt > 0 && Date.now() - seenAt < DEVICE_TTL_MS;
  } catch {
    return false;
  }
}

/** ملف APK مفيد فقط لأجهزة أندرويد — لا معنى لعرضه على آيفون أو حاسوب. */
export function isAndroidDevice(): boolean {
  try {
    return /Android/i.test(window.navigator.userAgent);
  } catch {
    return false;
  }
}

/**
 * Chrome على أندرويد يستطيع إخبارنا إن كان التطبيق مثبَّتاً (manifest.json →
 * related_applications، والتطبيق يعلن عن الموقع عبر asset_statements). عند
 * التأكد يُحفظ في التخزين فيختفي زر التحميل فوراً في الزيارات التالية.
 */
export async function detectInstalledRelatedApp(): Promise<boolean> {
  try {
    const nav = window.navigator as unknown as {
      getInstalledRelatedApps?: () => Promise<Array<{ id?: string }>>;
    };
    if (typeof nav.getInstalledRelatedApps !== 'function') return false;
    const apps = await nav.getInstalledRelatedApps();
    const installed = apps.some((a) => a.id === 'studio.ai.literium.literium_app');
    if (installed) localStorage.setItem(DEVICE_KEY, String(Date.now()));
    return installed;
  } catch {
    return false;
  }
}
