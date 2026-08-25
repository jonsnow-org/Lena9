/**
 * إيداع فوري بعملات رقمية عبر NOWPayments — منفصل تماماً عن StripeProvider
 * (لا يُقحَم في نفس واجهة PaymentProvider) لأن نموذج NOWPayments مختلف
 * جوهرياً: لا يوجد مفهوم "حساب مرتبط" (Connect) للسحب، فقط فاتورة دفع
 * (Invoice) للإيداع، وواجهة Mass Payouts منفصلة للسحب تتطلب مصادقة
 * بجلسة دخول (JWT عبر بريد/كلمة مرور، أحياناً مع 2FA) — بيانات حساسة
 * جداً لا ينبغي لأي كود خادم التعامل معها آلياً. لذلك:
 *
 * - الإيداع: آلي بالكامل عبر مفتاح API فقط (Invoice API).
 * - السحب بالعملات الرقمية: يبقى بالمسار اليدوي الحالي (طلب ← تحويل
 *   يدوي من الأدمن فعلياً عبر لوحة NOWPayments أو محفظته) — تماماً كحال
 *   أي سحب لم يُفعَّل له مزوّد آلي بعد.
 */
import { createHmac } from 'crypto';

const NOWPAYMENTS_API_BASE = 'https://api.nowpayments.io/v1';

export function isNowPaymentsConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY);
}

export function isNowPaymentsIpnConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_IPN_SECRET);
}

export interface NowPaymentsInvoiceResult {
  invoiceUrl: string;
  invoiceId: string;
}

export interface NowPaymentsDirectPaymentResult {
  paymentId: string;
  payAddress: string;
  payCurrency: string;
  payAmount: number;
}

export async function createNowPaymentsInvoice(params: {
  uid: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
  /**
   * تعمّدت جعله اختيارياً: تمرير رابط ويب هوك هنا يستبدل — لكل فاتورة —
   * رابط IPN الافتراضي المضبوط يدوياً في لوحة NOWPayments (Settings →
   * IPN)، وهو مبني على host مُستنتَج من الطلب (req.get('host')) قد لا
   * يطابق النطاق العام الفعلي خلف أي وسيط/دومين مخصص. تركه فارغاً يجعل
   * NOWPayments يستخدم رابط IPN الذي تحقّق صاحب المنصة يدوياً من صحته —
   * أضمن من أي استنتاج تلقائي وقت التشغيل.
   */
  ipnCallbackUrl?: string;
}): Promise<NowPaymentsInvoiceResult> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error('nowpayments_not_configured');

  const requestBody: Record<string, unknown> = {
    price_amount: params.amount,
    price_currency: 'usd',
    order_id: `${params.uid}_${Date.now()}`,
    order_description: 'شحن محفظة ليتيريوم',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl
  };
  if (params.ipnCallbackUrl) requestBody.ipn_callback_url = params.ipnCallbackUrl;

  const res = await fetch(`${NOWPAYMENTS_API_BASE}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const body = await res.json();
  if (!res.ok || !body.invoice_url) {
    throw new Error(body?.message || 'تعذر إنشاء فاتورة الدفع بالعملة الرقمية.');
  }

  return { invoiceUrl: body.invoice_url, invoiceId: String(body.id) };
}

/**
 * إنشاء "دفعة مباشرة" (Payment API، لا Invoice API) — تُرجع pay_address حقيقي
 * لعملة/شبكة محددة صراحة (usdttrc20 هنا)، بدل صفحة NOWPayments المستضافة.
 * الغرض الوحيد: عرض هذا العنوان للمستخدم (مع زر نسخ) ليدفع عبر بوابة
 * بطاقة↔كريبتو خارجية يلصق فيها العنوان يدوياً، بما إن التعبئة التلقائية
 * عبر رابط جاهز غير موثوقة (اختُبرت مع Guardarian ولم تعمل).
 */
export async function createNowPaymentsDirectPayment(params: {
  uid: string;
  amount: number;
  ipnCallbackUrl?: string;
}): Promise<NowPaymentsDirectPaymentResult> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error('nowpayments_not_configured');

  const requestBody: Record<string, unknown> = {
    price_amount: params.amount,
    price_currency: 'usd',
    pay_currency: 'usdttrc20',
    order_id: `${params.uid}_${Date.now()}`,
    order_description: 'شحن محفظة ليتيريوم - دفع بالبطاقة عبر وسيط خارجي'
  };
  if (params.ipnCallbackUrl) requestBody.ipn_callback_url = params.ipnCallbackUrl;

  const res = await fetch(`${NOWPAYMENTS_API_BASE}/payment`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const body = await res.json();
  if (!res.ok || !body.pay_address) {
    throw new Error(body?.message || 'تعذر إنشاء عنوان استلام الدفع.');
  }

  return {
    paymentId: String(body.payment_id),
    payAddress: String(body.pay_address),
    payCurrency: String(body.pay_currency || 'usdttrc20'),
    payAmount: Number(body.pay_amount)
  };
}

/**
 * يتحقق من توقيع إشعار الدفع (IPN) الوارد من NOWPayments — بترتيب أبجدي
 * صارم لمفاتيح الجسم قبل التوقيع (خاصية موثّقة من NOWPayments نفسها، لا
 * يعمل التحقق بدونها).
 */
export function verifyNowPaymentsIpnSignature(rawBody: any, signatureHeader: string | undefined): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signatureHeader) return false;

  const sortedBody = sortObjectKeys(rawBody);
  const computed = createHmac('sha512', secret).update(JSON.stringify(sortedBody)).digest('hex');
  return computed === signatureHeader;
}

function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortObjectKeys(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}
