/**
 * إرسال إشعارات Push حقيقية (Firebase Cloud Messaging) — تصل للمستخدم حتى
 * والتطبيق الأصيل مغلق تماماً، بخلاف نظام الإشعارات الداخلي القديم
 * (createNotificationInFirestore في firestoreService.ts) الذي يظهر فقط
 * داخل جرس 🔔 أثناء استخدام الموقع فعلياً.
 *
 * يعتمد على Firebase Admin SDK نفسه المُهيَّأ أصلاً في firebaseAdmin.ts —
 * لا حاجة لأي إعداد Firebase إضافي (نفس مشروع Firebase المستخدم للمصادقة/
 * قاعدة البيانات فيه Cloud Messaging مفعّلاً تلقائياً).
 */
import { getMessaging } from 'firebase-admin/messaging';
import { getAdminDb, isAdminConfigured, FieldValue } from './firebaseAdmin';

export type NotificationCategory = 'messages' | 'follows' | 'replies' | 'promotional';

export interface PushResult {
  sent: number;
  pruned: number;
  skippedReason?: 'muted' | 'no_tokens' | 'user_not_found' | 'not_configured';
}

/**
 * يرسل push فعلياً لكل أجهزة مستخدم واحد، محترماً تفضيلات الإشعارات
 * (notificationPrefs) — mutedAll يوقف كل شيء، وكل فئة (messages/follows/
 * replies/promotional) قابلة للإيقاف منفردة. undefined يُعامَل كـtrue
 * (الحقل لم يُضبط بعد = لم يُعطَّل صراحة).
 */
export async function sendPushToUser(
  targetUserId: string,
  category: NotificationCategory,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<PushResult> {
  if (!isAdminConfigured()) {
    return { sent: 0, pruned: 0, skippedReason: 'not_configured' };
  }

  const db = getAdminDb();
  const userRef = db.collection('users').doc(targetUserId);
  const snap = await userRef.get();
  if (!snap.exists) {
    return { sent: 0, pruned: 0, skippedReason: 'user_not_found' };
  }

  const user = snap.data() || {};
  const prefs = user.notificationPrefs || {};
  if (prefs.mutedAll === true || prefs[category] === false) {
    return { sent: 0, pruned: 0, skippedReason: 'muted' };
  }

  const tokens: string[] = Array.isArray(user.fcmTokens)
    ? user.fcmTokens.filter((t: unknown) => typeof t === 'string' && t.trim())
    : [];
  if (tokens.length === 0) {
    return { sent: 0, pruned: 0, skippedReason: 'no_tokens' };
  }

  const response = await getMessaging().sendEachForMulticast({
    notification: { title, body },
    data: data || {},
    tokens,
    android: { priority: 'high' }
  });

  // رموز انتهت صلاحيتها (إلغاء تثبيت التطبيق، مسح بيانات المتصفح...) —
  // تُزال هنا فوراً بدل تراكمها وإبطاء كل إرسال لاحق لنفس المستخدم بلا فائدة.
  const invalidTokens: string[] = [];
  response.responses.forEach((r, idx) => {
    if (!r.success) {
      const code = r.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-argument') ||
        code.includes('invalid-registration-token')
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });
  if (invalidTokens.length > 0) {
    await userRef.update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) });
  }

  return { sent: response.successCount, pruned: invalidTokens.length };
}
