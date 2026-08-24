import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
}

export interface ExternalAdsConfig {
  propellerAds: ExternalAdNetworkConfig;
  adsterra: ExternalAdNetworkConfig;
  /**
   * السعر التقديري بالدولار لكل 1000 مشاهدة حقيقية موثّقة لإعلان شبكة
   * خارجية في مواضع الكاتب (ذات حصة ربح ثابتة) — أساس حساب عائد الكاتب
   * من هذه الشبكات بقرار صريح من المالك، مستقلاً تماماً عن الرقم الحقيقي
   * الذي تدفعه الشبكة فعلياً في لوحتها الخاصة (غير متاح للتطبيق أصلاً).
   */
  estimatedCpmUsd: number;
}

const EMPTY_NETWORK: ExternalAdNetworkConfig = { enabled: false, snippet: '' };
const DEFAULT_CONFIG: ExternalAdsConfig = {
  propellerAds: { ...EMPTY_NETWORK },
  adsterra: { ...EMPTY_NETWORK },
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

/** أول شبكة مفعّلة ولديها كود فعلي، أو null إن لم توجد أي واحدة صالحة */
export function pickActiveExternalNetwork(config: ExternalAdsConfig): ExternalAdNetworkConfig | null {
  if (config.propellerAds.enabled && config.propellerAds.snippet.trim()) return config.propellerAds;
  if (config.adsterra.enabled && config.adsterra.snippet.trim()) return config.adsterra;
  return null;
}
