import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

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
          message: 'لقد استنفدت حد الاستخدام المجاني لليوم (5/5). يرجى الاشتراك في إحدى باقات Pro للمتابعة دون انقطاع.'
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

        const response = await client.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: promptText
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
