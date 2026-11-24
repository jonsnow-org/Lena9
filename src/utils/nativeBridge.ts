// قناة LiteriumNative يحقنها تطبيق أندرويد (MainActivity.kt) لصفحات موقعنا فقط.
interface NativeChannel {
  postMessage: (message: string) => void;
}

function channel(): NativeChannel | null {
  const c = (window as unknown as { LiteriumNative?: NativeChannel }).LiteriumNative;
  return c && typeof c.postMessage === 'function' ? c : null;
}

function send(payload: Record<string, unknown>): boolean {
  const c = channel();
  if (!c) return false;
  try {
    c.postMessage(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function hasNativeBridge(): boolean {
  return channel() !== null;
}

/** نافذة المشاركة الأصيلة لأندرويد. تُرجع false خارج التطبيق فيُستخدم البديل. */
export function nativeShare(data: { title: string; text?: string; url: string }): boolean {
  return send({ type: 'share', title: data.title, text: data.text || '', url: data.url });
}

/** يطلب من تطبيق APK إظهار/إخفاء شريط Start.io الأصلي أسفل الشاشة. */
export function setNativeBannerAds(enabled: boolean): void {
  send({ type: 'nativeAds', startIo: enabled });
}

export function setNativeSystemBars(color: string, light: boolean): void {
  send({ type: 'systemBars', color, light });
}

/** يطلب من التطبيق الأصلي عرض إعلان Start.io البيني عند فاصل طبيعي (مثل إغلاق مقال).
 *  القرار النهائي للتطبيق: يطبّق حدّ التكرار ويتجاهل الطلب إن لم يكن الإعلان جاهزاً. */
export function requestNativeInterstitial() {
  send({ type: 'showInterstitial' });
}
