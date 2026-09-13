/**
 * إرسال إشعار push حقيقي (FCM) من واجهة المستخدم — غلاف رفيع فوق
 * POST /api/notifications/push (انظر server/pushNotifications.ts). دائماً
 * مرافق لإشعار الجرس الداخلي الحالي (createNotificationInFirestore) وليس
 * بديلاً عنه، وفشله لا يجب أن يوقف أي فعل أساسي في الواجهة — نفس فلسفة
 * تلك الدالة تماماً (console.error فقط، بلا throw).
 */
import { auth } from '../firebase';

export type PushCategory = 'messages' | 'follows' | 'replies';

export function sendPushNotification(
  targetUserId: string,
  category: PushCategory,
  title: string,
  body: string,
  data?: Record<string, string>
): void {
  void (async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId, category, title, body, data })
      });
    } catch (error) {
      console.error('تعذر إرسال إشعار push:', error);
    }
  })();
}
