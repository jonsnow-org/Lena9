import { auth } from '../firebase';

/**
 * إنشاء (تهيئة) حسابات بوتات النشر والتفاعل التلقائي الثمانية — للأدمن
 * فقط، يتحقق منه السيرفر عبر توكن Firebase حقيقي. إجراء آمن وقابل للتكرار
 * (idempotent): لا يُنشئ حساباً موجوداً مسبقاً أو يُعدّل بياناته.
 */
export async function seedBotAccounts(): Promise<{ created: number; alreadyExisted: number; total: number }> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
  const token = await user.getIdToken();
  const res = await fetch('/api/admin/bots/seed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر إنشاء حسابات البوتات.');
  return data;
}
