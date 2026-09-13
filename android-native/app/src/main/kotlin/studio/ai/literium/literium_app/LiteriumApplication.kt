package studio.ai.literium.literium_app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.ktx.Firebase
import com.google.firebase.ktx.initialize

/**
 * معالج عطل مبكر — نفس فلسفة CrashHandlerApplication في flutter_app القديم:
 * يُثبَّت في أبكر نقطة ممكنة (attachBaseContext، قبل حتى ContentProvider
 * الخاص بـFirebase) لالتقاط أي عطل إقلاع فوري، ضروري لأن المستخدم لا يملك
 * حاسوباً/ADB لقراءة سجل عطل مباشرة من الجهاز. Crashlytics نفسه لا يكفي
 * وحده كما أثبتت التجربة السابقة (لم يستقبل تقارير عطل الإقلاع الفوري عبر
 * عدة محاولات فعلية)، فهذا معالج مستقل احتياطي يعرض النص مباشرة على الشاشة.
 */
class LiteriumApplication : Application() {

    companion object {
        /** Context عام لأماكن غير-Compose (مثل [studio.ai.literium.literium_app.data.remote.NetworkModule]'s
         *  interceptor) تحتاج تسجيل خطأ في [AppErrorLog] بلا تمرير Context عبر كل استدعاء. آمن طوال
         *  عمر العملية — Application لا يُجمَّع (GC) حتى تنتهي العملية بالكامل. */
        lateinit var instance: LiteriumApplication
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        Firebase.initialize(this)
        createNotificationChannel()

        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                AppErrorLog.record(applicationContext, "عطل قاتل (تطبيق)", throwable)
                FirebaseCrashlytics.getInstance().recordException(throwable)
                CrashReportActivity.launch(applicationContext, throwable)
            } catch (_: Throwable) {
                // إن فشل عرض شاشة العطل نفسها، لا داعٍ لإخفاء أي شيء إضافي هنا.
            } finally {
                defaultHandler?.uncaughtException(thread, throwable)
                android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
    }

    // القناة (channel) شرط إلزامي لعرض أي إشعار على أندرويد 8+ (API 26+) —
    // يجب إنشاؤها مرة واحدة قبل أول notify()، ومعرّفها (CHANNEL_ID) في
    // FcmService.kt يجب أن يطابق هذا تماماً.
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "literium_default",
            "إشعارات ليتيريوم",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "رسائل، متابعات، ردود، وتحديثات ليتيريوم"
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(channel)
    }
}
