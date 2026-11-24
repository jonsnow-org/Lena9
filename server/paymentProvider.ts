/**
 * طبقة تجريد بوابات الدفع — منفصلة تماماً عن Firebase وعن أي خطة مدفوعة
 * منها. أي مزوّد دفع (Stripe، PayPal، معالج عملات رقمية...) يمكن أن
 * يُضاف لاحقاً بتطبيق الواجهة PaymentProvider نفسها أدناه، ثم تسجيله في
 * server.ts. المزوّد الوحيد المُفعَّل فعلياً الآن هو Stripe كمرجع كامل
 * وجاهز — الإيداع عبر Stripe Checkout، والسحب عبر Stripe Connect
 * (Express accounts)، وهو الأسلوب القياسي الذي تعتمده كل منصات "منشئي
 * المحتوى" الحقيقية لدفع مستحقات المستخدمين تلقائياً.
 *
 * كل شيء هنا خامل تماماً بدون مفاتيح — isConfigured() تعيد false ولا
 * يُستدعى أي كود آخر، فيبقى المسار اليدوي الحالي (طلب ← موافقة الأدمن)
 * يعمل تماماً كما هو دون أي تغيير.
 */
import Stripe from 'stripe';

export interface DepositCheckoutResult {
  checkoutUrl: string;
  providerRef: string;
}

export interface PayoutResult {
  ok: boolean;
  providerRef?: string;
  reason?: string;
}

export interface ConnectedAccountStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  onboardingUrl?: string;
}

export interface PaymentProvider {
  readonly name: string;
  isConfigured(): boolean;

  createDepositCheckout(params: {
    uid: string;
    amount: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<DepositCheckoutResult>;

  /** يتحقق من توقيع الحدث الوارد من بوابة الدفع ويحوّله لصيغة موحّدة. */
  parseWebhookEvent(rawBody: Buffer, signatureHeader: string | undefined): PaymentWebhookEvent | null;

  /** يضمن وجود حساب استلام أموال للمستخدم، ويعيد رابط تفعيل/تحقق إن لزم. */
  ensurePayoutAccount(params: {
    uid: string;
    email: string | null;
    existingAccountId?: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ accountId: string; status: ConnectedAccountStatus }>;

  getPayoutAccountStatus(accountId: string): Promise<ConnectedAccountStatus>;

  createPayout(params: { accountId: string; amount: number; currency: string; uid: string }): Promise<PayoutResult>;
}

export type PaymentWebhookEvent =
  | { kind: 'deposit_completed'; uid: string; amount: number; currency: string; providerRef: string; eventId: string }
  | { kind: 'payout_account_updated'; accountId: string; payoutsEnabled: boolean; eventId: string }
  | { kind: 'ignored'; eventId: string };

// ---------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------

class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private client: Stripe | null = null;

  private getClient(): Stripe {
    if (!this.client) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error('STRIPE_SECRET_KEY غير مضبوط.');
      this.client = new Stripe(key);
    }
    return this.client;
  }

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }

  async createDepositCheckout(params: {
    uid: string;
    amount: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<DepositCheckoutResult> {
    const stripe = this.getClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: { name: 'شحن محفظة ليتيريوم' },
            unit_amount: Math.round(params.amount * 100)
          },
          quantity: 1
        }
      ],
      metadata: { uid: params.uid, kind: 'wallet_deposit' },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl
    });

    if (!session.url) throw new Error('تعذر إنشاء جلسة الدفع.');
    return { checkoutUrl: session.url, providerRef: session.id };
  }

  parseWebhookEvent(rawBody: Buffer, signatureHeader: string | undefined): PaymentWebhookEvent | null {
    const stripe = this.getClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET غير مضبوط.');
    if (!signatureHeader) throw new Error('missing_signature');

    // التحقق من التوقيع إلزامي — بدونه أي طرف يستطيع تزوير طلب "دفع ناجح"
    // وشحن محفظته مجاناً.
    const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      if (!uid || session.metadata?.kind !== 'wallet_deposit') {
        return { kind: 'ignored', eventId: event.id };
      }
      const amount = (session.amount_total || 0) / 100;
      if (amount <= 0) return { kind: 'ignored', eventId: event.id };
      return {
        kind: 'deposit_completed',
        uid,
        amount,
        currency: (session.currency || 'usd').toUpperCase(),
        providerRef: session.id,
        eventId: event.id
      };
    }

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      return {
        kind: 'payout_account_updated',
        accountId: account.id,
        payoutsEnabled: !!account.payouts_enabled,
        eventId: event.id
      };
    }

    return { kind: 'ignored', eventId: event.id };
  }

  async ensurePayoutAccount(params: {
    uid: string;
    email: string | null;
    existingAccountId?: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ accountId: string; status: ConnectedAccountStatus }> {
    const stripe = this.getClient();

    let accountId = params.existingAccountId;
    if (!accountId) {
      // Express account: يتولى Stripe كل واجهة جمع بيانات الهوية والحساب
      // البنكي (Onboarding) — لا نبني أو نخزّن أي بيانات مصرفية حساسة
      // بأنفسنا إطلاقاً.
      const account = await stripe.accounts.create({
        type: 'express',
        email: params.email || undefined,
        metadata: { uid: params.uid },
        capabilities: { transfers: { requested: true } }
      });
      accountId = account.id;
    }

    const account = await stripe.accounts.retrieve(accountId);
    let onboardingUrl: string | undefined;
    if (!account.payouts_enabled || !account.details_submitted) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
        type: 'account_onboarding'
      });
      onboardingUrl = link.url;
    }

    return {
      accountId,
      status: {
        connected: true,
        payoutsEnabled: !!account.payouts_enabled,
        onboardingUrl
      }
    };
  }

  async getPayoutAccountStatus(accountId: string): Promise<ConnectedAccountStatus> {
    const stripe = this.getClient();
    const account = await stripe.accounts.retrieve(accountId);
    return { connected: true, payoutsEnabled: !!account.payouts_enabled };
  }

  async createPayout(params: { accountId: string; amount: number; currency: string; uid: string }): Promise<PayoutResult> {
    const stripe = this.getClient();
    try {
      // تحويل من رصيد المنصة إلى حساب المستخدم المرتبط — بعدها يتولى
      // Stripe نفسه إرسال المبلغ إلى حسابه البنكي وفق جدول السحب الخاص
      // بحسابه (يومي/أسبوعي حسب إعداداته).
      const transfer = await stripe.transfers.create({
        amount: Math.round(params.amount * 100),
        currency: params.currency,
        destination: params.accountId,
        metadata: { uid: params.uid }
      });
      return { ok: true, providerRef: transfer.id };
    } catch (err: any) {
      return { ok: false, reason: err?.message || 'فشل تحويل مستحقات السحب.' };
    }
  }
}

const stripeProvider = new StripeProvider();

/** المزوّد النشط حالياً. لإضافة مزوّد آخر: نفّذ PaymentProvider في كلاس
 *  جديد بنفس هذا الملف، ثم بدّل هذا السطر (أو اختر حسب متغير بيئة
 *  PAYMENT_PROVIDER إن أردت دعم أكثر من مزوّد في آن واحد لاحقاً). */
export const activeProvider: PaymentProvider = stripeProvider;
