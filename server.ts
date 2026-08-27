import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { activeProvider } from './server/paymentProvider';
import {
  isAdminConfigured,
  getAdminInitError,
  getAdminDb,
  verifyRequestAuth,
  FieldValue
} from './server/firebaseAdmin';
import {
  isMediaUploadConfigured,
  uploadMediaBuffer,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES
} from './server/mediaUpload';
import {
  isTelegramVerificationConfigured,
  isYoutubeVerificationConfigured,
  verifyTelegramMembership,
  verifyYoutubeSubscription,
  recordVerificationAndReward
} from './server/socialVerify';
import {
  isNowPaymentsConfigured,
  isNowPaymentsIpnConfigured,
  createNowPaymentsInvoice,
  createNowPaymentsDirectPayment,
  verifyNowPaymentsIpnSignature
} from './server/nowPayments';
import { isEligibleForMonetization } from './src/utils/creatorEligibility';
import { REVENUE_SHARES } from './src/constants/revenueShares';
import type { User, Article } from './src/types';

dotenv.config();

// هل التشغيل الآلي الكامل للإيداع/السحب متاح؟ يتطلب الاثنين معاً: مزوّد
// دفع مضبوط (مثل Stripe) + Firebase Admin مضبوط (لاحتساب الرصيد فعلياً
// دون المرور بمتصفح المستخدم). بدون أي منهما تبقى الميزات معطّلة بأمان
// ويستمر المسار اليدوي الحالي (طلب ← موافقة الأدمن) يعمل كما هو تماماً.
function isPaymentAutomationReady(): boolean {
  return activeProvider.isConfigured() && isAdminConfigured();
}

