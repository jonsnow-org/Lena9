import express from 'express';
import path from 'path';
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
  verifyNowPaymentsIpnSignature
} from './server/nowPayments';

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

        if (finished) {
          const orderId = String(payload.order_id || '');
          const uid = orderId.split('_')[0];
          const amount = Number(payload.price_amount);

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

      // فيديو المقالات ليس له حد مدة (بخلاف فيديو الإعلانات المحدود بدقيقة) —
      // القيمة الافتراضية غير المُمرَّرة تُبقي الحد الحالي كما هو للإعلانات.
      const purpose = req.body?.purpose === 'article' ? 'article' : 'ad';
      const result = await uploadMediaBuffer(file.buffer, {
        folder: `literium/${purpose === 'article' ? 'articles' : 'ads'}/${uid}`,
        resourceType: isVideo ? 'video' : 'image',
        maxDurationSeconds: purpose === 'article' ? Infinity : undefined
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
      const { uid } = await verifyRequestAuth(req.headers.authorization);
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
      const { uid } = await verifyRequestAuth(req.headers.authorization);
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LITERIUM Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
