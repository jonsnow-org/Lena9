package studio.ai.literium.literium_app

import android.app.Application
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

    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(this)

        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
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
}
