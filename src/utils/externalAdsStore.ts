import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { isRunningInNativeApp } from './nativeAppEnv';
import { ADSTERRA_UNITS, defaultAdsterraUnitsEnabled } from '../constants/adsterraUnits';

// -------------------------------------------------------------------
// إعدادات شبكات إعلانات خارجية احتياطية (PropellerAds / Adsterra) —
// تُعرض فقط في مواضع الإعلانات المملوكة للمنصة (beneficiary: 'platform')
// وفقط عندما لا توجد حملة معلن داخلية نشطة تناسب الموضع، أي كطبقة
// احتياطية رابعة بعد: راعي القسم ← حملة داخلية ← (هذه الطبقة) ← لا شيء.
// نفس نمط "مخزن مفرد" المستخدم في platformAdsStore.ts.
// -------------------------------------------------------------------
export interface ExternalAdNetworkConfig {
  enabled: boolean;
  /** كود HTML/JS الجاهز من لوحة الشبكة الإعلانية، يُلصق كما هو */
  snippet: string;
  /**
   * تأكيد إداري صريح بأن سياسة هذه الشبكة تسمح بعرض نفس هذا الكود داخل
   * تطبيق أصلي (APK) لا داخل متصفح ويب فقط — افتراضياً false لأي شبكة،
   * حتى لو كانت enabled=true للموقع. لا علاقة له بالموقع إطلاقاً (يبقى
   * enabled وحده كافياً هناك) — يُستخدم فقط داخل pickActiveExternalNetwork
   * لمنع عرض شبكة غير مؤكَّدة التوافق حين يعمل الكود داخل تطبيق Capacitor.
   * فعّله يدوياً من لوحة الإدارة فقط بعد التأكد من دعم الشبكة نفسها لهذا
   * الاستخدام (AdSense تحديداً يمنعه صراحة بسياسته المعلنة).
   */
  appSafe: boolean;
}

export interface ExternalAdsConfig {
  propellerAds: ExternalAdNetworkConfig;
  /**
   * adsterra.snippet لم يعد يُستخدم للعرض الفعلي — أصبحت أكواد Adsterra
   * كتالوجاً ثابتاً في الشيفرة (`constants/adsterraUnits.ts`) بدل حقل لصق
   * وحيد لا يتّسع إلا لمقاس واحد. الحقل نفسه أُبقي في الشكل لتوافق أي
   * مستند Firestore قديم فقط. enabled/appSafe يبقيان الاستخدام الحقيقي:
   * enabled = تشغيل/إيقاف شبكة Adsterra بالكامل، appSafe = مفتاح شامل
   * لإيقاف كل وحداتها داخل نسخة APK تحديداً (الموقع لا يتأثر أبداً).
   */
  adsterra: ExternalAdNetworkConfig;
  /** تفعيل/إيقاف مستقل لكل وحدة إعلانية من كتالوج Adsterra (بمعرّفها،
   *  انظر `ADSTERRA_UNITS`) — القيمة الافتراضية لأي وحدة غير موجودة في
   *  هذه الخريطة هي "مفعّلة" (`!== false`)، فلا حاجة لتخزين كل وحدة صراحة
   *  إلا عند إيقافها فعلياً من لوحة الأدمن. */
  adsterraUnits: Record<string, boolean>;
  /** إعلانات "محتوى موصى به" — بطاقات أسفل المقال، بنفس آلية الكود
   *  الجاهز المستخدمة في الشبكتين الأخريين. */
  taboola: ExternalAdNetworkConfig;
  /**
   * Monetag "Vignette" — إعلان بيني كامل الشاشة يظهر أحياناً بين تنقلات
   * الصفحة، وليس بانراً بمقاس ثابت داخل موضع AdSlot محدد كبقية الشبكات
   * أعلاه — لذا لا يُعرض عبر <AdSlot> إطلاقاً، بل يُحمَّل مرة واحدة فقط لكل
   * جلسة تصفح من مكوّن مستقل (`MonetagVignetteLoader`) في جذر التطبيق.
   * غير متاح لنسخة APK إطلاقاً وبشكل دائم (وليس بخيار إداري قابل للتبديل):
   * يعتمد حقن سكربت خام في DOM المتصفح مباشرة، ولا يوجد محرك DOM/JavaScript
   * كهذا داخل تطبيق Kotlin/Compose الأصلي أصلاً — enabled وحده يكفي هنا،
   * والاستبعاد عن APK مضمون دوماً عبر isRunningInNativeApp() في المُحمِّل
   * نفسه بصرف النظر عن أي إعداد.
   */
  monetag: { enabled: boolean };
  /**
   * السعر التقديري بالدولار لكل 1000 مشاهدة حقيقية موثّقة لإعلان شبكة
   * خارجية في مواضع الكاتب (ذات حصة ربح ثابتة) — أساس حساب عائد الكاتب
   * من هذه الشبكات بقرار صريح من المالك، مستقلاً تماماً عن الرقم الحقيقي
   * الذي تدفعه الشبكة فعلياً في لوحتها الخاصة (غير متاح للتطبيق أصلاً).
   */
  estimatedCpmUsd: number;
}

