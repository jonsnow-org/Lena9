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
