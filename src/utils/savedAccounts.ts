/**
 * إدارة الحسابات المحفوظة على هذا الجهاز.
 *
 * الهدف: تمكين المستخدم من التبديل بين عدة حسابات دون أن يمحو أحدها الآخر،
 * ومن الدخول بحساب جديد تماماً عبر حقول فارغة.
 *
 * ⚠️ قاعدة أمنية صارمة: لا تُحفظ كلمات المرور هنا إطلاقاً — فقط البيانات
 * التعريفية اللازمة لعرض بطاقة الحساب (البريد والاسم والصورة والدور).
 */

export interface SavedAccount {
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  role: string;
  lastUsedAt: string;
}

const STORAGE_KEY = 'literium_saved_accounts';
const MAX_SAVED_ACCOUNTS = 5;

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a: any) => a && typeof a.email === 'string' && typeof a.uid === 'string')
      .sort((a: SavedAccount, b: SavedAccount) =>
        (b.lastUsedAt || '').localeCompare(a.lastUsedAt || '')
      );
  } catch (err) {
    console.error('تعذر قراءة الحسابات المحفوظة:', err);
    return [];
  }
}

/**
 * يضيف حساباً أو يحدّث بياناته دون حذف بقية الحسابات المحفوظة.
 */
export function rememberAccount(account: Omit<SavedAccount, 'lastUsedAt'>): void {
  try {
    if (!account?.uid || !account?.email) return;

    const existing = getSavedAccounts().filter((a) => a.uid !== account.uid);
    const updated: SavedAccount[] = [
      {
        uid: account.uid,
        email: account.email,
        fullName: account.fullName || account.email.split('@')[0],
        avatarUrl: account.avatarUrl || '',
        role: account.role || 'reader',
        lastUsedAt: new Date().toISOString()
      },
      ...existing
    ].slice(0, MAX_SAVED_ACCOUNTS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('تعذر حفظ بيانات الحساب:', err);
  }
}

/**
 * يزيل حساباً واحداً من القائمة فقط، ولا يمس البقية.
 */
export function forgetAccount(uid: string): SavedAccount[] {
  try {
    const remaining = getSavedAccounts().filter((a) => a.uid !== uid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    return remaining;
  } catch (err) {
    console.error('تعذر حذف الحساب المحفوظ:', err);
    return getSavedAccounts();
  }
}
