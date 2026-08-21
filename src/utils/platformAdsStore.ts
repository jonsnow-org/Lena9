import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// -------------------------------------------------------------------
// مفتاح تشغيل/إيقاف إعلانات المنصة العامة (Platform Ads) — عالمي لكل
// المستخدمين، يتحكم فيه المالك من لوحة الإدارة.
// -------------------------------------------------------------------
// نمط "مخزن مفرد" بسيط (Singleton store) بدل تمرير الحالة كخاصية عبر
// عشرات المكوّنات التي تستخدم <AdSlot> (الصفحة الرئيسية، الاستكشاف،
// صفحة المقال، صفحة الكاتب، التعليقات...) — استماع واحد فقط لـ
// Firestore يُشارَك بين كل نسخ AdSlot المعروضة في نفس الصفحة.
let currentValue = true;
let started = false;
const listeners = new Set<(enabled: boolean) => void>();

function ensureStarted() {
  if (started) return;
  started = true;
  onSnapshot(
    doc(db, 'settings', 'platformAds'),
    (snap) => {
      const enabled = snap.exists() ? snap.data().enabled !== false : true;
      currentValue = enabled;
      listeners.forEach((cb) => cb(enabled));
    },
    (error) => {
      console.error('تعذر تحميل إعداد إعلانات المنصة:', error);
    }
  );
}

export function getPlatformAdsEnabled(): boolean {
  return currentValue;
}

export function subscribePlatformAdsEnabled(cb: (enabled: boolean) => void): () => void {
  ensureStarted();
  listeners.add(cb);
  cb(currentValue);
  return () => listeners.delete(cb);
}
