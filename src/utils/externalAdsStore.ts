import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { isRunningInNativeApp } from './nativeAppEnv';

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
  adsterra: ExternalAdNetworkConfig;
  /** إعلانات "محتوى موصى به" — بطاقات أسفل المقال، بنفس آلية الكود
   *  الجاهز المستخدمة في الشبكتين الأخريين. */
  taboola: ExternalAdNetworkConfig;
  /**
   * السعر التقديري بالدولار لكل 1000 مشاهدة حقيقية موثّقة لإعلان شبكة
   * خارجية في مواضع الكاتب (ذات حصة ربح ثابتة) — أساس حساب عائد الكاتب
   * من هذه الشبكات بقرار صريح من المالك، مستقلاً تماماً عن الرقم الحقيقي
   * الذي تدفعه الشبكة فعلياً في لوحتها الخاصة (غير متاح للتطبيق أصلاً).
   */
  estimatedCpmUsd: number;
}

const EMPTY_NETWORK: ExternalAdNetworkConfig = { enabled: false, snippet: '', appSafe: false };
const DEFAULT_CONFIG: ExternalAdsConfig = {
  propellerAds: { ...EMPTY_NETWORK },
  adsterra: { ...EMPTY_NETWORK },
  taboola: { ...EMPTY_NETWORK },
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
        adsterra: { ...EMPTY_NETWORK, ...(data.adsterra || {}) },
        taboola: { ...EMPTY_NETWORK, ...(data.taboola || {}) },
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

  if (isEligible(config.propellerAds)) return config.propellerAds;
  if (isEligible(config.adsterra)) return config.adsterra;
  if (isEligible(config.taboola)) return config.taboola;
  return null;
}