const EMPTY_NETWORK: ExternalAdNetworkConfig = { enabled: false, snippet: '', appSafe: false };
// Adsterra مفعّلة افتراضياً بأكواد المالك الحقيقية الثابتة في الشيفرة —
// enabled=true/appSafe=true لأن كل الوحدات المُختارة (Banner/Native Banner
// ثابتة المقاس) تم التحقق من كونها لا تضر تجربة المستخدم على الموقع أو
// داخل تطبيق APK، بخلاف الشبكات الأخرى التي تبقى معطّلة حتى يلصق الأدمن
// كوداً حقيقياً بنفسه.
const DEFAULT_CONFIG: ExternalAdsConfig = {
  propellerAds: { ...EMPTY_NETWORK },
  adsterra: { enabled: true, snippet: '', appSafe: true },
  adsterraUnits: defaultAdsterraUnitsEnabled(),
  taboola: { ...EMPTY_NETWORK },
  // مفعّلة افتراضياً بنفس منطق Adsterra: كود المالك الحقيقي، ثابت في الشيفرة.
  monetag: { enabled: true },
  estimatedCpmUsd: 2
};

let currentValue: ExternalAdsConfig = DEFAULT_CONFIG;
let started = false;
const listeners = new Set<(config: ExternalAdsConfig) => void>();

function ensureStarted() {
  if (started) return;
  started = true;
  onSnapshot(
    doc(db, 'settings', 'externalAds'),
    (snap) => {
      const data = snap.exists() ? (snap.data() as any) : {};
      currentValue = {
        propellerAds: { ...EMPTY_NETWORK, ...(data.propellerAds || {}) },
        adsterra: { ...DEFAULT_CONFIG.adsterra, ...(data.adsterra || {}) },
        adsterraUnits: { ...defaultAdsterraUnitsEnabled(), ...(data.adsterraUnits || {}) },
        taboola: { ...EMPTY_NETWORK, ...(data.taboola || {}) },
        monetag: { ...DEFAULT_CONFIG.monetag, ...(data.monetag || {}) },
        estimatedCpmUsd:
          typeof data.estimatedCpmUsd === 'number' && data.estimatedCpmUsd >= 0
            ? data.estimatedCpmUsd
            : DEFAULT_CONFIG.estimatedCpmUsd
      };
      listeners.forEach((cb) => cb(currentValue));
    },
    (error) => {
      console.error('تعذر تحميل إعدادات الشبكات الإعلانية الخارجية:', error);
    }
  );
}

export function getExternalAdsConfig(): ExternalAdsConfig {
  return currentValue;
}

export function subscribeExternalAdsConfig(cb: (config: ExternalAdsConfig) => void): () => void {
  ensureStarted();
  listeners.add(cb);
  cb(currentValue);
  return () => listeners.delete(cb);
}

/**
 * أول شبكة مفعّلة ولديها كود فعلي، أو null إن لم توجد أي واحدة صالحة.
 *
 * داخل تطبيق أصلي (APK عبر Capacitor)، تُستبعَد أي شبكة appSafe=false
 * تلقائياً حتى لو كانت enabled=true — الموقع (متصفح الويب) لا يتأثر
 * بهذا الفحص إطلاقاً ويستمر بعرض كل الشبكات المفعّلة كما هي دائماً؛
 * القيد يُطبَّق فقط حين isRunningInNativeApp() تُرجع true فعلياً.
 */
export function pickActiveExternalNetwork(config: ExternalAdsConfig): ExternalAdNetworkConfig | null {
  const insideNativeApp = isRunningInNativeApp();
  const isEligible = (net: ExternalAdNetworkConfig) =>
    net.enabled && net.snippet.trim() && (!insideNativeApp || net.appSafe);
  const isAdsterraEligible = (net: ExternalAdNetworkConfig) =>
    net.enabled &&
    (!insideNativeApp || net.appSafe) &&
    ADSTERRA_UNITS.some((u) => (config.adsterraUnits ?? {})[u.id] !== false);

  if (isEligible(config.propellerAds)) return config.propellerAds;
  if (isAdsterraEligible(config.adsterra)) return config.adsterra;
  if (isEligible(config.taboola)) return config.taboola;
  return null;
}

/**
 * كل الشبكات الخارجية المؤهّلة فعلياً (مفعّلة + كود حقيقي + متوافقة مع
 * بيئة التشغيل الحالية) — وليس أولها فقط كما في pickActiveExternalNetwork
 * أعلاه. تُستخدم لبناء تجمّع دوران عادل في <AdSlot> يشمل الحملات الداخلية
 * والشبكات الخارجية معاً، بدل ترتيب أولوية ثابت يفوز فيه طرف واحد دوماً.
 */
export function getAllEligibleExternalNetworks(config: ExternalAdsConfig): ExternalAdNetworkConfig[] {
  const insideNativeApp = isRunningInNativeApp();
  const isEligible = (net: ExternalAdNetworkConfig) =>
    net.enabled && net.snippet.trim() && (!insideNativeApp || net.appSafe);
  const isAdsterraEligible = (net: ExternalAdNetworkConfig) =>
    net.enabled &&
    (!insideNativeApp || net.appSafe) &&
    ADSTERRA_UNITS.some((u) => (config.adsterraUnits ?? {})[u.id] !== false);

  const result: ExternalAdNetworkConfig[] = [];
  if (isEligible(config.propellerAds)) result.push(config.propellerAds);
  if (isAdsterraEligible(config.adsterra)) result.push(config.adsterra);
  if (isEligible(config.taboola)) result.push(config.taboola);
  return result;
}
