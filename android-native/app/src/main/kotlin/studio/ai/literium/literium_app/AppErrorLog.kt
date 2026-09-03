package studio.ai.literium.literium_app

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Serializable
data class LoggedError(
    val time: String,
    val source: String,
    val message: String,
    val stack: String
)

/**
 * سجل أخطاء دائم يجمع كل أخطاء التطبيق — القاتلة (عبر [LiteriumApplication])
 * وغير القاتلة (استثناءات مُلتقَطة يدوياً في نقاط الشبكة/المستودعات) — في
 * مكان واحد، بصيغة نص جاهز للنسخ مباشرة. يحل هذا مشكلة شاشة العطل الوحيدة
 * ([CrashReportActivity]) التي تعرض عطلاً واحداً فقط ولا تُبقي أثراً بعد
 * إغلاقها: هنا يبقى آخر 50 خطأ محفوظاً عبر SharedPreferences حتى بعد إغلاق
 * التطبيق وإعادة فتحه، فيمكن للمستخدم فتح "سجل الأخطاء" في أي وقت لاحق
 * ونسخ التقرير كاملاً بدل الحاجة لالتقاط لقطة شاشة لحظة حدوث كل خطأ.
 */
object AppErrorLog {
    private const val PREFS = "literium_error_log"
    private const val KEY_ENTRIES = "entries"
    private const val MAX_ENTRIES = 50
    private const val MAX_STACK_CHARS = 4000

    private val json = Json { ignoreUnknownKeys = true }
    private val timeFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)

    @Synchronized
    fun record(context: Context, source: String, throwable: Throwable) {
        try {
            val writer = StringWriter()
            throwable.printStackTrace(PrintWriter(writer))
            val entry = LoggedError(
                time = timeFormat.format(Date()),
                source = source,
                message = throwable.message ?: throwable.javaClass.simpleName,
                stack = writer.toString().take(MAX_STACK_CHARS)
            )
            val updated = readAll(context).toMutableList()
            updated.add(0, entry)
            while (updated.size > MAX_ENTRIES) updated.removeAt(updated.lastIndex)
            writeAll(context, updated)
        } catch (_: Throwable) {
            // تسجيل الخطأ نفسه يجب ألا يُسبّب خطأ آخر أبداً — فشل صامت هنا فقط.
        }
    }

    fun record(context: Context, source: String, message: String) {
        record(context, source, RuntimeException(message))
    }

    fun getAll(context: Context): List<LoggedError> = readAll(context)

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    /** نص جاهز للنسخ مباشرة: معلومات الجهاز/الإصدار ثم كل الأخطاء الأحدث أولاً. */
    fun buildReportText(context: Context): String {
        val entries = readAll(context)
        if (entries.isEmpty()) return "لا توجد أخطاء مسجَّلة حالياً."

        val versionLabel = try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            "${info.versionName} (${info.longVersionCode})"
        } catch (_: Throwable) {
            "غير معروف"
        }

        val header = buildString {
            appendLine("تقرير أخطاء تطبيق ليتيريوم — ${entries.size} خطأ مسجَّل")
            appendLine("إصدار التطبيق: $versionLabel")
            appendLine("جهاز: ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL} — Android ${android.os.Build.VERSION.RELEASE}")
            append("=".repeat(40))
        }
        val body = entries.joinToString(separator = "\n\n${"-".repeat(40)}\n\n") { e ->
            "الوقت: ${e.time}\nالمصدر: ${e.source}\nالرسالة: ${e.message}\n\n${e.stack}"
        }
        return "$header\n\n$body"
    }

    private fun readAll(context: Context): List<LoggedError> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ENTRIES, null)
            ?: return emptyList()
        return try {
            json.decodeFromString<List<LoggedError>>(raw)
        } catch (_: Throwable) {
            emptyList()
        }
    }

    private fun writeAll(context: Context, entries: List<LoggedError>) {
        val raw = json.encodeToString(entries)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_ENTRIES, raw).apply()
    }
}
