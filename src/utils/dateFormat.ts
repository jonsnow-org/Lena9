/**
 * تنسيق التواريخ والأوقات بالعربية.
 *
 * ⚠️ سبب وجود هذا الملف: كانت التواريخ تُعرض خاماً كما هي مخزّنة
 * (مثل "2026-08-19T09:04:53.414Z")، أو كنص ثابت مثل "دقيقتان" لا يتغير
 * أبداً مهما مرّ الوقت. الآن يُحسب الفارق الزمني فعلياً من التاريخ المخزّن.
 */

/**
 * يحوّل أي صيغة تاريخ مخزّنة إلى كائن Date، أو null إن تعذّر.
 * يدعم: ISO string، طابع زمني رقمي، وكائن Firestore Timestamp.
 */
export function parseStoredDate(value: any): Date | null {
  if (!value) return null;

  // كائن Firestore Timestamp
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // نصوص قديمة محفوظة بصيغة بشرية مثل "الآن" — لا يمكن تحويلها
    if (!/\d{4}/.test(trimmed)) return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * الوقت النسبي بالعربية: "قبل 3 ساعات"، "أمس"، "قبل يومين"...
 */
export function timeAgoAr(value: any): string {
  const date = parseStoredDate(value);
  if (!date) {
    // لو كان النص غير قابل للتحويل، أعده كما هو بدلاً من عرض خطأ
    return typeof value === 'string' && value.trim() ? value : '';
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 0) return 'الآن';
  if (seconds < 60) return 'الآن';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    if (minutes === 1) return 'قبل دقيقة';
    if (minutes === 2) return 'قبل دقيقتين';
    if (minutes <= 10) return `قبل ${minutes} دقائق`;
    return `قبل ${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return 'قبل ساعة';
    if (hours === 2) return 'قبل ساعتين';
    if (hours <= 10) return `قبل ${hours} ساعات`;
    return `قبل ${hours} ساعة`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    if (days === 1) return 'أمس';
    if (days === 2) return 'قبل يومين';
    if (days <= 10) return `قبل ${days} أيام`;
    return `قبل ${days} يوماً`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    if (months === 1) return 'قبل شهر';
    if (months === 2) return 'قبل شهرين';
    if (months <= 10) return `قبل ${months} أشهر`;
    return `قبل ${months} شهراً`;
  }

  const years = Math.floor(months / 12);
  if (years === 1) return 'قبل سنة';
  if (years === 2) return 'قبل سنتين';
  if (years <= 10) return `قبل ${years} سنوات`;
  return `قبل ${years} سنة`;
}

/**
 * تاريخ كامل بالعربية: "19 أغسطس 2026".
 */
export function formatDateAr(value: any): string {
  const date = parseStoredDate(value);
  if (!date) return typeof value === 'string' ? value : '';
  try {
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * تاريخ ووقت معاً — للسجلات والمعاملات.
 */
export function formatDateTimeAr(value: any): string {
  const date = parseStoredDate(value);
  if (!date) return typeof value === 'string' ? value : '';
  try {
    return date.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return date.toISOString();
  }
}
