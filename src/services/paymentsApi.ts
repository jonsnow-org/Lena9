/**
 * عميل بوابة الدفع الآلية (اختيارية) — كل نقطة تتحقق أولاً من
 * /api/payments/status، وتُستخدَم فقط عندما تكون النتيجة automated=true
 * (أي أن المالك ضبط مفاتيح Stripe و Firebase Admin على الخادم). في غير
 * ذلك، الواجهة تعتمد كلياً على مسار الطلب اليدوي الحالي دون أي تغيير.
 */
import { auth } from '../firebase';

export interface PaymentStatus {
  automated: boolean;
  provider: string | null;
  adminConfigured: boolean;
  reason?: string;
}

export interface PayoutAccountStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  onboardingUrl?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchPaymentStatus(): Promise<PaymentStatus> {
  try {
    const res = await fetch('/api/payments/status');
    if (!res.ok) return { automated: false, provider: null, adminConfigured: false };
    return await res.json();
  } catch {
    // أي فشل في الوصول لنقطة الحالة نفسها يعني أن الأفضل الاعتماد على
    // المسار اليدوي المضمون بدل تعليق الواجهة.
    return { automated: false, provider: null, adminConfigured: false };
  }
}

export async function createDepositCheckout(amount: number): Promise<{ checkoutUrl: string }> {
  const headers = await authHeaders();
  const res = await fetch('/api/payments/deposit/create-checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر بدء عملية الإيداع.');
  return data;
}

/**
 * حالة الدفع الفوري بعملات رقمية عبر NOWPayments — مستقلة تماماً عن
 * حالة Stripe (fetchPaymentStatus أعلاه)، قد تعمل إحداهما دون الأخرى.
 */
export async function fetchNowPaymentsStatus(): Promise<{ automated: boolean }> {
  try {
    const res = await fetch('/api/payments/nowpayments/status');
    if (!res.ok) return { automated: false };
    return await res.json();
  } catch {
    return { automated: false };
  }
}

export async function createNowPaymentsInvoice(amount: number): Promise<{ checkoutUrl: string }> {
  const headers = await authHeaders();
  const res = await fetch('/api/payments/nowpayments/create-invoice', {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر بدء عملية الدفع بالعملة الرقمية.');
  return data;
}

export interface NowPaymentsDirectPayment {
  payAddress: string;
  payCurrency: string;
  payAmount: number;
}

/**
 * عنوان استلام USDT-TRC20 مباشر — يُعرض للمستخدم مع زر نسخ ليدفع عبر وسيط
 * بطاقة↔كريبتو خارجي (Guardarian) يلصق فيها العنوان يدوياً. لا يوجد تعبئة
 * تلقائية موثوقة عبر رابط جاهز (اختُبر ولم يعمل مع أكثر من مزوّد).
 */
export async function createNowPaymentsDirectPayment(amount: number): Promise<NowPaymentsDirectPayment> {
  const headers = await authHeaders();
  const res = await fetch('/api/payments/nowpayments/create-direct-payment', {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر إنشاء عنوان استلام الدفع.');
  return data;
}

export async function fetchPayoutAccountStatus(): Promise<PayoutAccountStatus> {
  const headers = await authHeaders();
  const res = await fetch('/api/payments/payout/status', { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر فحص حالة حساب السحب.');
  return data;
}

export async function createPayoutConnectLink(): Promise<{ accountId: string; status: PayoutAccountStatus }> {
  const headers = await authHeaders();
  const res = await fetch('/api/payments/payout/connect-link', { method: 'POST', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر إنشاء رابط ربط حساب السحب.');
  return data;
}

export async function createAutomatedPayout(amount: number): Promise<{ ok: boolean; providerRef?: string }> {
  const headers = await authHeaders();
  const res = await fetch('/api/payments/payout/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر تنفيذ عملية السحب.');
  return data;
}

export interface UnlockArticleResult {
  success: boolean;
  alreadyUnlocked: boolean;
  price: number;
  newBalance: number | null;
}

/**
 * شراء/فتح مقال مقفول — فوري: يتحقق السيرفر من الرصيد ويخصمه مباشرة
 * (بدل إنشاء طلب pending ينتظر اعتماد المالك يدوياً).
 */
export async function unlockArticle(articleId: string): Promise<UnlockArticleResult> {
  const headers = await authHeaders();
  const res = await fetch('/api/articles/unlock', {
    method: 'POST',
    headers,
    body: JSON.stringify({ articleId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر إتمام عملية الشراء.');
  return data;
}

export interface FundCampaignResult {
  success: boolean;
  alreadyFunded: boolean;
  budget: number;
  newBalance: number | null;
}

/**
 * تمويل/تفعيل حملة إعلانية فور إنشائها — يخصم المعلن نفسه ميزانيتها
 * المطلوبة فوراً (بدل انتظار اعتماد يدوي من الأدمن لم يعد له مسار فعلي).
 */
export async function fundCampaign(campaignId: string): Promise<FundCampaignResult> {
  const headers = await authHeaders();
  const res = await fetch('/api/campaigns/fund', {
    method: 'POST',
    headers,
    body: JSON.stringify({ campaignId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر تمويل الحملة.');
  return data;
}
