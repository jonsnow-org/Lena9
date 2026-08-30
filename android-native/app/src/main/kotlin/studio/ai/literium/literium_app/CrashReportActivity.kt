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
import java.io.PrintWriter
import java.io.StringWriter

/** شاشة تشخيص تُعرض بدل الانهيار الصامت — نصّها قابل للتحديد والنسخ. */
class CrashReportActivity : Activity() {

    companion object {
        private const val EXTRA_TRACE = "crash_trace"

        fun launch(context: Context, throwable: Throwable) {
            val writer = StringWriter()
            throwable.printStackTrace(PrintWriter(writer))
            val intent = Intent(context, CrashReportActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                putExtra(EXTRA_TRACE, writer.toString())
            }
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val trace = intent.getStringExtra(EXTRA_TRACE) ?: "لا يوجد نص عطل متاح"

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 96, 32, 32)
        }

        root.addView(TextView(this).apply {
            text = "حدث عطل — الرجاء نسخ النص أدناه وإرساله"
            textSize = 18f
            setPadding(0, 0, 0, 24)
        })

        root.addView(Button(this).apply {
            text = "نسخ نص العطل"
            setOnClickListener {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("crash", trace))
                Toast.makeText(this@CrashReportActivity, "تم النسخ", Toast.LENGTH_SHORT).show()
            }
        })

        root.addView(Button(this).apply {
            text = "إغلاق"
            setOnClickListener { finishAndRemoveTask() }
        })

        root.addView(TextView(this).apply {
            text = trace
            setTextIsSelectable(true)
            setPadding(0, 24, 0, 0)
        })

        setContentView(ScrollView(this).apply { addView(root) })
    }
}
