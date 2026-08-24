import { auth } from '../firebase';

/**
 * إجراءات إدارية شديدة الخطورة تمسّ بيانات مالية — منفصلة عمداً عن
 * analyticsApi.ts (الذي يحتوي إجراءات تصفير آمنة لا تمسّ أي رقم مالي
 * حقيقي) حتى لا يُخلَط بينهما.
 */

export interface ResetTestFinancialDataResult {
  usersReset: number;
  campaignsReset: number;
  articlesReset: number;
  earningsDeleted: number;
  articlePurchasesDeleted: number;
  transactionsDeleted: number;
  depositRequestsDeleted: number;
  payoutRequestsDeleted: number;
  purchaseRequestsDeleted: number;
  adEventsDeleted: number;
  fraudFlagsDeleted: number;
}

/**
 * يُصفِّر كل الأرصدة والأرباح والإنفاق الإعلاني ومبيعات المقالات على كل
 * حساب/حملة/مقال في المنصة، ويحذف كل سجلات العمليات المالية (إيداعات،
 * سحوبات، مشتريات، أرباح، أحداث إعلانية، بلاغات احتيال). لا رجعة عنه.
 * للأدمن فقط، ويتطلب توكن Firebase حقيقي + تأكيداً صريحاً من السيرفر.
 */
export async function resetAllTestFinancialData(): Promise<ResetTestFinancialDataResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
  const token = await user.getIdToken();
  const res = await fetch('/api/admin/reset-test-financial-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirm: 'RESET_ALL_TEST_FINANCIAL_DATA' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر تصفير البيانات المالية.');
  return data;
}
