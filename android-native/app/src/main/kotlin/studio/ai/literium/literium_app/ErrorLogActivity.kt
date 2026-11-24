package studio.ai.literium.literium_app

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/**
 * عرض سجل الأخطاء الدائم ([AppErrorLog]) — بخلاف [CrashReportActivity] الذي
 * يُطلقه معالج العطل تلقائياً لعطل واحد فقط وقد يختفي بسرعة قبل قراءته
 * (العملية تُقتل فوراً بعد إطلاقه)، هذه شاشة يفتحها المستخدم يدوياً في أي
 * وقت لاحق (ضغط مطوَّل على شعار شاشة البداية — انظر MainActivity.kt) لقراءة
 * كل الأخطاء الأخيرة المخزَّنة فعلياً على الجهاز ونسخها.
 */
class ErrorLogActivity : Activity() {

    companion object {
        fun launch(context: Context) {
            val intent = Intent(context, ErrorLogActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        renderReport()
    }

    private fun renderReport() {
        val report = AppErrorLog.buildReportText(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 96, 32, 32)
        }

        root.addView(TextView(this).apply {
            text = "سجل أخطاء التطبيق"
            textSize = 18f
            setPadding(0, 0, 0, 24)
        })

        val buttonRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        buttonRow.addView(Button(this).apply {
            text = "نسخ التقرير"
            setOnClickListener {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("error_log", report))
                Toast.makeText(this@ErrorLogActivity, "تم النسخ", Toast.LENGTH_SHORT).show()
            }
        })
        buttonRow.addView(Button(this).apply {
            text = "مسح السجل"
            setOnClickListener {
                AppErrorLog.clear(this@ErrorLogActivity)
                renderReport()
            }
        })
        buttonRow.addView(Button(this).apply {
            text = "إغلاق"
            setOnClickListener { finish() }
        })
        root.addView(buttonRow)

        root.addView(TextView(this).apply {
            text = report
            setTextIsSelectable(true)
            setPadding(0, 24, 0, 0)
        })

        setContentView(ScrollView(this).apply { addView(root) })
    }
}
