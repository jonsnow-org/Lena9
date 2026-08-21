/**
 * تحقق حقيقي (وليس مجرد نقرة) من انضمام/اشتراك القارئ في قناة المعلن،
 * لمنصتين فقط تسمحان تقنياً بذلك مجاناً لتطبيق صغير مستقل:
 *
 * - تيليجرام: عبر Telegram Bot API (getChatMember)، ويتطلب من صاحب
 *   المنصة إنشاء بوت تيليجرام وإضافته "أدمن" في قناة كل معلن.
 * - يوتيوب: عبر YouTube Data API v3 (subscriptions.list) باستخدام رمز
 *   OAuth يمنحه القارئ نفسه (Google Identity Services من المتصفح) —
 *   يتطلب مشروع Google Cloud مجاني و Client ID مُعدّ للتطبيق.
 *
 * انستغرام وتويتر/X وفيسبوك: لا تقدّم أي منها واجهة برمجية مجانية
 * تسمح لتطبيق خارجي صغير بالتحقق من "هل تابع المستخدم فلان؟" — إما
 * مدفوعة بالكامل (X)، أو تتطلب مراجعة أعمال معقدة نادراً ما تُمنح
 * لتطبيق فردي (فيسبوك/انستغرام عبر Meta App Review). لذلك تبقى هذه
 * المنصات على تتبّع النقرة الصادقة فقط دون ادّعاء تحقق وهمي.
 */
import { createHash, createHmac } from 'crypto';
import { getAdminDb, FieldValue } from './firebaseAdmin';
import { SOCIAL_VERIFIED_ACTION_REWARD_USD } from '../src/constants/socialPromoRewards';

/**
 * يسجّل التحقق الفعلي، ويكافئ القارئ بمبلغ صغير حقيقي (SOCIAL_VERIFIED_
 * ACTION_REWARD_USD) من ميزانية الحملة نفسها — مرة واحدة فقط لكل
 * (حملة + قارئ)، ومقيّد تماماً بما تبقّى من ميزانية المعلن. تُنفَّذ
 * القراءة والكتابة معاً ضمن معاملة Firestore واحدة لمنع أي سباق يسمح
 * بمكافأة مزدوجة من نقرتين متزامنتين على زر "تحقق".
 */
export async function recordVerificationAndReward(
  campaignId: string,
  viewerId: string,
  platform: 'telegram' | 'youtube',
  extraFields: Record<string, any> = {}
): Promise<{ rewarded: boolean; rewardAmount: number }> {
  const db = getAdminDb();
  const verificationRef = db.collection('socialVerifications').doc(`${campaignId}_${viewerId}`);
  const campaignRef = db.collection('campaigns').doc(campaignId);
  const userRef = db.collection('users').doc(viewerId);

  let rewarded = false;

  await db.runTransaction(async (tx) => {
    const verSnap = await tx.get(verificationRef);
    if (verSnap.exists) {
      // تحقّق مسجَّل مسبقاً لنفس القارئ ونفس الحملة — لا مكافأة مكرّرة،
      // نعيد فقط ما حدث فعلاً في المرة الأولى.
      rewarded = Boolean(verSnap.data()?.rewarded);
      return;
    }

    const campSnap = await tx.get(campaignRef);
    const campData = campSnap.exists ? campSnap.data() || {} : {};
    const remaining = Number(campData.totalBudget || 0) - Number(campData.totalSpent || 0);
    rewarded = remaining >= SOCIAL_VERIFIED_ACTION_REWARD_USD;

    tx.set(verificationRef, {
      campaignId,
      viewerId,
      platform,
      verifiedAt: new Date().toISOString(),
      rewarded,
      rewardAmount: rewarded ? SOCIAL_VERIFIED_ACTION_REWARD_USD : 0,
      ...extraFields
    });

    if (rewarded) {
      tx.update(campaignRef, {
        totalSpent: FieldValue.increment(SOCIAL_VERIFIED_ACTION_REWARD_USD),
        verifiedActionsCount: FieldValue.increment(1)
      });
      // نفس حقل pendingEarnings الذي تمر منه كل أرباح الإعلانات الأخرى —
      // نفس فترة التجميد (30 يوماً) ونفس مراجعة الأدمن قبل السحب، بلا
      // أي مسار مختصر جديد للمال.
      tx.update(userRef, {
        pendingEarnings: FieldValue.increment(SOCIAL_VERIFIED_ACTION_REWARD_USD)
      });
    }
  });

  return { rewarded, rewardAmount: rewarded ? SOCIAL_VERIFIED_ACTION_REWARD_USD : 0 };
}

export function isTelegramVerificationConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function isYoutubeVerificationConfigured(): boolean {
  // لا تحتاج مفتاح خادم منفصل — التحقق يستخدم رمز OAuth الذي يجلبه
  // المتصفح مباشرة من Google. هذه الدالة موجودة للاتساق مع بقية
  // الميزات الاختيارية، وتعتمد على وجود Client ID في جهة العميل
  // (VITE_GOOGLE_OAUTH_CLIENT_ID)، لذا تُعتبر "متاحة" دوماً من جهة
  // الخادم ولا تحتاج فحصاً هنا.
  return true;
}

