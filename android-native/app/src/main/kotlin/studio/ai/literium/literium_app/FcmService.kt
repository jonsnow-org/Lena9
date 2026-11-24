package studio.ai.literium.literium_app

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlin.random.Random

/**
 * القشرة الأصيلة لا تملك أي جلسة Firebase Auth خاصة بها (كل تسجيل الدخول
 * يحدث داخل جافاسكربت الموقع نفسه في WebView) — لذا هذه الخدمة لا "تعرف"
 * أي مستخدم مسجَّل الدخول إطلاقاً. دورها الوحيد: (أ) تمرير أي رمز جهاز جديد
 * إلى MainActivity لجسره لصفحة الموقع عبر window.__literiumFcmToken، حيث
 * كود الموقع (الذي يملك سياق المصادقة الحقيقي) يحفظه في مستند المستخدم؛
 * و(ب) عرض إشعار نظام حقيقي عند وصول push فعلي والتطبيق في الخلفية أو مغلق
 * تماماً (حين لا توجد صفحة ويب حيّة لعرض أي شيء داخلها أصلاً).
 */
class FcmService : FirebaseMessagingService() {

    companion object {
        private const val CHANNEL_ID = "literium_default"

        /** يُسجَّله MainActivity طالما هو في المقدمة، ليستقبل أي رمز مُجدَّد
         *  فوراً ويجسره لصفحة الموقع الحيّة بلا حاجة لإعادة تحميلها. */
        var foregroundTokenListener: ((String) -> Unit)? = null
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        foregroundTokenListener?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        // إن كان MainActivity في المقدمة فعلاً، الأولى ترك صفحة الموقع نفسها
        // تُظهر أي إشعار داخل واجهتها (جرس 🔔) بدل ازدواج إشعار نظام فوقها
        // بلا داعٍ بينما المستخدم ينظر للتطبيق أصلاً.
        if (foregroundTokenListener != null) return

        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"] ?: ""
        val url = message.data["url"]

        val launchIntent = if (!url.isNullOrBlank()) {
            Intent(Intent.ACTION_VIEW, Uri.parse(url))
        } else {
            packageManager.getLaunchIntentForPackage(packageName) ?: Intent(this, MainActivity::class.java)
        }
        launchIntent.setPackage(packageName)
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

        val pendingIntent = PendingIntent.getActivity(
            this,
            Random.nextInt(),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(android.graphics.Color.parseColor("#0D9488"))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(Random.nextInt(), notification)
        } catch (_: SecurityException) {
            // المستخدم رفض إذن الإشعارات (POST_NOTIFICATIONS، أندرويد 13+) — لا يوجد
            // ما يُفعل هنا سوى تجاهل هذا الـpush بصمت، تماماً كأي تطبيق آخر يحترم
            // رفض المستخدم الصريح لهذا الإذن.
        }
    }
}