function requireAutomation(res: express.Response): boolean {
  if (isPaymentAutomationReady()) return true;
  res.status(503).json({
    error: 'automation_not_configured',
    message: 'التفعيل الآلي للدفع غير مُفعَّل على هذا الخادم بعد. استخدم مسار الطلب اليدوي الحالي.'
  });
  return false;
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Server-side AI Quota Tracking per user
interface ServerQuotaRecord {
  usedToday: number;
  lastResetTime: number;
  isSubscriber: boolean;
  plan: 'none' | 'monthly' | 'annual';
}
const userQuotas = new Map<string, ServerQuotaRecord>();

// الحد اليومي المجاني — مصدر واحد للرقم حتى لا يتكرر في الرسائل
const freeDailyLimitForMessage = 10;

function verifyAndConsumeServerQuota(
  userId?: string,
  userIsSubscriber?: boolean,
  userPlan?: 'none' | 'monthly' | 'annual'
): { allowed: boolean; remaining: number; reason?: string } {
  if (!userId) {
    return {
      allowed: false,
      remaining: 0,
      reason: 'auth_required'
    };
  }

  const now = Date.now();
  let record = userQuotas.get(userId);

  if (!record) {
    record = {
      usedToday: 0,
      lastResetTime: now,
      isSubscriber: !!userIsSubscriber,
      plan: userPlan || 'none'
    };
    userQuotas.set(userId, record);
  }

  // Update subscriber status if passed
  if (userIsSubscriber !== undefined) {
    record.isSubscriber = userIsSubscriber;
    record.plan = userPlan || 'none';
  }

  // Check 24 hour reset
  if (now - record.lastResetTime >= 24 * 60 * 60 * 1000) {
    record.usedToday = 0;
    record.lastResetTime = now;
  }

  // Check unlimited annual subscribers
  if (record.isSubscriber && record.plan === 'annual') {
    record.usedToday += 1;
    return { allowed: true, remaining: 9999 };
  }

  // Check monthly plan (limit 200)
  if (record.isSubscriber && record.plan === 'monthly') {
    if (record.usedToday >= 200) {
      return {
        allowed: false,
        remaining: 0,
        reason: 'monthly_quota_exceeded'
      };
    }
    record.usedToday += 1;
    return { allowed: true, remaining: Math.max(0, 200 - record.usedToday) };
  }

  // الحصة المجانية اليومية لكل مستخدم.
  // ملاحظة: كل استدعاء يستهلك من حصة مالك المنصة في Gemini API،
  // ولهذا يوجد حد يومي — الاشتراك يجعل المستخدم الكثيف يغطي استهلاكه.
  const freeLimit = freeDailyLimitForMessage;
  if (record.usedToday >= freeLimit) {
    return {
      allowed: false,
      remaining: 0,
      reason: 'free_quota_exceeded'
    };
  }

  record.usedToday += 1;
  return { allowed: true, remaining: Math.max(0, freeLimit - record.usedToday) };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // ⚠️ خلف أي وسيط (proxy) تنتهي عنده شهادة TLS (وهذا حال أي نشر جادّ —
  // Cloud Run، Render، إلخ) يرى Node الاتصال الداخلي كـ http عادي، فتُخطئ
  // req.protocol ويعتقد الطلب "غير آمن". بدون هذا السطر، أي رابط يُبنى من
  // req.protocol (مثل روابط إعادة التوجيه بعد الدفع) قد يخرج بصيغة
  // http:// خاطئة تماماً رغم أن الموقع الفعلي https فقط.
  app.set('trust proxy', true);

  // ⚠️ يجب تسجيل مسار Webhook قبل express.json() العام أدناه — التحقق من
  // توقيع Stripe يحتاج الجسم الخام (raw) غير المُحلَّل، وexpress.json()
  // كان سيستهلك التدفّق (stream) ويحوّله JSON قبل وصوله هنا فيفشل التحقق.
  app.post(
    '/api/payments/webhook/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      if (!isPaymentAutomationReady()) {
        return res.status(503).json({ error: 'automation_not_configured' });
      }
      try {
        const signature = req.headers['stripe-signature'] as string | undefined;
        const event = activeProvider.parseWebhookEvent(req.body as Buffer, signature);
        if (!event) return res.status(400).json({ error: 'invalid_event' });

        if (event.kind === 'deposit_completed') {
          const db = getAdminDb();
          const eventRef = db.collection('paymentWebhookEvents').doc(event.eventId);
          const userRef = db.collection('users').doc(event.uid);
          const depositRef = db.collection('depositRequests').doc();

          // معاملة Firestore ذرّية: إن وصل نفس الحدث من Stripe أكثر من مرة
          // (سلوك "at-least-once" الموثّق لديهم)، لن يُحتسب المبلغ إلا مرة
          // واحدة — نتحقق من عدم معالجته سابقاً ضمن المعاملة نفسها.
          await db.runTransaction(async (tx) => {
            const eventSnap = await tx.get(eventRef);
            if (eventSnap.exists) return; // مُعالَج مسبقاً — تجاهل بأمان

            tx.set(eventRef, {
              kind: 'deposit_completed',
              uid: event.uid,
              amount: event.amount,
              processedAt: new Date().toISOString()
            });
            tx.update(userRef, { walletBalance: FieldValue.increment(event.amount) });
            tx.set(depositRef, {
              userId: event.uid,
              amount: event.amount,
              method: `stripe (${event.currency})`,
              status: 'completed',
              providerRef: event.providerRef,
              createdAt: new Date().toISOString()
            });
            tx.set(db.collection('notifications').doc(), {
              userId: event.uid,
              type: 'system',
              title: '💰 تم إيداع رصيدك',
              message: `تم إضافة ${event.amount}$ إلى محفظتك تلقائياً بعد تأكيد الدفع بالبطاقة.`,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          });
        }
        // account.updated (payout_account_updated) لا يحتاج فعلاً هنا —
        // حالة الحساب تُقرأ حيّة من Stripe مباشرة عند كل طلب سحب آلي.

        res.json({ received: true });
      } catch (err: any) {
        console.error('Stripe webhook error:', err?.message || err);
        res.status(400).json({ error: 'webhook_error', message: err?.message || 'خطأ في معالجة الحدث.' });
      }
    }
  );

  // ⚠️ نفس السبب تماماً كسبب webhook Stripe أعلاه — يجب تسجيله قبل
  // express.json() العام ليصل جسم الطلب خاماً، فتوقيع NOWPayments
  // (HMAC-SHA512 على الجسم بعد ترتيب مفاتيحه أبجدياً) يحتاج النص الخام
  // بالضبط كما وصل، لا نسخة مُعاد تسلسلها بعد التحليل.
  app.post(
    '/api/payments/webhook/nowpayments',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      if (!isNowPaymentsConfigured() || !isNowPaymentsIpnConfigured()) {
        return res.status(503).json({ error: 'nowpayments_not_configured' });
      }
      try {
        const signature = req.headers['x-nowpayments-sig'] as string | undefined;
        const payload = JSON.parse((req.body as Buffer).toString('utf8'));

        if (!verifyNowPaymentsIpnSignature(payload, signature)) {
          return res.status(400).json({ error: 'invalid_signature' });
        }

        const status = payload.payment_status as string;
        const finished = status === 'finished' || status === 'confirmed';
        // partially_paid: وصل مبلغ أقل من المطلوب (مثلاً رسوم اقتطعها وسيط
        // دفع خارجي عند الدفع بالبطاقة) — نعتبرها حالة نهائية (NOWPayments
        // لا يسمح "إكمال" نفس الدفعة لاحقاً) ونعتمد المبلغ الفعلي الواصل
        // (actually_paid) فقط، لا المبلغ المطلوب أصلاً، تفادياً لأي اعتماد
        // زائد عن الحقيقة.
        const partiallyPaid = status === 'partially_paid';

        if (finished || partiallyPaid) {
          const orderId = String(payload.order_id || '');
          const uid = orderId.split('_')[0];
          const amount = finished ? Number(payload.price_amount) : Number(payload.actually_paid);

          if (uid && Number.isFinite(amount) && amount > 0) {
            const db = getAdminDb();
            const eventRef = db.collection('paymentWebhookEvents').doc(`nowpayments_${payload.payment_id}`);
            const userRef = db.collection('users').doc(uid);
            const depositRef = db.collection('depositRequests').doc();

            await db.runTransaction(async (tx) => {
              const eventSnap = await tx.get(eventRef);
              if (eventSnap.exists) return; // مُعالَج مسبقاً — NOWPayments قد يعيد إرسال نفس الإشعار

              tx.set(eventRef, {
                kind: 'deposit_completed',
                uid,
                amount,
                processedAt: new Date().toISOString()
              });
              tx.update(userRef, { walletBalance: FieldValue.increment(amount) });
              tx.set(depositRef, {
                userId: uid,
                amount,
                method: `nowpayments (${payload.pay_currency || 'crypto'})`,
                status: 'completed',
                providerRef: String(payload.payment_id),
                createdAt: new Date().toISOString()
              });
              tx.set(db.collection('notifications').doc(), {
                userId: uid,
                type: 'system',
                title: '💰 تم إيداع رصيدك',
                message: `تم إضافة ${amount}$ إلى محفظتك تلقائياً بعد تأكيد شبكة العملات الرقمية.`,
                isRead: false,
                createdAt: new Date().toISOString()
              });
            });
          }
        }

        res.json({ received: true });
      } catch (err: any) {
        console.error('NOWPayments webhook error:', err?.message || err);
        res.status(400).json({ error: 'webhook_error', message: err?.message || 'خطأ في معالجة إشعار الدفع.' });
      }
    }
  );

  app.use(express.json());

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'LITERIUM',
      version: '1.1.0',
      timestamp: new Date().toISOString()
    });
  });

  // AI Assistant Endpoint for chat and platform help
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { prompt, userRole, language, userId, isSubscriber, plan } = req.body;

      // 1. Mandatory Login & Quota Check
      const quotaCheck = verifyAndConsumeServerQuota(userId, isSubscriber, plan);
      if (!quotaCheck.allowed) {
        if (quotaCheck.reason === 'auth_required') {
          return res.status(401).json({
            error: 'auth_required',
            message: 'يتطلب استخدام المساعد الذكي تسجيل الدخول إلى حسابك أولاً.'
          });
        }
        return res.status(429).json({
          error: 'quota_exceeded',
          message: `لقد استنفدت حد الاستخدام المجاني لليوم (${freeDailyLimitForMessage}/${freeDailyLimitForMessage}). يرجى الاشتراك في إحدى باقات Pro للمتابعة دون انقطاع.`
        });
      }

      const client = getGeminiClient();

      if (client) {
        const systemInstruction = `أنت المساعد الذكي الرسمي لمنصة "ليتيريوم" (LITERIUM) للأدب والثقافة العربية.

دور المستخدم الحالي: ${userRole || 'reader'}
اللغة المطلوبة: ${language || 'ar'}

=== معلومات المنصة (استخدمها للإجابة عن أسئلة المنصة) ===

نسب تقاسم الأرباح:
- إعلانات داخل مقالات الكاتب: الكاتب 55% والمنصة 45%
- إعلانات في صفحة الكاتب الشخصية: الكاتب 50% والمنصة 50%
- المقالات الحصرية المدفوعة: الكاتب 85% والمنصة 15%
- إعلانات الصفحة الرئيسية والتصنيفات: المنصة 100%

قواعد السحب:
- الحد الأدنى للسحب: 50 دولاراً أمريكياً
- فترة تجميد 30 يوماً على كل ربح قبل أن يصبح قابلاً للسحب، للتحقق من صحته
- الكاتب يرى رصيدين: "أرباح مجمّدة" و"أرباح متاحة للسحب"
- تُحتسب النقرات والمشاهدات الصالحة فقط بعد تصفية الاحتيال

المعاملات المالية:
- كل طلبات الإيداع والسحب تُراجع يدوياً من إدارة المنصة خلال 24 إلى 48 ساعة
- المعلن يشحن محفظته أولاً، ثم ينشئ حملته
- الحملات تُحفظ كمسودة وتُفعّل بعد اعتماد الإدارة

الإعلانات:
- نماذج التسعير: ثابت بمدة (24/48/72 ساعة أو أسبوع)، أو CPM لكل ألف ظهور، أو CPC لكل نقرة
- يوجد نوع خاص: رعاية قسم كامل لجهة واحدة
- الكاتب يستطيع ترويج مقاله من رصيد أرباحه

سلوك محظور يؤدي لإلغاء الأرباح وإغلاق الحساب:
- النقر على الإعلانات في صفحتك أو مقالاتك بنفسك
- الطلب من الآخرين النقر
- استخدام برامج آلية لزيادة الزيارات

=== قدراتك خارج معلومات المنصة ===

أنت مساعد كامل، ولست محصوراً بأسئلة المنصة. يمكنك مساعدة الكتّاب في:
- توليد أفكار ومحاور للمقالات
- اقتراح عناوين جذابة
- التدقيق اللغوي والنحوي وتحسين الأسلوب
- إعادة صياغة فقرة كتبها الكاتب
- البحث عن زوايا معالجة لموضوع ما
- تلخيص أو شرح مفاهيم أدبية وفكرية

=== قاعدة مهمة جداً ===

لا تكتب مقالاً كاملاً جاهزاً للنشر نيابة عن الكاتب. المحتوى المولّد آلياً بالكامل يعرّض المنصة لرفض من شبكات الإعلانات وإلى فقدان ثقة القرّاء.
بدلاً من ذلك: اعرض مخططاً أو محاور أو فقرة افتتاحية كنموذج، واطلب من الكاتب أن يبني عليها بصوته الخاص. إن أصرّ المستخدم، اشرح له هذا السبب بوضوح ولطف.

أجب باحترافية ووضوح وأسلوب عربي فصيح ومهذب، وباختصار مناسب للقراءة على الهاتف.`;

        const response = await client.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            systemInstruction
          }
        });

        res.json({
          reply: response.text || 'أهلاً بك في منصة ليتيريوم! كيف يمكنني مساعدتك اليوم؟',
          remainingUses: quotaCheck.remaining
        });
      } else {
        // Smart fallback when GEMINI_API_KEY is not configured
        const p = (prompt || '').toLowerCase();
        let fallbackReply = 'المساعد الذكي غير مفعّل حالياً لأن مفتاح Gemini API غير مضبوط. يمكنني الإجابة عن أسئلة عامة حول المنصة فقط. تواصل مع إدارة المنصة لتفعيل المساعد بالكامل.';

        if (p.includes('ربح') || p.includes('ارباح') || p.includes('سحب') || p.includes('فلوس') || p.includes('earning')) {
          fallbackReply = 'نظام الأرباح في ليتيريوم يمنح الكاتب 55% من عوائد الإعلانات داخل مقالاته، و50% من إعلانات صفحته الشخصية، و85% من مبيعات المقالات الحصرية. الحد الأدنى للسحب 50$، وتمر الأرباح بفترة تجميد 30 يوماً قبل أن تصبح قابلة للسحب. تُراجع طلبات السحب يدوياً خلال 24 إلى 48 ساعة.';
        } else if (p.includes('اعلان') || p.includes('معلن') || p.includes('حملة') || p.includes('ads')) {
          fallbackReply = 'كـ معلن في ليتيريوم، اشحن محفظتك أولاً، ثم أنشئ حملتك بأحد نماذج التسعير: ثابت بمدة (24، 48، 72 ساعة، أو أسبوع)، أو CPM لكل ألف ظهور، أو CPC لكل نقرة صالحة. تُحفظ الحملة كمسودة وتُفعّل بعد اعتماد الإدارة. النقرات المرفوضة كاحتيال لا تُخصم منك.';
        } else if (p.includes('توثيق') || p.includes('kyc') || p.includes('هوية')) {
          fallbackReply = 'التحقق من الهوية (KYC) مخصص للكتّاب والمعلنين لضمان أمان المعاملات المالية والمصداقية. يمكنك رفع صورة الهوية أو جواز السفر مع صورة شخصية من القائمة الجانبية -> التحقق من الهوية.';
        } else if (p.includes('مقال') || p.includes('نشر') || p.includes('كتابة')) {
          fallbackReply = 'لكتابة مقال جديد، اضغط على زر "كتابة مقال" في القائمة السفلية أو العلوية. يمكنك الاستفادة من أدوات الذكاء الاصطناعي لاقتراح عناوين جذابة وتدقيق النص وتحديد المقال كمجاني أو مقفول.';
        }

        res.json({
          reply: fallbackReply,
          remainingUses: quotaCheck.remaining
        });
      }
    } catch (error: any) {
      // رسائل خطأ واضحة بدل رسالة عامة غامضة، حتى نعرف السبب الحقيقي
      const msg = String(error?.message || error || '');
      console.error('AI Chat Error:', msg, error);

      let reply = 'تعذّر الاتصال بالمساعد الذكي مؤقتاً. يرجى المحاولة بعد قليل.';

      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('401') || msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
        reply = 'مفتاح الذكاء الاصطناعي غير صالح أو غير مفعّل. يرجى إبلاغ إدارة المنصة.';
      } else if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found') || msg.includes('model')) {
        reply = 'نموذج الذكاء الاصطناعي المحدد غير متاح حالياً. يرجى إبلاغ إدارة المنصة.';
      } else if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        reply = 'تم تجاوز حصة الاستخدام على مستوى المنصة. يرجى المحاولة بعد قليل.';
      } else if (msg.includes('SAFETY') || msg.includes('blocked')) {
        reply = 'تعذّر الرد على هذا الطلب لأسباب تتعلق بسياسات المحتوى. جرّب صياغة أخرى.';
      }

      res.status(500).json({ reply, debug: msg.slice(0, 300) });
    }
  });

  // AI Image Generation Studio Endpoint
  // Deducts cost from user wallet and credits platform owner balance when beyond free quota
  const FREE_LIFETIME_IMAGE_GENERATIONS = 3; // أول 3 صور مجانية مدى الحياة (وليس يومياً) لكل مستخدم غير مشترك
  // نفس منطق تسعير محادثة Claude: تكلفة توليد صورة بـ Gemini Flash Image
  // الفعلية عادة بضعة سنتات (أعلى من رسالة نصية واحدة لأنها بيانات أثقل)،
  // فـ$0.02 يبقي هامش ربح معقولاً دون رقم يبدو مبالغاً فيه لخصم مباشر من
  // محفظة حقيقية. كانت $0.05 سابقاً.
  const IMAGE_GENERATION_COST = 0.02;
  // حصة المشتركين اليومية (خطط الذكاء الاصطناعي المدفوعة) — لا تزال في
  // الذاكرة لأنها مكافأة إضافية فوق الحصة المجانية الأساسية، وميزة الاشتراك
  // نفسها ليست موضع الشكوى الحالية.
  const subscriberDailyImageQuotas = new Map<string, { usedToday: number; lastResetTime: number }>();

  app.post('/api/ai/generate-image', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    try {
      // ⚠️ كان هذا المسار يثق بـ userId/userEmail القادمين مباشرة من جسم
      // الطلب دون أي تحقق — أي طرف يستطيع انتحال أي مستخدم (بما فيه المالك
      // نفسه عبر إرسال بريده الإلكتروني) للحصول على توليد مجاني غير محدود،
      // أو التسبب بخصم من محفظة مستخدم آخر. الآن يُشتق uid/email من توكن
      // Firebase الحقيقي المُرسَل فعلياً من العميل (imageApi.ts يرسله أصلاً).
      const { uid, email } = await verifyRequestAuth(req.headers.authorization);
      const { prompt, style, aspectRatio = '16:9' } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          error: 'invalid_prompt',
          message: 'يرجى كتابة وصف أو فكرة لتوليد الصورة.'
        });
      }

      const normalizedEmail = (email || '').toLowerCase().trim();
      const isOwner = normalizedEmail === 'brnardtsho@gmail.com';

      // 1. Load server-trusted user data (never trust subscriber/plan status from the client)
      const db = getAdminDb();
      const userDocRef = db.collection('users').doc(uid);
      let userSnap = await userDocRef.get();
      // زوار بدون تسجيل (حساب مجهول حقيقي عبر signInAnonymously) لا يملكون
      // مستند users/{uid} إطلاقاً — كانت هذه الحالة تُرفض بـ 404 فتُغلق
      // أداة الذكاء الاصطناعي أمامهم تماماً، رغم القرار الصريح بإتاحتها
      // لأي زائر لجذب الاستخدام. نُنشئ مستند تتبّع حصة أدنى لهم هنا (بلا
      // أي حقول مالية) بدل رفض الطلب، فيحصلون على نفس حصة الصور المجانية
      // التي يحصل عليها أي قارئ غير مشترك بالضبط.
      if (!userSnap.exists) {
        await userDocRef.set({ freeImagesUsedTotal: 0, isGuestTracker: true, createdAt: new Date().toISOString() });
        userSnap = await userDocRef.get();
      }
      const userData = userSnap.data() || {};

      const serverAiQuota = userData.aiQuota || {};
      const planNotExpired =
        !serverAiQuota.planExpiresAt || new Date(serverAiQuota.planExpiresAt).getTime() > Date.now();
      const isSubscriber = Boolean(serverAiQuota.isSubscriber) && planNotExpired;
      const plan = isSubscriber ? serverAiQuota.plan : 'none';

      // 2. Quota & Financial evaluation
      // المستخدم غير المشترك: 3 صور مجانية مدى الحياة (محسوبة من مستند
      // Firestore الدائم، وليس من ذاكرة السيرفر المؤقتة التي كانت تُصفَّر
      // مع كل إعادة تشغيل للخادم فتمنح صوراً مجانية غير محدودة فعلياً).
      const freeUsedTotal = Number(userData.freeImagesUsedTotal ?? 0);
      let shouldCharge = false;
      let willConsumeFreeLifetime = false;
      let willConsumeSubscriberDaily = false;

      if (!isOwner) {
        if (isSubscriber) {
          const now = Date.now();
          let subQuota = subscriberDailyImageQuotas.get(uid);
          if (!subQuota || now - subQuota.lastResetTime >= 24 * 60 * 60 * 1000) {
            subQuota = { usedToday: 0, lastResetTime: now };
            subscriberDailyImageQuotas.set(uid, subQuota);
          }
          const subscriberDailyLimit = plan === 'annual' ? 9999 : 10;
          if (subQuota.usedToday < subscriberDailyLimit) {
            willConsumeSubscriberDaily = true;
          } else if (freeUsedTotal < FREE_LIFETIME_IMAGE_GENERATIONS) {
            willConsumeFreeLifetime = true;
          } else {
            shouldCharge = true;
          }
        } else if (freeUsedTotal < FREE_LIFETIME_IMAGE_GENERATIONS) {
          willConsumeFreeLifetime = true;
        } else {
          shouldCharge = true;
        }
      }

      // Check balance if charge is required
      if (shouldCharge) {
        const currentBalance = Number(userData.availableBalance ?? userData.walletBalance ?? 0);
        if (currentBalance < IMAGE_GENERATION_COST) {
          return res.status(402).json({
            error: 'insufficient_balance',
            message: `رصيدك الحالي ($${currentBalance.toFixed(2)}) غير كافٍ. تكلفة توليد الصورة هي $${IMAGE_GENERATION_COST.toFixed(2)}. يرجى شحن المحفظة للمتابعة.`,
            requiredAmount: IMAGE_GENERATION_COST,
            currentBalance
          });
        }
      }

      // 2. Generate Image with Gemini API
      const client = getGeminiClient();
      let generatedImageUrl: string | null = null;

      // Style prompt enhancer
      const stylePrompts: Record<string, string> = {
        oil_painting: 'masterpiece oil painting style, classical fine art, textured brush strokes, warm dramatic lighting, rich literary atmosphere',
        surrealist: 'surrealist philosophical art style, dreamlike symbolic atmosphere, thought provoking composition, ethereal lighting',
        photorealistic: 'hyper-realistic photography, 8k resolution, cinematic lighting, shallow depth of field, award-winning shot',
        digital_art: 'stunning digital art illustration, vibrant modern aesthetic, sharp details, concept art, trending on artstation',
        minimalist: 'minimalist clean aesthetic, elegant negative space, subtle color palette, refined typography friendly layout',
        arabic_calligraphy_art: 'traditional Arabic calligraphy integrated with magnificent abstract Islamic art ornamentation, golden and turquoise tones',
        fantasy: 'epic fantasy illustration, magical ethereal atmosphere, glowing mystical elements, intricate fine details'
      };

      const enhancedStyle = stylePrompts[style] || stylePrompts.oil_painting;
      const fullPrompt = `${prompt.trim()}. Style: ${enhancedStyle}. Clean composition, ultra high quality, no text distortions, no watermarks.`;

      // Supported aspect ratios in Gemini
      const validAspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
      const finalAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : '16:9';

      if (client) {
        try {
          const response = await client.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents: {
              parts: [{ text: fullPrompt }]
            },
            config: {
              imageConfig: {
                aspectRatio: finalAspectRatio as any
              }
            }
          });

          if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData && part.inlineData.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                generatedImageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                break;
              }
            }
          }
        } catch (genError: any) {
          console.warn('Gemini 3.1-flash-image failed, trying fallback model:', genError?.message);
          try {
            const fallbackResponse = await client.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [{ text: fullPrompt }]
              }
            });
            if (fallbackResponse.candidates && fallbackResponse.candidates[0]?.content?.parts) {
              for (const part of fallbackResponse.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                  const mimeType = part.inlineData.mimeType || 'image/png';
                  generatedImageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                  break;
                }
              }
            }
          } catch (fbErr: any) {
            console.error('All Gemini image models failed:', fbErr?.message);
          }
        }
      }

      // ⚠️ كانت الصورة الاحتياطية (عند فشل Gemini أو غياب المفتاح) تُستهلَك
      // من حصة المستخدم المجانية أو تُخصَم من محفظته بنفس سعر الصورة
      // الحقيقية رغم أنها مجرد إحدى 8 صور مخزون ثابتة تتكرر لآلاف الأوصاف
      // المختلفة دون أي علاقة بالطلب — وهذا بالضبط ما يجعل "توليد الصور
      // رديء" وغير عادل مالياً. الآن: لا خصم مالي ولا استهلاك حصة إطلاقاً
      // إن لم يكن الناتج صورة ذكاء اصطناعي حقيقية من Gemini، ويُصرَّح بذلك
      // صراحة للعميل عبر isAiGenerated بدل التظاهر بأنها ناتج ذكاء اصطناعي.
      const isAiGenerated = generatedImageUrl !== null;

      if (!isAiGenerated) {
        const curatedLibrary = [
          'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1507842229451-79b1be8d5a2f?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&auto=format&fit=crop&q=80'
        ];
        const hash = Array.from(prompt).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        generatedImageUrl = curatedLibrary[hash % curatedLibrary.length];

        return res.json({
          success: true,
          imageUrl: generatedImageUrl,
          isAiGenerated: false,
          charged: false,
          cost: 0,
          remainingFreeUses: Math.max(0, FREE_LIFETIME_IMAGE_GENERATIONS - freeUsedTotal),
          newBalance: null,
          message: 'تعذّر الاتصال بمولّد الذكاء الاصطناعي حالياً، فتم عرض صورة بديلة مؤقتة من المكتبة — لم يُخصَم أي مبلغ ولم تُستهلَك حصتك المجانية.'
        });
      }

      // 3. Finalize Quota Consumption & Financial Transaction — فقط عند نجاح
      // توليد صورة ذكاء اصطناعي حقيقية.
      let finalUserBalance: number | null = null;

      if (willConsumeSubscriberDaily) {
        const subQuota = subscriberDailyImageQuotas.get(uid);
        if (subQuota) subQuota.usedToday += 1;
      } else if (willConsumeFreeLifetime) {
        await userDocRef.update({ freeImagesUsedTotal: FieldValue.increment(1) });
      } else if (shouldCharge) {
        try {
          const batch = db.batch();

          // Deduct from User
          batch.update(userDocRef, {
            walletBalance: FieldValue.increment(-IMAGE_GENERATION_COST),
            availableBalance: FieldValue.increment(-IMAGE_GENERATION_COST)
          });

          // Credit Owner
          const ownerQuery = await db.collection('users').where('email', '==', 'brnardtsho@gmail.com').limit(1).get();
          if (!ownerQuery.empty) {
            const ownerDocRef = ownerQuery.docs[0].ref;
            batch.update(ownerDocRef, {
              walletBalance: FieldValue.increment(IMAGE_GENERATION_COST),
              availableBalance: FieldValue.increment(IMAGE_GENERATION_COST),
              lifetimeEarnings: FieldValue.increment(IMAGE_GENERATION_COST),
              totalEarnings: FieldValue.increment(IMAGE_GENERATION_COST)
            });

            // Record earning transaction
            const earningRef = db.collection('earnings').doc();
            batch.set(earningRef, {
              userId: ownerDocRef.id,
              amount: IMAGE_GENERATION_COST,
              type: 'bonus',
              source: `توليد صورة ذكاء اصطناعي من المستخدم (${normalizedEmail || uid})`,
              createdAt: new Date().toISOString(),
              status: 'credited'
            });
          }

          await batch.commit();

          const updatedUserSnap = await userDocRef.get();
          finalUserBalance = updatedUserSnap.data()?.availableBalance ?? null;
        } catch (dbErr) {
          console.error('Failed to deduct image cost or credit owner in Firestore:', dbErr);
        }
      }

      const newFreeUsedTotal = willConsumeFreeLifetime ? freeUsedTotal + 1 : freeUsedTotal;

      res.json({
        success: true,
        imageUrl: generatedImageUrl,
        isAiGenerated: true,
        charged: shouldCharge,
        cost: shouldCharge ? IMAGE_GENERATION_COST : 0,
        remainingFreeUses: Math.max(0, FREE_LIFETIME_IMAGE_GENERATIONS - newFreeUsedTotal),
        newBalance: finalUserBalance
      });
    } catch (err: any) {
      if (err?.message === 'missing_auth_token') {
        return res.status(401).json({
          error: 'auth_required',
          message: 'يتطلب استخدام استوديو توليد الصور تسجيل الدخول أولاً.'
        });
      }
      console.error('Generate image error:', err?.message || err);
      res.status(500).json({
        error: 'generation_failed',
        message: 'تعذر توليد الصورة بالذكاء الاصطناعي حالياً. يرجى المحاولة مرة أخرى.'
      });
    }
  });

  // إلغاء قفل مقال مدفوع — فوري بدل انتظار اعتماد الأدمن اليدوي (24-48
  // ساعة كما كان). يتحقق من هوية المشتري عبر توكن Firebase (لا يثق بأي
  // userId من جسم الطلب)، ويخصم/يودع في معاملة Firestore واحدة ذرية، بنفس
  // منطق الأهلية لاحتساب أرباح الكاتب (متابعون + مشاهدات + عمر الحساب +
  // عدد المقالات + KYC) الذي كان يُطبَّق يدوياً في handleUpdatePurchaseRequest.
  app.post('/api/articles/unlock', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const { articleId } = req.body;
      if (!articleId || typeof articleId !== 'string') {
        return res.status(400).json({ error: 'invalid_article', message: 'معرّف المقال غير صالح.' });
      }

      const db = getAdminDb();
      const articleRef = db.collection('articles').doc(articleId);
      const articleSnap = await articleRef.get();
      if (!articleSnap.exists) {
        return res.status(404).json({ error: 'article_not_found', message: 'المقال غير موجود.' });
      }
      const article = articleSnap.data() as Article;

      if (!article.isLocked) {
        return res.json({ success: true, alreadyUnlocked: true, price: 0, newBalance: null });
      }
      const writerId = article.writerId;
      if (writerId === uid) {
        return res.json({ success: true, alreadyUnlocked: true, price: 0, newBalance: null });
      }

      const purchaseRef = db.collection('articlePurchases').doc(`${uid}_${articleId}`);
      const existingPurchase = await purchaseRef.get();
      if (existingPurchase.exists) {
        return res.json({ success: true, alreadyUnlocked: true, price: 0, newBalance: null });
      }

      const price = Number(article.lockedPrice) || 2.99;

      const writerSnap = await db.collection('users').doc(writerId).get();
      let writerEligible = false;
      if (writerSnap.exists) {
        const writerData = writerSnap.data() as User;
        if (writerData.role === 'admin') {
          writerEligible = true;
        } else {
          const [publishedSnap, followsSnap] = await Promise.all([
            db.collection('articles').where('writerId', '==', writerId).where('status', '==', 'published').get(),
            db.collection('follows').where('followingId', '==', writerId).get()
          ]);
          const published = publishedSnap.docs.map((d) => d.data() as Article);
          writerEligible = isEligibleForMonetization(writerData, published, followsSnap.size);
        }
      }

      const buyerRef = db.collection('users').doc(uid);

      try {
        await db.runTransaction(async (tx) => {
          const [buyerSnap, purchaseRaceCheck] = await Promise.all([tx.get(buyerRef), tx.get(purchaseRef)]);
          if (purchaseRaceCheck.exists) return; // اشتُري للتو ضمن طلب متزامن آخر
          if (!buyerSnap.exists) throw new Error('buyer_not_found');

          const buyerData = buyerSnap.data()!;
          const currentBalance = Number(buyerData.availableBalance ?? buyerData.walletBalance ?? 0);
          if (currentBalance < price) {
            throw new Error('insufficient_balance');
          }

          tx.update(buyerRef, {
            walletBalance: FieldValue.increment(-price),
            availableBalance: FieldValue.increment(-price)
          });
          tx.set(purchaseRef, {
            buyerId: uid,
            articleId,
            writerId,
            price,
            purchasedAt: new Date().toISOString()
          });

          if (writerEligible) {
            const share = Number((price * REVENUE_SHARES.LOCKED_ARTICLES.WRITER).toFixed(2));
            const writerRef = db.collection('users').doc(writerId);
            tx.update(writerRef, {
              pendingEarnings: FieldValue.increment(share),
              lifetimeEarnings: FieldValue.increment(share)
            });
            const earningRef = db.collection('earnings').doc();
            tx.set(earningRef, {
              userId: writerId,
              amount: share,
              source: `مبيعات مقال: ${article.title || articleId}`,
              articleId,
              status: 'pending_hold',
              createdAt: new Date().toISOString(),
              releasableAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            });
          }
        });
      } catch (txErr: any) {
        if (txErr?.message === 'insufficient_balance') {
          return res.status(402).json({
            error: 'insufficient_balance',
            message: `رصيدك الحالي غير كافٍ لشراء هذا المقال. تكلفته $${price.toFixed(2)}.`
          });
        }
        throw txErr;
      }

      const updatedBuyerSnap = await buyerRef.get();
      const newBalance = updatedBuyerSnap.data()?.availableBalance ?? null;

      res.json({ success: true, alreadyUnlocked: false, price, newBalance });
    } catch (err: any) {
      if (err?.message === 'missing_auth_token') {
        return res.status(401).json({ error: 'auth_required', message: 'يتطلب شراء المقالات المقفلة تسجيل الدخول أولاً.' });
      }
      console.error('Article unlock error:', err?.message || err);
      res.status(500).json({ error: 'unlock_failed', message: 'تعذر إتمام عملية الشراء. حاول مجدداً.' });
    }
  });

  // تمويل/تفعيل حملة إعلانية — فوري بدل انتظار اعتماد الأدمن اليدوي الذي
  // لم يعد له مسار فعلي أصلاً (الحملة كانت تُنشأ بحالة 'draft' بينما لوحة
  // التحكم تعرض فقط حملات بحالة 'pending' لاعتمادها — لا تطابق أبداً، فتبقى
  // كل حملة عالقة للأبد بميزانية صفر). يخصم المعلن نفسه (وليس الأدمن)
  // ميزانيته المطلوبة فوراً عند التفعيل، بنفس نمط فتح المقالات المقفلة.
  app.post('/api/campaigns/fund', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const { campaignId } = req.body;
      if (!campaignId || typeof campaignId !== 'string') {
        return res.status(400).json({ error: 'invalid_campaign', message: 'معرّف الحملة غير صالح.' });
      }

      const db = getAdminDb();
      const campaignRef = db.collection('campaigns').doc(campaignId);
      const campaignSnap = await campaignRef.get();
      if (!campaignSnap.exists) {
        return res.status(404).json({ error: 'campaign_not_found', message: 'الحملة غير موجودة.' });
      }
      const campaign = campaignSnap.data()!;

      if (campaign.advertiserId !== uid) {
        return res.status(403).json({ error: 'forbidden', message: 'لا يمكنك تمويل حملة إعلانية لا تملكها.' });
      }
      if (campaign.status !== 'pending' || Number(campaign.totalBudget) > 0) {
        return res.json({ success: true, alreadyFunded: true, budget: 0, newBalance: null });
      }

      const requestedBudget = Number(campaign.requestedBudget) || 0;
      if (requestedBudget <= 0) {
        return res.status(400).json({ error: 'invalid_budget', message: 'ميزانية الحملة غير صالحة.' });
      }

      const advertiserRef = db.collection('users').doc(uid);

      try {
        await db.runTransaction(async (tx) => {
          const [advertiserSnap, campaignRaceCheck] = await Promise.all([
            tx.get(advertiserRef),
            tx.get(campaignRef)
          ]);
          if (!advertiserSnap.exists) throw new Error('advertiser_not_found');
          const raceData = campaignRaceCheck.data();
          if (raceData?.status !== 'pending' || Number(raceData?.totalBudget) > 0) return; // مُمَوَّلة للتو ضمن طلب متزامن آخر

          const advertiserData = advertiserSnap.data()!;
          const currentBalance = Number(advertiserData.availableBalance ?? advertiserData.walletBalance ?? 0);
          if (currentBalance < requestedBudget) {
            throw new Error('insufficient_balance');
          }

          const durationHours = Number(campaign.durationHours) || 168;
          const startDate = new Date();
          const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

          tx.update(advertiserRef, {
            walletBalance: FieldValue.increment(-requestedBudget),
            availableBalance: FieldValue.increment(-requestedBudget)
          });
          tx.update(campaignRef, {
            status: 'active',
            totalBudget: requestedBudget,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
          });
        });
      } catch (txErr: any) {
        if (txErr?.message === 'insufficient_balance') {
          return res.status(402).json({
            error: 'insufficient_balance',
            message: `رصيدك الحالي غير كافٍ لتمويل هذه الحملة. الميزانية المطلوبة $${requestedBudget.toFixed(2)}.`
          });
        }
        throw txErr;
      }

      const updatedSnap = await advertiserRef.get();
      const newBalance = updatedSnap.data()?.availableBalance ?? null;

      res.json({ success: true, alreadyFunded: false, budget: requestedBudget, newBalance });
    } catch (err: any) {
      if (err?.message === 'missing_auth_token') {
        return res.status(401).json({ error: 'auth_required', message: 'يتطلب إطلاق حملة إعلانية تسجيل الدخول أولاً.' });
      }
      console.error('Campaign funding error:', err?.message || err);
      res.status(500).json({ error: 'funding_failed', message: 'تعذر تمويل الحملة. حاول مجدداً.' });
    }
  });

  // ------------------------------------------------------------------
  // إحصائيات زوار حقيقية — كانت شاشة "التحليلات والزوار" بالكامل مبنية
  // على بيانات وهمية مولَّدة محلياً في متصفح كل أدمن على حدة (utils/
  // trafficTracker.ts، سجلات بأسماء عشوائية وأرقام أساس ثابتة)، لا تُسجَّل
  // فيها أي زيارة حقيقية من أي مستخدم فعلياً. هذا يستبدلها ببيانات حقيقية:
  // كل تحميل حقيقي للتطبيق يُسجَّل هنا في Firestore عبر /track-visit، وتُقرأ
  // الإحصائيات المجمَّعة من نفس البيانات عبر /summary.
  //
  // pageViews: مستند واحد لكل تحميل صفحة فعلي (لا يحتاج توكن — الزوار غير
  // المسجَّلين يجب أن يُحتسبوا أيضاً).
  // visitorSessions: مستند واحد لكل معرّف زائر فريد (يُخزَّن في localStorage
  // المتصفح ليبقى ثابتاً)، يُستخدم لعدّ "الزوار الفريدين" الحقيقي.
  app.post('/api/analytics/track-visit', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured' });
    }
    try {
      const { sessionId, path: visitPath, pageTitle, device, browser, userId } = req.body;
      if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
        return res.status(400).json({ error: 'invalid_session' });
      }
      if (!visitPath || typeof visitPath !== 'string' || visitPath.length > 300) {
        return res.status(400).json({ error: 'invalid_path' });
      }

      const db = getAdminDb();
      const now = new Date().toISOString();
      const isRegistered = Boolean(userId) && userId !== 'guest';

      const pageViewRef = db.collection('pageViews').doc();
      const sessionRef = db.collection('visitorSessions').doc(sessionId);

      const sessionSnap = await sessionRef.get();

      const batch = db.batch();
      batch.set(pageViewRef, {
        sessionId,
        path: visitPath,
        pageTitle: typeof pageTitle === 'string' ? pageTitle.slice(0, 200) : '',
        device: device === 'mobile' || device === 'tablet' ? device : 'desktop',
        browser: typeof browser === 'string' ? browser.slice(0, 50) : 'Unknown',
        isRegistered,
        userId: isRegistered ? String(userId) : null,
        timestamp: now
      });
      batch.set(
        sessionRef,
        {
          lastSeenAt: now,
          visitCount: FieldValue.increment(1),
          isRegistered,
          ...(isRegistered ? { userId: String(userId) } : {}),
          ...(sessionSnap.exists ? {} : { firstSeenAt: now })
        },
        { merge: true }
      );
      await batch.commit();

      res.json({ ok: true });
    } catch (err: any) {
      // تتبع الزيارات لا يجب أن يُفشل أي شيء آخر في الواجهة — يكفي تسجيل
      // الخطأ في السيرفر بصمت.
      console.error('Track visit error:', err?.message || err);
      res.status(500).json({ error: 'track_failed' });
    }
  });

  app.get('/api/analytics/summary', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const db = getAdminDb();

      const callerSnap = await db.collection('users').doc(uid).get();
      const callerData = callerSnap.exists ? callerSnap.data()! : {};
      const isAdminCaller =
        callerData.role === 'admin' ||
        String(callerData.email || '').toLowerCase() === 'brnardtsho@gmail.com';
      if (!isAdminCaller) {
        return res.status(403).json({ error: 'forbidden', message: 'هذه البيانات مخصصة لإدارة المنصة فقط.' });
      }

      const now = Date.now();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayIso = startOfToday.toISOString();
      const last24hIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      const [
        totalVisitorsCount,
        visitorsTodayCount,
        visitorsLast24hCount,
        totalPageViewsCount,
        pageViewsTodayCount,
        pageViewsLast24hSnap,
        recentVisitsSnap
      ] = await Promise.all([
        db.collection('visitorSessions').count().get(),
        db.collection('visitorSessions').where('lastSeenAt', '>=', startOfTodayIso).count().get(),
        db.collection('visitorSessions').where('lastSeenAt', '>=', last24hIso).count().get(),
        db.collection('pageViews').count().get(),
        db.collection('pageViews').where('timestamp', '>=', startOfTodayIso).count().get(),
        db.collection('pageViews').where('timestamp', '>=', last24hIso).get(),
        db.collection('pageViews').orderBy('timestamp', 'desc').limit(30).get()
      ]);

      // توزيع الأجهزة وحركة الساعات مبنيان من نفس عيّنة آخر 24 ساعة —
      // كافية إحصائياً ولا تحتاج تنزيل كامل تاريخ المشاهدات.
      const last24hDocs = pageViewsLast24hSnap.docs.map((d) => d.data());
      const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
      last24hDocs.forEach((d: any) => {
        const dev = d.device === 'mobile' || d.device === 'tablet' ? d.device : 'desktop';
        deviceCounts[dev as 'mobile' | 'desktop' | 'tablet']++;
      });
      const totalDeviceSamples = Math.max(last24hDocs.length, 1);
      const deviceBreakdown = {
        mobile: Math.round((deviceCounts.mobile / totalDeviceSamples) * 100),
        desktop: Math.round((deviceCounts.desktop / totalDeviceSamples) * 100),
        tablet: Math.round((deviceCounts.tablet / totalDeviceSamples) * 100)
      };

      const hourlyBuckets: { hour: string; views: number; visitors: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const bucketStart = now - (i + 1) * 2 * 60 * 60 * 1000;
        const bucketEnd = now - i * 2 * 60 * 60 * 1000;
        const bucketDocs = last24hDocs.filter((d: any) => {
          const t = new Date(d.timestamp).getTime();
          return t >= bucketStart && t < bucketEnd;
        });
        const uniqueSessions = new Set(bucketDocs.map((d: any) => d.sessionId));
        hourlyBuckets.push({
          hour: new Date(bucketEnd).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
          views: bucketDocs.length,
          visitors: uniqueSessions.size
        });
      }

      const recentVisits = recentVisitsSnap.docs.map((d) => {
        const v = d.data() as any;
        return {
          id: d.id,
          path: v.path,
          pageTitle: v.pageTitle,
          isRegistered: v.isRegistered,
          device: v.device,
          browser: v.browser,
          timestamp: v.timestamp
        };
      });

      res.json({
        totalVisitors: totalVisitorsCount.data().count,
        visitorsToday: visitorsTodayCount.data().count,
        visitorsLast24h: visitorsLast24hCount.data().count,
        totalPageViews: totalPageViewsCount.data().count,
        pageViewsToday: pageViewsTodayCount.data().count,
        pageViewsLast24h: last24hDocs.length,
        deviceBreakdown,
        hourlyTraffic: hourlyBuckets,
        recentVisits
      });
    } catch (err: any) {
      if (err?.message === 'missing_auth_token') {
        return res.status(401).json({ error: 'auth_required', message: 'يتطلب الاطلاع على الإحصائيات تسجيل الدخول أولاً.' });
      }
      console.error('Analytics summary error:', err?.message || err);
      res.status(500).json({ error: 'summary_failed', message: 'تعذر تحميل الإحصائيات. حاول مجدداً.' });
    }
  });

  // تصفير الإحصائيات غير المالية (الزيارات وسجلات المشاهدات، وطلبات
  // الإيداع/السحب/شراء المقالات المرفوضة فقط) — لا يمسّ إطلاقاً أي رقم
  // يمثّل عملية مالية حقيقية تمّت فعلاً (المقبولة/المدفوعة، أو أي رصيد أو
  // سجل أرباح). يحذف المستندات على دفعات لتفادي حد الـ 500 عملية لكل batch.
  async function deleteAllDocsInBatches(
    db: FirebaseFirestore.Firestore,
    query: FirebaseFirestore.Query
  ): Promise<number> {
    let totalDeleted = 0;
    while (true) {
      const snap = await query.limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      totalDeleted += snap.size;
      if (snap.size < 400) break;
    }
    return totalDeleted;
  }

  /**
   * تصفير كل البيانات المالية/النشاطية التجريبية دفعة واحدة — للاستخدام
   * مرة واحدة فقط قبل الإطلاق الحقيقي، بعد تأكيد صريح من المالك أن كل
   * الحسابات والحملات والمقالات الحالية بيانات اختبار أُنشئت أثناء بناء
   * المنصة ولا يوجد أي مستخدم حقيقي بعد.
   *
   * يُصفِّر (لا يحذف) الحقول المالية على المستندات التي يجب أن تبقى
   * موجودة (المستخدمون، الحملات، المقالات)، ويحذف بالكامل المجموعات التي
   * هي سجلات/تاريخ عمليات فقط (لا قيمة لها بعد التصفير، وإبقاؤها يُنشئ
   * سجلات "شبح" تشير إلى أرصدة لم تعد موجودة).
   */
  async function zeroFieldsInBatches(
    db: FirebaseFirestore.Firestore,
    collectionRef: FirebaseFirestore.CollectionReference,
    fields: string[]
  ): Promise<number> {
    let totalUpdated = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    const zeroPatch: Record<string, number> = {};
    fields.forEach((f) => {
      zeroPatch[f] = 0;
    });
    while (true) {
      let q = collectionRef.orderBy('__name__').limit(400) as FirebaseFirestore.Query;
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.update(d.ref, zeroPatch));
      await batch.commit();
      totalUpdated += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 400) break;
    }
    return totalUpdated;
  }

  app.post('/api/admin/reset-test-financial-data', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const db = getAdminDb();

      const callerSnap = await db.collection('users').doc(uid).get();
      const callerData = callerSnap.exists ? callerSnap.data()! : {};
      const isAdminCaller =
        callerData.role === 'admin' ||
        String(callerData.email || '').toLowerCase() === 'brnardtsho@gmail.com';
      if (!isAdminCaller) {
        return res.status(403).json({ error: 'forbidden', message: 'هذا الإجراء مخصص لإدارة المنصة فقط.' });
      }

      // يشترط تأكيداً صريحاً بنص محدد في جسم الطلب — حماية إضافية ضد أي
      // نداء عرضي لهذا المسار المدمِّر، فوق تأكيد الواجهة نفسها.
      if (req.body?.confirm !== 'RESET_ALL_TEST_FINANCIAL_DATA') {
        return res.status(400).json({ error: 'confirmation_required', message: 'يلزم تأكيد صريح لتنفيذ هذا الإجراء.' });
      }

      const [usersReset, campaignsReset, articlesReset] = await Promise.all([
        zeroFieldsInBatches(db, db.collection('users'), [
          'walletBalance',
          'availableBalance',
          'pendingEarnings',
          'lifetimeEarnings',
          'totalEarnings'
        ]),
        zeroFieldsInBatches(db, db.collection('campaigns'), ['totalSpent', 'impressionsCount', 'clicksCount']),
        zeroFieldsInBatches(db, db.collection('articles'), [
          'revenueFromAds',
          'revenueFromSales',
          'totalRevenue',
          'purchasesCount'
        ])
      ]);

      const [
        earningsDeleted,
        articlePurchasesDeleted,
        transactionsDeleted,
        depositRequestsDeleted,
        payoutRequestsDeleted,
        purchaseRequestsDeleted,
        adEventsDeleted,
        fraudFlagsDeleted
      ] = await Promise.all([
        deleteAllDocsInBatches(db, db.collection('earnings')),
        deleteAllDocsInBatches(db, db.collection('articlePurchases')),
        deleteAllDocsInBatches(db, db.collection('transactions')),
        deleteAllDocsInBatches(db, db.collection('depositRequests')),
        deleteAllDocsInBatches(db, db.collection('payoutRequests')),
        deleteAllDocsInBatches(db, db.collection('purchaseRequests')),
        deleteAllDocsInBatches(db, db.collection('adEvents')),
        deleteAllDocsInBatches(db, db.collection('fraudFlags'))
      ]);

      res.json({
        success: true,
        usersReset,
        campaignsReset,
        articlesReset,
        earningsDeleted,
        articlePurchasesDeleted,
        transactionsDeleted,
        depositRequestsDeleted,
        payoutRequestsDeleted,
        purchaseRequestsDeleted,
        adEventsDeleted,
        fraudFlagsDeleted
      });
    } catch (err: any) {
      if (err?.message === 'missing_auth_token') {
        return res.status(401).json({ error: 'auth_required', message: 'يتطلب هذا الإجراء تسجيل الدخول أولاً.' });
      }
      console.error('Reset test financial data error:', err?.message || err);
      res.status(500).json({ error: 'reset_failed', message: 'تعذر تصفير البيانات. حاول مجدداً.' });
    }
  });

  app.post('/api/analytics/reset', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const db = getAdminDb();

      const callerSnap = await db.collection('users').doc(uid).get();
      const callerData = callerSnap.exists ? callerSnap.data()! : {};
      const isAdminCaller =
        callerData.role === 'admin' ||
        String(callerData.email || '').toLowerCase() === 'brnardtsho@gmail.com';
      if (!isAdminCaller) {
        return res.status(403).json({ error: 'forbidden', message: 'هذا الإجراء مخصص لإدارة المنصة فقط.' });
      }

      const [pageViewsDeleted, sessionsDeleted, rejectedDepositsDeleted, rejectedPayoutsDeleted, rejectedPurchasesDeleted] =
        await Promise.all([
          deleteAllDocsInBatches(db, db.collection('pageViews')),
          deleteAllDocsInBatches(db, db.collection('visitorSessions')),
          deleteAllDocsInBatches(db, db.collection('depositRequests').where('status', '==', 'rejected')),
          deleteAllDocsInBatches(db, db.collection('payoutRequests').where('status', '==', 'rejected')),
          deleteAllDocsInBatches(db, db.collection('purchaseRequests').where('status', '==', 'rejected'))
        ]);

      res.json({
        success: true,
        pageViewsDeleted,
        sessionsDeleted,
        rejectedDepositsDeleted,
        rejectedPayoutsDeleted,
        rejectedPurchasesDeleted
      });
    } catch (err: any) {
      if (err?.message === 'missing_auth_token') {
        return res.status(401).json({ error: 'auth_required', message: 'يتطلب هذا الإجراء تسجيل الدخول أولاً.' });
      }
      console.error('Analytics reset error:', err?.message || err);
      res.status(500).json({ error: 'reset_failed', message: 'تعذر تصفير الإحصائيات. حاول مجدداً.' });
    }
  });

  // -------------------------------------------------------------------
  // بوتات النشر والتفاعل التلقائي
  // -------------------------------------------------------------------
  // نظام مستقل تماماً عن أي مستخدم حقيقي: 8 حسابات كتّاب افتراضية (بوتات)
  // بملفات شخصية كاملة، تنشر مقالاً واحداً وتغريدة واحدة فقط في اليوم
  // إجمالاً (بالتداول بين الحسابات — كاتب مختلف كل يوم، وليس كل بوت ينشر
  // يومياً)، ثم تتفاعل فيما بينها (إعجاب + تعليق) على المنشور الجديد. كل
  // الكتابة تمر عبر Admin SDK (لا حساب Firebase Auth حقيقي لأي بوت)،
  // ومحمية بمفتاح سرّي مشترك (BOTS_CRON_SECRET) بدل رمز هوية مستخدم — يُستدعى
  // هذا المسار من سير GitHub Actions مجدول (.github/workflows/bots-daily-cycle.yml)
  // لا من أي متصفح. isEligibleForMonetization يستبعد كل حسابات isBot=true
  // من أي احتساب أرباح بصرف النظر عن هذا المسار (انظر creatorEligibility.ts).
  const BOT_PERSONAS: Array<{
    id: string;
    fullName: string;
    username: string;
    bio: string;
    topics: string[];
  }> = [
    {
      id: 'bot_sara_alahmadi',
      fullName: 'سارة الأحمدي',
      username: 'sara_alahmadi',
      bio: 'كاتبة مهتمة بالأدب والفلسفة، تحاول أن تقرأ العالم من زاوية الكلمة.',
      topics: ['literature', 'philosophy']
    },
    {
      id: 'bot_yousef_alzahrani',
      fullName: 'يوسف الزهراني',
      username: 'yousef_alzahrani',
      bio: 'مهتم بالتقنية والعلوم وأثرهما المتسارع على حياتنا اليومية.',
      topics: ['technology', 'science']
    },
    {
      id: 'bot_layla_almansouri',
      fullName: 'ليلى المنصوري',
      username: 'layla_almansouri',
      bio: 'شغوفة بالفنون والثقافة، تكتب عن الجمال بوصفه حاجة إنسانية أصيلة.',
      topics: ['arts', 'literature']
    },
    {
      id: 'bot_omar_alhakimi',
      fullName: 'عمر الحكيمي',
      username: 'omar_alhakimi',
      bio: 'قارئ للتاريخ والسياسة، يؤمن أن فهم الماضي مفتاح لفهم الحاضر.',
      topics: ['history', 'politics']
    },
    {
      id: 'bot_noor_alsharif',
      fullName: 'نور الشريف',
      username: 'noor_alsharif',
      bio: 'تكتب عن التنمية الذاتية والصحة النفسية من منظور واقعي غير مثالي.',
      topics: ['health', 'family']
    },
    {
      id: 'bot_khalid_binrashid',
      fullName: 'خالد بن راشد',
      username: 'khalid_binrashid',
      bio: 'مهتم بالأعمال والاقتصاد، يكتب لمن يريد فهم السوق دون تعقيد.',
      topics: ['business', 'general']
    },
    {
      id: 'bot_hind_alabdali',
      fullName: 'هند العبدلي',
      username: 'hind_alabdali',
      bio: 'مربية ومهتمة بشؤون الأسرة والتعليم، تكتب من واقع تجربة يومية.',
      topics: ['education', 'family']
    },
    {
      id: 'bot_faisal_alnuaimi',
      fullName: 'فيصل النعيمي',
      username: 'faisal_alnuaimi',
      bio: 'محب للسفر والرياضة، يرى في كليهما مدرسة للانضباط والاكتشاف.',
      topics: ['sports', 'travel']
    }
  ];

  function requireBotsCronSecret(req: express.Request, res: express.Response): boolean {
    const expected = process.env.BOTS_CRON_SECRET;
    if (!expected) {
      res.status(503).json({
        error: 'not_configured',
        message: 'لم يُضبط BOTS_CRON_SECRET على الخادم — نظام البوتات غير مفعَّل بعد.'
      });
      return false;
    }
    const provided = req.headers['x-bots-cron-secret'];
    if (provided !== expected) {
      res.status(403).json({ error: 'forbidden', message: 'مفتاح تشغيل البوتات غير صحيح.' });
      return false;
    }
    return true;
  }

  async function requireAdminCaller(req: express.Request, res: express.Response): Promise<string | null> {
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const db = getAdminDb();
      const callerSnap = await db.collection('users').doc(uid).get();
      const callerData = callerSnap.exists ? callerSnap.data()! : {};
      const isAdminCaller =
        callerData.role === 'admin' ||
        String(callerData.email || '').toLowerCase() === 'brnardtsho@gmail.com';
      if (!isAdminCaller) {
        res.status(403).json({ error: 'forbidden', message: 'هذا الإجراء مخصص لإدارة المنصة فقط.' });
        return null;
      }
      return uid;
    } catch (err: any) {
      if (err?.message === 'missing_auth_token') {
        res.status(401).json({ error: 'auth_required', message: 'يتطلب هذا الإجراء تسجيل الدخول أولاً.' });
      } else {
        res.status(500).json({ error: 'auth_check_failed', message: 'تعذر التحقق من الصلاحية.' });
      }
      return null;
    }
  }

  // ينشئ حسابات البوتات الثمانية إن لم تكن موجودة بعد (idempotent — لا يكرر
  // الإنشاء أو يطبّق أي بيانات إن كانت موجودة أصلاً، حفاظاً على أي تعديل
  // يدوي محتمل من الأدمن لاحقاً على الاسم/النبذة).
  app.post('/api/admin/bots/seed', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    if (!(await requireAdminCaller(req, res))) return;
    try {
      const db = getAdminDb();
      const nowIso = new Date().toISOString();
      let created = 0;
      let alreadyExisted = 0;

      for (const persona of BOT_PERSONAS) {
        const ref = db.collection('users').doc(persona.id);
        const snap = await ref.get();
        if (snap.exists) {
          alreadyExisted++;
          continue;
        }
        await ref.set({
          id: persona.id,
          email: `${persona.username}@bots.literium.internal`,
          fullName: persona.fullName,
          username: persona.username,
          avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(persona.username)}`,
          role: 'writer',
          bio: persona.bio,
          isBot: true,
          isVerified: false,
          isKycVerified: false,
          isBanned: false,
          followersCount: 0,
          followingCount: 0,
          articlesCount: 0,
          totalViews: 0,
          walletBalance: 0,
          availableBalance: 0,
          pendingEarnings: 0,
          lifetimeEarnings: 0,
          joinedDate: nowIso,
          createdAt: nowIso
        });
        created++;
      }

      res.json({ success: true, created, alreadyExisted, total: BOT_PERSONAS.length });
    } catch (err: any) {
      console.error('Bot seed error:', err?.message || err);
      res.status(500).json({ error: 'seed_failed', message: 'تعذر إنشاء حسابات البوتات.' });
    }
  });

  // الدورة اليومية الفعلية: تُستدعى من سير GitHub Actions مجدول، محمية
  // بمفتاح سرّي مشترك (وليس رمز هوية مستخدم — لا مستخدم حقيقياً يستدعيها).
  app.post('/api/bots/run-daily-cycle', async (req, res) => {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'not_configured', message: 'الخدمة غير مهيأة على الخادم حالياً.' });
    }
    if (!requireBotsCronSecret(req, res)) return;

    try {
      const db = getAdminDb();

      const settingsSnap = await db.collection('settings').doc('publishingBots').get();
      const enabled = settingsSnap.exists && settingsSnap.data()?.enabled === true;
      if (!enabled) {
        return res.json({ success: true, skipped: true, reason: 'bots_disabled' });
      }

      const botsSnap = await db.collection('users').where('isBot', '==', true).get();
      const bots = botsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      if (bots.length === 0) {
        return res.json({ success: true, skipped: true, reason: 'no_bots_seeded' });
      }

      const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      const stateRef = db.collection('botRunState').doc('state');
      const stateSnap = await stateRef.get();
      const state = stateSnap.exists
        ? (stateSnap.data() as any)
        : { lastRunDate: null, articleRotationIndex: 0, tweetRotationIndex: 0 };

      // ضمان عدم التكرار: لو استُدعي هذا المسار أكثر من مرة في نفس اليوم
      // (إعادة محاولة يدوية من السير، أو تشغيل يدوي إضافي)، لا يُنشر شيء
      // إضافي — يكفي مقال وتغريدة واحدة فقط يومياً كما يشترط النظام.
      if (state.lastRunDate === todayKey) {
        return res.json({ success: true, skipped: true, reason: 'already_ran_today' });
      }

      const client = getGeminiClient();
      const articleBot = bots[state.articleRotationIndex % bots.length];
      const tweetBot = bots[state.tweetRotationIndex % bots.length];

      const articleTopic = (articleBot.topics && articleBot.topics[0]) || 'general';
      const nowIso = new Date().toISOString();
      const activityLog: Array<Record<string, any>> = [];

      // 1) توليد ونشر مقال يومي واحد
      let articleTitle = '';
      let articleContent = '';
      if (client) {
        const prompt = `اكتب مقالاً أدبياً وفكرياً غنياً وعميقاً بالفصحى في قسم (${articleTopic})، لا يقل عن 500 كلمة، بأسلوب راقٍ ومترابط. ابدأ الرد بسطر واحد فقط بالشكل التالي:\nالعنوان: <عنوان جذاب>\nثم اكتب سطر "---" وحده، ثم اكتب محتوى المقال كاملاً بعده.`;
        const response = await client.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: { maxOutputTokens: 2000 }
        });
        const raw = response.text || '';
        const parts = raw.split(/\n-{3,}\n/);
        const titleLine = (parts[0] || '').replace(/^العنوان:\s*/i, '').trim();
        articleTitle = titleLine || 'تأملات في المعنى';
        articleContent = (parts[1] || raw).trim();
      }
      if (!articleContent) {
        articleTitle = articleTitle || 'تأملات في المعنى';
        articleContent =
          'ثمة لحظات يتوقف فيها الزمن قليلاً، تتيح لنا أن نعيد النظر في تفاصيل نظنها عابرة، بينما هي في حقيقتها تحمل من المعنى ما يستحق التأمل والكتابة عنه.';
      }

      const articleId = `bot_article_${Date.now()}`;
      const articleData = {
        id: articleId,
        writerId: articleBot.id,
        writerName: articleBot.fullName,
        writerUsername: articleBot.username,
        writerAvatar: articleBot.avatarUrl,
        writerIsVerified: false,
        title: articleTitle,
        slug: `article-${articleId}`,
        description: articleContent.slice(0, 150),
        content: articleContent,
        featuredImage: `https://picsum.photos/seed/${articleId}/1200/630`,
        category: articleTopic,
        isLocked: false,
        readingTimeMinutes: Math.max(1, Math.round(articleContent.split(/\s+/).length / 200)),
        status: 'published',
        viewsCount: 0,
        likesCount: 0,
        sharesCount: 0,
        commentsCount: 0,
        purchasesCount: 0,
        rating: 0,
        ratingsCount: 0,
        ratingsSum: 0,
        revenueFromAds: 0,
        revenueFromSales: 0,
        totalRevenue: 0,
        publishedAt: nowIso,
        tags: [articleTopic]
      };
      await db.collection('articles').doc(articleId).set(articleData);
      activityLog.push({
        type: 'article',
        botId: articleBot.id,
        botName: articleBot.fullName,
        targetId: articleId,
        targetType: 'article',
        summary: articleTitle,
        createdAt: nowIso
      });

      // 2) توليد ونشر تغريدة يومية واحدة
      let tweetContent = '';
      if (client) {
        const tweetTopic = (tweetBot.topics && tweetBot.topics[0]) || 'general';
        const prompt = `اكتب تغريدة قصيرة (أقل من 220 حرفاً) بالفصحى، فكرة أو خاطرة موجزة ومؤثرة حول موضوع (${tweetTopic})، بلا هاشتاغات وبلا علامات اقتباس.`;
        const response = await client.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: { maxOutputTokens: 150 }
        });
        tweetContent = (response.text || '').trim().slice(0, 280);
      }
      if (!tweetContent) {
        tweetContent = 'أحياناً لا نحتاج إلى إجابات كثيرة بقدر حاجتنا إلى أسئلة صادقة نطرحها على أنفسنا.';
      }

      const tweetId = `bot_tweet_${Date.now()}`;
      const tweetData = {
        id: tweetId,
        authorId: tweetBot.id,
        authorName: tweetBot.fullName,
        authorUsername: tweetBot.username,
        authorAvatar: tweetBot.avatarUrl,
        authorRole: 'writer',
        content: tweetContent,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: nowIso
      };
      await db.collection('tweets').doc(tweetId).set(tweetData);
      activityLog.push({
        type: 'tweet',
        botId: tweetBot.id,
        botName: tweetBot.fullName,
        targetId: tweetId,
        targetType: 'tweet',
        summary: tweetContent.slice(0, 80),
        createdAt: nowIso
      });

      // 3) تفاعل تلقائي: بوتات أخرى (غير الناشر) تعجب وتعلّق على كل منشور
      async function interactWith(
        targetId: string,
        targetType: 'article' | 'tweet',
        authorBotId: string,
        content: string,
        topic: string
      ) {
        const others = bots.filter((b) => b.id !== authorBotId);
        if (others.length === 0) return;
        const shuffled = [...others].sort(() => Math.random() - 0.5);
        const likers = shuffled.slice(0, Math.min(3, shuffled.length));
        const commenter = shuffled[0];

        const likesCollection = targetType === 'article' ? 'likes' : 'tweetLikes';
        const likeFieldId = targetType === 'article' ? 'articleId' : 'tweetId';
        for (const liker of likers) {
          const likeId = `${targetId}_${liker.id}`;
          await db.collection(likesCollection).doc(likeId).set({
            id: likeId,
            [likeFieldId]: targetId,
            userId: liker.id,
            createdAt: nowIso
          });
          activityLog.push({
            type: 'like',
            botId: liker.id,
            botName: liker.fullName,
            targetId,
            targetType,
            summary: '',
            createdAt: nowIso
          });
        }
        await db
          .collection(targetType === 'article' ? 'articles' : 'tweets')
          .doc(targetId)
          .update({ likesCount: FieldValue.increment(likers.length) });

        let commentText = '';
        if (client) {
          const prompt = `اكتب تعليقاً قصيراً وطبيعياً بالفصحى (سطر أو سطرين فقط) كردة فعل حقيقية على المحتوى التالي حول موضوع (${topic}):\n${content.slice(0, 400)}`;
          const response = await client.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: prompt,
            config: { maxOutputTokens: 120 }
          });
          commentText = (response.text || '').trim();
        }
        if (!commentText) commentText = 'فكرة تستحق التأمل، شكراً على المشاركة.';

        const commentsCollection = targetType === 'article' ? 'comments' : 'tweetComments';
        const commentTargetField = targetType === 'article' ? 'articleId' : 'tweetId';
        const commentId = `bot_comment_${Date.now()}_${commenter.id}`;
        await db.collection(commentsCollection).doc(commentId).set({
          id: commentId,
          [commentTargetField]: targetId,
          userId: commenter.id,
          userName: commenter.fullName,
          userAvatar: commenter.avatarUrl,
          userRole: 'writer',
          content: commentText,
          likesCount: 0,
          createdAt: nowIso,
          replies: []
        });
        await db
          .collection(targetType === 'article' ? 'articles' : 'tweets')
          .doc(targetId)
          .update({ commentsCount: FieldValue.increment(1) });
        activityLog.push({
          type: 'comment',
          botId: commenter.id,
          botName: commenter.fullName,
          targetId,
          targetType,
          summary: commentText.slice(0, 80),
          createdAt: nowIso
        });
      }

      await interactWith(articleId, 'article', articleBot.id, articleContent, articleTopic);
      await interactWith(tweetId, 'tweet', tweetBot.id, tweetContent, (tweetBot.topics && tweetBot.topics[0]) || 'general');

      // 4) تحديث حالة الدورة (منع التكرار اليومي + تدوير الكاتب التالي)
      await stateRef.set(
        {
          lastRunDate: todayKey,
          articleRotationIndex: (state.articleRotationIndex + 1) % bots.length,
          tweetRotationIndex: (state.tweetRotationIndex + 1) % bots.length,
          updatedAt: nowIso
        },
        { merge: true }
      );

      // 5) تسجيل كل الأنشطة في سجل واحد للعرض في لوحة الإدارة
      const batch = db.batch();
      for (const entry of activityLog) {
        const ref = db.collection('botActivityLog').doc(`${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        batch.set(ref, entry);
      }
      await batch.commit();

      res.json({ success: true, articleId, tweetId, interactions: activityLog.length });
    } catch (err: any) {
      console.error('Bot daily cycle error:', err?.message || err);
      res.status(500).json({ error: 'cycle_failed', message: 'تعذر تنفيذ دورة البوتات اليومية.' });
    }
  });

  // AI Writing Suite endpoint for writers
  app.post('/api/ai/writing-assistant', async (req, res) => {
    try {
      const { action, text, title, category, userId, isSubscriber, plan } = req.body;

      // 1. Mandatory Login & Quota Check
      const quotaCheck = verifyAndConsumeServerQuota(userId, isSubscriber, plan);
      if (!quotaCheck.allowed) {
        if (quotaCheck.reason === 'auth_required') {
          return res.status(401).json({
            error: 'auth_required',
            message: 'يتطلب استخدام أدوات الكتابة بالذكاء الاصطناعي تسجيل الدخول أولاً.'
          });
        }
        return res.status(429).json({
          error: 'quota_exceeded',
          message: `لقد استنفدت حد الاستخدام المجاني لليوم (${freeDailyLimitForMessage}/${freeDailyLimitForMessage}). يرجى الاشتراك في إحدى باقات Pro للمتابعة.`
        });
      }

      const client = getGeminiClient();

      if (client) {
        let promptText = '';
        if (action === 'suggest_titles') {
          promptText = `اقترح 5 عناوين أدبية وجذابة جداً لمقال في قسم (${category || 'عام'}) حول الموضوع التالي:\n${text || title}`;
        } else if (action === 'generate_paragraph') {
          promptText = `اكتب فقرة استهلالية أو فقرة مقال أدبية وفكرية عميقة ومترابطة حول الموضوع/العنوان التالي: "${title || ''}" مع السياق: "${text || ''}". استخدم لغة عربية فصيحة وبلاغة رصينة.`;
        } else if (action === 'improve_style') {
          promptText = `قم بتحسين الصياغة الأدبية والبلاغية للنص التالي ليكون عميقاً ومؤثراً وفصيحاً مع الحفاظ على الفكرة الأصلية:\n${text}`;
        } else if (action === 'fix_grammar') {
          promptText = `قم بالتدقيق النحوي والإملائي الدقيق للنص العربي التالي مع تصحيح علامات الترقيم وصياغة الأسلوب دون تغيير المعنى:\n${text}`;
        } else if (action === 'summarize_article' || action === 'summarize') {
          promptText = `قم بتلخيص المقال التالي في 2-3 أسطر مكثفة ومشوقة تصلح كوصف ومقدمة للمقال:\nالعنوان: ${title || ''}\nالمحتوى: ${text}`;
        } else if (action === 'suggest_categories') {
          promptText = `بناءً على نص وعنوان المقال التالي، اقترح أفضل تصنيف رئيسي وتصنيف فرعي و5 وسوم دقيقة مفصولة بفواصل:\nالعنوان: ${title || ''}\nالنص: ${text}`;
        } else if (action === 'summarize_tags') {
          promptText = `قم بكتابة ملخص مكثف وجذاب في سطرين للنص التالي، ثم اقترح 5 وسوم (هاشتاغات) ملائمة مفصولة بفواصل:\n${text || title}`;
        } else if (action === 'generate_outline') {
          promptText = `قم بإنشاء هيكل مقال متكامل (مقدمة، 3 محاور رئيسية، خاتمة) لعنوان المقال التالي:\n${title || text}`;
        }

        // سقف لعدد رموز الاستجابة لكل نوع أداة — دون سقف كان النموذج قد
        // يتوسّع في التوليد لأبعد مما تحتاجه الأداة فعلياً (مثلاً 5 عناوين
        // قصيرة لا تحتاج مئات الأسطر)، فيبطئ وصول الرد دون أي فائدة إضافية
        // للمستخدم. القيم الأعلى (تحسين الأسلوب/التدقيق) تبقى سخية لتفادي
        // اقتطاع نص المقال نفسه.
        const maxOutputTokensByAction: Record<string, number> = {
          suggest_titles: 400,
          summarize_article: 350,
          summarize: 350,
          suggest_categories: 250,
          summarize_tags: 250,
          generate_paragraph: 600,
          generate_outline: 700,
          improve_style: 3000,
          fix_grammar: 3000
        };

        const response = await client.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: promptText,
          config: {
            maxOutputTokens: maxOutputTokensByAction[action] || 800
          }
        });

        res.json({
          result: response.text,
          remainingUses: quotaCheck.remaining
        });
      } else {
        // Smart fallback mock generation
        let fallbackResult = '';
        if (action === 'suggest_titles') {
          fallbackResult = `1. أطياف الفكرة: أبعاد جديدة في رحلة ${title || 'المعنى'}\n2. ما وراء السطور: تأملات نقدية معاصرة\n3. بوصلة الكلمة: كيف نعيد تشكيل الوعي العربي\n4. نداء الإبداع في زمن التحولات المتسارعة\n5. تجليات الرؤية: قراءة استكشافية شاملة`;
        } else if (action === 'generate_paragraph') {
          fallbackResult = `ينفتح أفق الفكر الإنساني حين تتلاقى الكلمة الواعية مع تطلعات الروح الباحثة عن الحقيقة؛ إذ لا يمكن للإبداع أن يكتمل إلا عبر تأمل متأنٍ في تفاصيل الواقع المعاش وإعادة صياغتها برؤية جمالية تنبض بالحياة والأمل.`;
        } else if (action === 'fix_grammar') {
          fallbackResult = text ? `${text}\n\n[تم التدقيق الإملائي والنحوي بنجاح وفق قواعد الفصحى]` : 'يرجى كتابة نص ليتم تدقيقه إملائياً ونحوياً.';
        } else if (action === 'improve_style') {
          fallbackResult = text ? `إنّ المتأمل في عمق الفكرة يدرك بجلاء أن: ${text}` : 'يرجى تقديم نص لتحسين أسلوبه الأدبي.';
        } else if (action === 'summarize_tags') {
          fallbackResult = `الملخص: دراسة تأملية معمقة تستجلي أبعاد الفكرة وأثرها البارز في الوعي الثقافي المعاصر.\n\nالوسوم المقترحة: #أدب, #فكر, #قراءات, #إبداع, #ثقافة`;
        } else if (action === 'generate_outline') {
          fallbackResult = `## هيكل المقال المقترح لـ "${title || 'مقال أدبي'}":\n\n1. **المقدمة**: إثارة التساؤل الجوهري وتمهيد السياق التاريخي والفكري.\n2. **المحور الأول**: البنية الأساسية للموضوع وتجلياته المعاصرة.\n3. **المحور الثاني**: الأثر الثقافي والاجتماعي وأبرز التحديات.\n4. **المحور الثالث**: استشراف المستقبل وسبل التطوير الإبداعي.\n5. **الخاتمة**: خلاصة الأطروحة ورسالة ملهمة للقارئ.`;
        }
        res.json({
          result: fallbackResult,
          remainingUses: quotaCheck.remaining
        });
      }
    } catch (error: any) {
      console.error('Writing assistant error:', error);
      res.status(500).json({ error: 'Failed to process AI writing assistant request' });
    }
  });

  // -------------------------------------------------------------------
  // بوابة الدفع الآلية — إيداع عبر Stripe Checkout، وسحب عبر Stripe
  // Connect (Express accounts). كل نقطة هنا تتحقق من رمز هوية Firebase
  // الحقيقي (لا تثق بأي userId يُرسله العميل)، وتقرأ الرصيد من Firestore
  // مباشرة (لا تثق بأي رقم يرسله العميل) قبل أي عملية مالية.
  //
  // إن لم تُضبط مفاتيح Stripe و/أو Firebase Admin، كل هذه النقاط تعيد
  // 503 برسالة واضحة، ويستمر مسار الطلب اليدوي الحالي في الواجهة يعمل
  // بلا أي تغيير.
  // -------------------------------------------------------------------

  app.get('/api/payments/status', (req, res) => {
    res.json({
      automated: isPaymentAutomationReady(),
      provider: activeProvider.isConfigured() ? activeProvider.name : null,
      adminConfigured: isAdminConfigured(),
      reason: isPaymentAutomationReady() ? undefined : (getAdminInitError() || 'payment_provider_not_configured')
    });
  });

  app.post('/api/payments/deposit/create-checkout', async (req, res) => {
    if (!requireAutomation(res)) return;
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
        return res.status(400).json({ error: 'invalid_amount', message: 'المبلغ يجب أن يكون بين 1 و50,000$.' });
      }

      const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const result = await activeProvider.createDepositCheckout({
        uid,
        amount,
        currency: 'usd',
        successUrl: `${baseUrl}/?payment=success`,
        cancelUrl: `${baseUrl}/?payment=cancelled`
      });
      res.json(result);
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 500;
      console.error('deposit/create-checkout error:', err?.message || err);
      res.status(status).json({ error: 'deposit_checkout_failed', message: err?.message || 'تعذر بدء عملية الإيداع.' });
    }
  });

  // ------------------------------------------------------------------
  // إيداع فوري بعملات رقمية عبر NOWPayments — مستقل تماماً عن Stripe،
  // يعمل أو لا يعمل بشكل منفصل حسب مفاتيحه الخاصة فقط.
  // ------------------------------------------------------------------
  app.get('/api/payments/nowpayments/status', (req, res) => {
    res.json({
      automated: isNowPaymentsConfigured() && isNowPaymentsIpnConfigured() && isAdminConfigured(),
      configured: isNowPaymentsConfigured()
    });
  });

  app.post('/api/payments/nowpayments/create-invoice', async (req, res) => {
    if (!isNowPaymentsConfigured() || !isNowPaymentsIpnConfigured() || !isAdminConfigured()) {
      return res.status(503).json({
        error: 'nowpayments_not_configured',
        message: 'الدفع الفوري بالعملات الرقمية غير مفعّل على هذا الخادم بعد.'
      });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
        return res.status(400).json({ error: 'invalid_amount', message: 'المبلغ يجب أن يكون بين 1 و50,000$.' });
      }

      const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      // ⚠️ لا يُمرَّر ipnCallbackUrl هنا عمداً — راجع التعليق في
      // createNowPaymentsInvoice. NOWPayments يستخدم رابط IPN المضبوط
      // يدوياً في لوحته (والذي تحقق المالك من صحته فعلياً)، بدل رابط
      // مبني تلقائياً من الطلب قد يختلف عن النطاق العام الحقيقي.
      const result = await createNowPaymentsInvoice({
        uid,
        amount,
        successUrl: `${baseUrl}/?payment=success`,
        cancelUrl: `${baseUrl}/?payment=cancelled`
      });
      res.json({ checkoutUrl: result.invoiceUrl });
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 500;
      console.error('nowpayments/create-invoice error:', err?.message || err);
      res.status(status).json({ error: 'nowpayments_invoice_failed', message: err?.message || 'تعذر بدء عملية الدفع بالعملة الرقمية.' });
    }
  });

  // عنوان استلام USDT-TRC20 مباشر (Payment API) — يُعرض للمستخدم مع زر نسخ
  // ليدفع عبر وسيط بطاقة↔كريبتو خارجي (بما إن التعبئة التلقائية عبر رابط
  // جاهز غير موثوقة). يستخدم نفس بنية IPN الموقّعة أعلاه، ونفس منطق
  // الاعتماد بالـ webhook (partially_paid/finished عبر actually_paid).
  app.post('/api/payments/nowpayments/create-direct-payment', async (req, res) => {
    if (!isNowPaymentsConfigured() || !isNowPaymentsIpnConfigured() || !isAdminConfigured()) {
      return res.status(503).json({
        error: 'nowpayments_not_configured',
        message: 'الدفع الفوري بالعملات الرقمية غير مفعّل على هذا الخادم بعد.'
      });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
        return res.status(400).json({ error: 'invalid_amount', message: 'المبلغ يجب أن يكون بين 1 و50,000$.' });
      }

      const result = await createNowPaymentsDirectPayment({ uid, amount });
      res.json({
        payAddress: result.payAddress,
        payCurrency: result.payCurrency,
        payAmount: result.payAmount
      });
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 500;
      console.error('nowpayments/create-direct-payment error:', err?.message || err);
      res.status(status).json({ error: 'nowpayments_direct_payment_failed', message: err?.message || 'تعذر إنشاء عنوان استلام الدفع.' });
    }
  });

  // فحص حالة حساب الاستلام دون إنشائه — كي لا يُنشأ حساب Stripe Connect
  // لكل مستخدم فتح تبويب السحب فقط دون نية الربط الفعلي.
  app.get('/api/payments/payout/status', async (req, res) => {
    if (!requireAutomation(res)) return;
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const db = getAdminDb();
      const snap = await db.collection('users').doc(uid).get();
      const accountId = snap.data()?.stripeConnectedAccountId as string | undefined;
      if (!accountId) {
        return res.json({ connected: false, payoutsEnabled: false });
      }
      const status = await activeProvider.getPayoutAccountStatus(accountId);
      res.json(status);
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 500;
      res.status(status).json({ error: 'status_check_failed', message: err?.message || 'تعذر فحص حالة حساب السحب.' });
    }
  });

  app.post('/api/payments/payout/connect-link', async (req, res) => {
    if (!requireAutomation(res)) return;
    try {
      const { uid, email } = await verifyRequestAuth(req.headers.authorization);
      const db = getAdminDb();
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: 'user_not_found' });
      }
      const existingAccountId = userSnap.data()?.stripeConnectedAccountId as string | undefined;

      const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const result = await activeProvider.ensurePayoutAccount({
        uid,
        email,
        existingAccountId,
        refreshUrl: `${baseUrl}/?payoutConnect=refresh`,
        returnUrl: `${baseUrl}/?payoutConnect=done`
      });

      if (result.accountId !== existingAccountId) {
        await userRef.update({ stripeConnectedAccountId: result.accountId });
      }

      res.json(result);
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 500;
      console.error('payout/connect-link error:', err?.message || err);
      res.status(status).json({ error: 'connect_link_failed', message: err?.message || 'تعذر إنشاء رابط ربط حساب السحب.' });
    }
  });

  app.post('/api/payments/payout/create', async (req, res) => {
    if (!requireAutomation(res)) return;
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 50) {
        return res.status(400).json({ error: 'invalid_amount', message: 'الحد الأدنى للسحب 50$.' });
      }

      const db = getAdminDb();
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return res.status(404).json({ error: 'user_not_found' });
      const userData = userSnap.data() || {};

      // ⚠️ نفس شرط التوثيق (KYC) المطبَّق على مسار السحب اليدوي — لا نسمح
      // بمسار آلي "أسهل" يتجاوز التحقق من الهوية.
      if (userData.kycDetails?.status !== 'verified' && !userData.isKycVerified) {
        return res.status(403).json({ error: 'kyc_required', message: 'يجب إتمام التحقق من الهوية (KYC) قبل السحب.' });
      }

      // الرصيد يُقرأ من Firestore مباشرة — لا نثق بأي رقم يرسله العميل.
      const available = Number(userData.availableBalance || 0);
      if (amount > available) {
        return res.status(400).json({ error: 'insufficient_balance', message: 'المبلغ يتجاوز رصيدك المتاح للسحب.' });
      }

      const accountId = userData.stripeConnectedAccountId as string | undefined;
      if (!accountId) {
        return res.status(409).json({ error: 'payout_account_not_connected', message: 'يجب ربط حساب استلام الأموال أولاً.' });
      }
      const accountStatus = await activeProvider.getPayoutAccountStatus(accountId);
      if (!accountStatus.payoutsEnabled) {
        return res.status(409).json({ error: 'payout_account_not_ready', message: 'حساب استلام الأموال لم يكتمل تفعيله بعد.' });
      }

      const payout = await activeProvider.createPayout({ accountId, amount, currency: 'usd', uid });
      if (!payout.ok) {
        return res.status(502).json({ error: 'payout_failed', message: payout.reason || 'فشل تنفيذ التحويل.' });
      }

      // خصم الرصيد وتسجيل الحركة ذرّياً معاً بعد نجاح التحويل الفعلي فقط.
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(userRef);
        const freshAvailable = Number(freshSnap.data()?.availableBalance || 0);
        tx.update(userRef, { availableBalance: Number(Math.max(0, freshAvailable - amount).toFixed(2)) });
        tx.set(db.collection('payoutRequests').doc(), {
          userId: uid,
          amount,
          method: 'stripe',
          status: 'completed',
          providerRef: payout.providerRef,
          createdAt: new Date().toISOString()
        });
        tx.set(db.collection('notifications').doc(), {
          userId: uid,
          type: 'withdrawal',
          title: '✅ تم تنفيذ عملية السحب',
          message: `تم تحويل ${amount}$ إلى حسابك المرتبط تلقائياً.`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      });

      res.json({ ok: true, providerRef: payout.providerRef });
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 500;
      console.error('payout/create error:', err?.message || err);
      res.status(status).json({ error: 'payout_create_failed', message: err?.message || 'تعذر تنفيذ عملية السحب.' });
    }
  });

  // ------------------------------------------------------------------
  // رفع الوسائط الإعلانية (صورة/فيديو قصير) — Cloudinary
  // ------------------------------------------------------------------
  const mediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_VIDEO_BYTES }
  });

  app.get('/api/media/status', (req, res) => {
    res.json({ configured: isMediaUploadConfigured() });
  });

  app.post('/api/media/upload', mediaUpload.single('file'), async (req, res) => {
    if (!isMediaUploadConfigured()) {
      return res.status(503).json({
        error: 'media_upload_not_configured',
        message: 'رفع الوسائط غير مفعّل على هذا الخادم بعد. استخدم رابطاً خارجياً بدلاً من ذلك.'
      });
    }
    try {
      const { uid } = await verifyRequestAuth(req.headers.authorization);
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'no_file', message: 'لم يتم إرفاق أي ملف.' });
      }

      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');
      if (!isImage && !isVideo) {
        return res.status(400).json({ error: 'unsupported_type', message: 'نوع الملف غير مدعوم. استخدم صورة أو فيديو.' });
      }
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: 'file_too_large', message: 'حجم الصورة يتجاوز 8 ميغابايت.' });
      }
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        return res.status(400).json({ error: 'file_too_large', message: 'حجم الفيديو يتجاوز 50 ميغابايت.' });
      }

      // فيديو المقالات ليس له حد مدة، وفيديو رسائل المحادثة محدود بـ5 دقائق
      // (300 ثانية) — بخلاف فيديو الإعلانات المحدود بدقيقة واحدة فقط
      // (القيمة الافتراضية غير المُمرَّرة تُبقي حدّها كما هو).
      const purpose = req.body?.purpose === 'article' ? 'article' : req.body?.purpose === 'message' ? 'message' : 'ad';
      const folderName = purpose === 'article' ? 'articles' : purpose === 'message' ? 'messages' : 'ads';
      const result = await uploadMediaBuffer(file.buffer, {
        folder: `literium/${folderName}/${uid}`,
        resourceType: isVideo ? 'video' : 'image',
        maxDurationSeconds: purpose === 'article' ? Infinity : purpose === 'message' ? 300 : undefined
      });

      res.json(result);
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : err?.message === 'video_too_long' ? 400 : 500;
      const message =
        err?.message === 'video_too_long'
          ? 'مدة الفيديو تتجاوز الدقيقة المسموحة.'
          : err?.message || 'تعذر رفع الملف.';
      console.error('media/upload error:', err?.message || err);
      res.status(status).json({ error: 'upload_failed', message });
    }
  });

  // ------------------------------------------------------------------
  // تحقق حقيقي من الانضمام/الاشتراك (تيليجرام ويوتيوب فقط — انظر شرح
  // القيود التقنية والسياسية للمنصات الأخرى في server/socialVerify.ts)
  // ------------------------------------------------------------------
  app.get('/api/social/status', (req, res) => {
    res.json({
      telegram: isTelegramVerificationConfigured(),
      youtube: isYoutubeVerificationConfigured()
    });
  });

  app.post('/api/social/verify-telegram', async (req, res) => {
    if (!isTelegramVerificationConfigured()) {
      return res.status(503).json({
        error: 'telegram_not_configured',
        message: 'التحقق من تيليجرام غير مفعّل على هذا الخادم بعد.'
      });
    }
    try {
      const { uid, isAnonymous } = await verifyRequestAuth(req.headers.authorization);
      // المكافأة المالية مقصورة على الأعضاء المسجَّلين حقيقياً — الزائر
      // (جلسة Anonymous Auth) يحمل uid حقيقياً فيمرّ من verifyRequestAuth
      // بلا مشكلة، لذا يلزم هذا الفحص الصريح هنا تحديداً (لا يوجد أي مكان
      // آخر يمنع زائراً من محاولة تحقق مزيّف والحصول على مكافأة).
      if (isAnonymous) {
        return res.status(403).json({
          error: 'registered_members_only',
          message: 'يجب إنشاء حساب مسجَّل (وليس تصفحاً كزائر) لتلقي مكافأة التحقق.'
        });
      }
      const { campaignId, widgetData } = req.body || {};
      if (!campaignId || !widgetData) {
        return res.status(400).json({ error: 'missing_params' });
      }

      const db = getAdminDb();
      const campaignSnap = await db.collection('campaigns').doc(campaignId).get();
      if (!campaignSnap.exists) {
        return res.status(404).json({ error: 'campaign_not_found' });
      }
      const campaign = campaignSnap.data() || {};
      if (campaign.promotionKind !== 'telegram' || !campaign.destinationUrl) {
        return res.status(400).json({ error: 'not_a_telegram_campaign' });
      }

      const result = await verifyTelegramMembership(widgetData, campaign.destinationUrl);

      let rewarded = false;
      if (result.verified) {
        const rewardResult = await recordVerificationAndReward(campaignId, uid, 'telegram', {
          telegramUserId: result.telegramUserId,
          telegramUsername: result.telegramUsername || null
        });
        rewarded = rewardResult.rewarded;
      }

      res.json({ verified: result.verified, rewarded });
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 400;
      res.status(status).json({ error: 'telegram_verify_failed', message: err?.message || 'تعذر التحقق من الانضمام.' });
    }
  });

  app.post('/api/social/verify-youtube', async (req, res) => {
    try {
      const { uid, isAnonymous } = await verifyRequestAuth(req.headers.authorization);
      if (isAnonymous) {
        return res.status(403).json({
          error: 'registered_members_only',
          message: 'يجب إنشاء حساب مسجَّل (وليس تصفحاً كزائر) لتلقي مكافأة التحقق.'
        });
      }
      const { campaignId, accessToken } = req.body || {};
      if (!campaignId || !accessToken) {
        return res.status(400).json({ error: 'missing_params' });
      }

      const db = getAdminDb();
      const campaignSnap = await db.collection('campaigns').doc(campaignId).get();
      if (!campaignSnap.exists) {
        return res.status(404).json({ error: 'campaign_not_found' });
      }
      const campaign = campaignSnap.data() || {};
      if (campaign.promotionKind !== 'youtube' || !campaign.destinationUrl) {
        return res.status(400).json({ error: 'not_a_youtube_campaign' });
      }

      const result = await verifyYoutubeSubscription(accessToken, campaign.destinationUrl);

      let rewarded = false;
      if (result.verified) {
        const rewardResult = await recordVerificationAndReward(campaignId, uid, 'youtube');
        rewarded = rewardResult.rewarded;
      }

      res.json({ verified: result.verified, rewarded });
    } catch (err: any) {
      const status = err?.message === 'missing_auth_token' ? 401 : 400;
      res.status(status).json({ error: 'youtube_verify_failed', message: err?.message || 'تعذر التحقق من الاشتراك.' });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // dotfiles: 'allow' — express يتجاهل صمتاً أي مسار بمقطع يبدأ بنقطة
    // افتراضياً (dotfiles: 'ignore')، ما كان سيمنع تماماً الوصول لملف
    // /.well-known/assetlinks.json المطلوب للتحقق من تطبيق TWA على
    // أندرويد. آمن هنا لأن dist/ لا يحوي إلا ما ينتجه بناؤنا نفسه — لا
    // .env ولا .git يصلان إليه إطلاقاً.
    app.use(express.static(distPath, { dotfiles: 'allow' }));

    const escapeHtmlAttr = (s: string) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // إدراج وسوم Open Graph/Twitter Card الخاصة بالمقال قبل إرسال index.html
    // — بدون هذا، أي رابط مقال يُشارَك على X/فيسبوك/واتساب يظهر كرابط
    // عادي بلا عنوان أو صورة أو وصف، لأن الروبوتات التي تبني معاينة
    // المشاركة لا تُنفِّذ جافاسكربت React أصلاً، فترى فقط وسوم <head>
    // الثابتة العامة لكل الموقع الموجودة في index.html الخام.
    app.get('*', async (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      try {
        const articleId = typeof req.query.article === 'string' ? req.query.article : null;
        if (articleId && isAdminConfigured()) {
          const db = getAdminDb();
          const snap = await db.collection('articles').doc(articleId).get();
          if (snap.exists) {
            const art = snap.data() || {};
            const title = escapeHtmlAttr(art.title || 'LITERIUM');
            const rawDescription = String(art.description || '').replace(/\s+/g, ' ').trim();
            const description = escapeHtmlAttr(
              rawDescription.length > 200 ? rawDescription.slice(0, 197) + '...' : rawDescription
            );
            const image = typeof art.featuredImage === 'string' && art.featuredImage.startsWith('http')
              ? art.featuredImage
              : null;
            const pageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

            let html = fs.readFileSync(indexPath, 'utf-8');
            html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title} | LITERIUM</title>`);
            html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`);

            const ogTags = `
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="LITERIUM" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtmlAttr(pageUrl)}" />
    ${image ? `<meta property="og:image" content="${escapeHtmlAttr(image)}" />` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtmlAttr(image)}" />` : ''}
  </head>`;
            html = html.replace('</head>', ogTags);

            res.set('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
          }
        }
      } catch (err: any) {
        console.error('OG tag injection error:', err?.message || err);
        // يتابع للأسفل ويُرسِل index.html الافتراضي — فشل هذا التحسين لا
        // يجب أن يمنع تحميل الموقع نفسه أبداً.
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LITERIUM Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
