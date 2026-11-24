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

        // ⚠️ Start.io عمداً غير مُهيَّأ هنا — كان يُهيَّأ سابقاً عند كل إقلاع بلا شرط، وهذا بالضبط
        // ما جعل شاشة موافقة الخصوصية الخاصة بـStart.io نفسها تظهر تلقائياً لكل مستخدم عند فتح
        // التطبيق، بمعزل تام عن مفتاح التفعيل الإداري (الذي لا يتحكم إلا بعرض الـBanner، لا بتهيئة
        // الـSDK نفسه). التهيئة انتقلت لتكون كسولة تماماً — StartIoAds.ensureInitialized(context)
        // تُستدعى فقط داخل StartIoBannerView لحظة تركيب بانر حقيقي فعلاً، وهذا المسار نفسه لا
        // يُركَّب إطلاقاً إلا حين يكون startIo مفعَّلاً من لوحة التحكم وفاز فعلاً بدور التدوير — فما لم
        // يُفعِّله الأدمن صراحة، الـSDK بأكمله (تهيئة، شاشة موافقة، أي جمع بيانات) لا يعمل مطلقاً.

        // ⚠️ عمداً لا تُعرَض أي شاشة عطل تلقائية على المستخدم (كانت CrashReportActivity —
        // أُزيلت بالكامل): تسبّبت بومضة نص عطل خام + زر نسخ لجزء من الثانية على شاشة مستخدم حقيقي،
        // وهذا غير مقبول إطلاقاً على تطبيق حي. التسجيل الصامت (محلي عبر AppErrorLog، وعن بُعد عبر
        // Crashlytics) كافٍ تماماً للتشخيص، ويبقى الأخير قابلاً للاطلاع عليه لاحقاً من داخل التطبيق
        // نفسه عبر ErrorLogActivity (شاشة يفتحها المستخدم عمداً من الإعدادات، لا تُفرَض عليه أبداً).
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                AppErrorLog.record(applicationContext, "عطل قاتل (تطبيق)", throwable)
                FirebaseCrashlytics.getInstance().recordException(throwable)
            } catch (_: Throwable) {
                // فشل التسجيل نفسه يجب ألا يمنع تسليم العطل لمعالج النظام أدناه.
            } finally {
                defaultHandler?.uncaughtException(thread, throwable)
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