interface TelegramWidgetData {
  id: number;
  first_name?: string;
  username?: string;
  auth_date: number;
  hash: string;
  [key: string]: any;
}

/**
 * يتحقق من صحة توقيع بيانات Telegram Login Widget (HMAC-SHA256 بمفتاح
 * مشتق من توكن البوت نفسه) — يمنع انتحال هوية مستخدم تيليجرام آخر.
 */
function verifyTelegramWidgetSignature(data: TelegramWidgetData, botToken: string): boolean {
  const { hash, ...rest } = data;
  const checkString = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== null)
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');

  const secretKey = createHash('sha256').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (computedHash !== hash) return false;

  // منع إعادة استخدام بيانات تسجيل قديمة (صلاحية يوم واحد)
  const ageSeconds = Date.now() / 1000 - data.auth_date;
  if (ageSeconds > 24 * 60 * 60) return false;

  return true;
}

function extractTelegramChannelHandle(url: string): string | null {
  try {
    const clean = url.trim();
    const m = clean.match(/t(?:elegram)?\.me\/(?:s\/)?([A-Za-z0-9_]{4,})/i) || clean.match(/^@?([A-Za-z0-9_]{4,})$/);
    return m ? `@${m[1].replace(/^@/, '')}` : null;
  } catch {
    return null;
  }
}

/**
 * يتحقق من عضوية حقيقية في قناة تيليجرام عبر Bot API.
 * يرمي استثناء بسبب واضح عند أي فشل (توكن غير مضبوط، رابط قناة غير
 * صالح، البوت ليس عضواً/أدمن في القناة، أو المستخدم فعلاً غير مشترك).
 */
export async function verifyTelegramMembership(
  widgetData: TelegramWidgetData,
  channelUrl: string
): Promise<{ verified: boolean; telegramUserId: number; telegramUsername?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('telegram_not_configured');

  if (!verifyTelegramWidgetSignature(widgetData, botToken)) {
    throw new Error('invalid_telegram_signature');
  }

  const handle = extractTelegramChannelHandle(channelUrl);
  if (!handle) throw new Error('invalid_channel_url');

  const apiUrl = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(
    handle
  )}&user_id=${widgetData.id}`;

  const res = await fetch(apiUrl);
  const body = await res.json();

  if (!body.ok) {
    // غالباً يعني أن البوت ليس عضواً/أدمن في القناة، أو القناة غير موجودة
    throw new Error(body.description || 'telegram_check_failed');
  }

  const status = body.result?.status as string;
  const verified = ['creator', 'administrator', 'member'].includes(status);

  return { verified, telegramUserId: widgetData.id, telegramUsername: widgetData.username };
}

function extractYoutubeChannelRef(url: string): { type: 'id' | 'handle'; value: string } | null {
  const clean = url.trim();
  let m = clean.match(/youtube\.com\/channel\/([A-Za-z0-9_-]{10,})/);
  if (m) return { type: 'id', value: m[1] };
  m = clean.match(/youtube\.com\/@([A-Za-z0-9_.-]{2,})/) || clean.match(/^@([A-Za-z0-9_.-]{2,})$/);
  if (m) return { type: 'handle', value: `@${m[1]}` };
  return null;
}

async function resolveYoutubeChannelId(ref: { type: 'id' | 'handle'; value: string }, accessToken: string): Promise<string | null> {
  if (ref.type === 'id') return ref.value;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(ref.value)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const body = await res.json();
  return body.items?.[0]?.id || null;
}

/**
 * يتحقق من اشتراك حقيقي في قناة يوتيوب عبر YouTube Data API v3،
 * باستخدام رمز OAuth الذي يمنحه القارئ نفسه من متصفحه (نطاق
 * youtube.readonly) — الخادم لا يخزّن الرمز ولا يستخدمه إلا لهذا
 * الفحص اللحظي.
 */
export async function verifyYoutubeSubscription(
  accessToken: string,
  channelUrl: string
): Promise<{ verified: boolean }> {
  if (!accessToken) throw new Error('missing_access_token');

  const ref = extractYoutubeChannelRef(channelUrl);
  if (!ref) throw new Error('invalid_channel_url');

  const channelId = await resolveYoutubeChannelId(ref, accessToken);
  if (!channelId) throw new Error('channel_not_found');

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/subscriptions?part=id&forChannelId=${encodeURIComponent(channelId)}&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (res.status === 401) throw new Error('invalid_or_expired_token');
  const body = await res.json();
  if (body.error) throw new Error(body.error?.message || 'youtube_check_failed');

  return { verified: Array.isArray(body.items) && body.items.length > 0 };
}
