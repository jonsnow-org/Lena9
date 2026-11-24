package studio.ai.literium.literium_app.ui.diagnostics

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.AppErrorLog
import kotlin.math.max
import kotlin.math.min

/**
 * سجل تلقائي لعيوب واجهة الاستخدام الدقيقة التي لا تُسبّب عطلاً ولا فشل شبكة (ولذلك لا يلتقطها
 * [AppErrorLog] العادي عبر `Thread.setDefaultUncaughtExceptionHandler`/OkHttp interceptor) —
 * تكسّر نص زر لأنه أضيق مما يحتاج، أيقونة بلا تباين لون كافٍ تبدو "بلا لون"، أو منطقة لمس أصغر من
 * الحد المعقول. نشأ هذا مباشرة من عطل حقيقي رآه مستخدم (زر "تحديث" تكسّر حرفاً حرفاً: "تح"/"دي"/"ث")
 * لم يكن مسجَّلاً في أي مكان — كل ما هنا يكتب إلى نفس [AppErrorLog] (نفس شاشة "سجل الأخطاء"، نفس زر
 * "نسخ التقرير كاملاً") حتى يظهر مع بقية الأعطال في تقرير واحد جاهز للنسخ.
 *
 * غير مفعّل على نطاق التطبيق كله دفعة واحدة عمداً — كل استدعاء صريح ومحلي (composable/modifier في
 * موقع استخدام واحد)، بلا أي مسح شامل تلقائي للشجرة الكاملة (Compose لا يوفر ذلك بأمان دون كسر
 * الأداء). أُضيف أولاً للوحة تحكم الأدمن (أعلى كثافة أعطال مُبلَّغة هذه الجلسة)، وقابل للتوسيع لأي
 * شاشة أخرى بنفس الاستدعاءات الثلاثة أدناه.
 */
private const val SOURCE = "تشخيص واجهة"

/** الحد الأدنى المعقول لمنطقة لمس تفاعلية — أقل من إرشاد Material الرسمي (48.dp) عمداً بقليل
 *  لتفادي إنذارات كاذبة على عناصر مضغوطة مقصودة (كشرائح الفلترة)، مع كونه لا يزال يلتقط الانكماش
 *  الحقيقي الذي يُنتج تكسّر النص. */
private val MIN_TOUCH_TARGET = 40.dp

/** أدنى نسبة تباين مقبولة بين لون المحتوى (نص/أيقونة) وخلفيته المباشرة — أقل بكثير من عتبة WCAG AA
 *  الرسمية (4.5) عمداً: هذا ليس فحص إتاحة صارماً، بل كاشف حالة "بلا لون إطلاقاً" تحديداً (نص شبه
 *  مطابق للخلفية) التي أبلغ عنها المستخدم حرفياً. */
private const val MIN_CONTRAST_RATIO = 1.6

/**
 * يُمرَّر إلى `Text(..., onTextLayout = { reportTextOverflow(context, "شاشة/عنصر", it) })` — يسجّل
 * فقط عندما يقتصّ Compose النص فعلياً (`hasVisualOverflow`)، وهو بالضبط ما يحدث عند تكسّر كلمة
 * حرفاً-حرفاً داخل عرض أضيق من محتواها.
 */
@Composable
fun rememberOverflowReporter(tag: String): (TextLayoutResult) -> Unit {
    val context = LocalContext.current
    // onTextLayout يُستدعى في كل تخطيط نص (كل إعادة تركيب تقريباً) — بلا هذا الحارس سيُغرق سجل
    // الأخطاء بعشرات الإدخالات المتطابقة أثناء التمرير بدل تسجيل مرة واحدة فعلاً مفيدة.
    var alreadyReported by remember(tag) { mutableStateOf(false) }
    return remember(tag) {
        { result: TextLayoutResult ->
            if (result.hasVisualOverflow && !alreadyReported) {
                alreadyReported = true
                AppErrorLog.record(
                    context,
                    SOURCE,
                    "نص متجاوز/مقتصّ في \"$tag\" — العرض المتاح أضيق من محتوى النص (سطور: ${result.lineCount})."
                )
            }
        }
    }
}

/**
 * `Modifier.diagnoseTouchTarget("زر التحديث")` على أي عنصر تفاعلي (زر، IconButton، Surface قابل
 * للنقر) — يقيس حجمه الفعلي بعد التخطيط ويسجّل إن كان أضيق أو أقصر من [MIN_TOUCH_TARGET]، وهي غالباً
 * نتيجة مباشرة لنفس سبب تكسّر النص: عنصر مجاور استحوذ على العرض المتاح.
 */
@Composable
fun Modifier.diagnoseTouchTarget(tag: String, minSize: Dp = MIN_TOUCH_TARGET): Modifier {
    val context = LocalContext.current
    val density = LocalDensity.current
    // onGloballyPositioned يُستدعى في كل تخطيط (تمرير، إعادة تركيب...) — نفس حارس "مرة واحدة
    // فقط" الموجود في [rememberOverflowReporter] وللسبب ذاته.
    var alreadyReported by remember(tag) { mutableStateOf(false) }
    return this.then(
        Modifier.onGloballyPositioned { coords ->
            if (alreadyReported) return@onGloballyPositioned
            val widthDp = with(density) { coords.size.width.toDp() }
            val heightDp = with(density) { coords.size.height.toDp() }
            if (widthDp < minSize || heightDp < minSize) {
                alreadyReported = true
                AppErrorLog.record(
                    context,
                    SOURCE,
                    "منطقة لمس أصغر من المعقول في \"$tag\": ${widthDp.value.toInt()}×${heightDp.value.toInt()}dp " +
                        "(الحد الأدنى ${minSize.value.toInt()}dp) — على الأرجح عنصر مجاور استحوذ على العرض المتاح."
                )
            }
        }
    )
}

/**
 * `reportIfLowContrast(context, "زر التوثيق", foreground = tint, background = containerColor)` —
 * يحسب نسبة التباين بين لونين (صيغة WCAG relative-luminance المبسّطة) ويسجّل عندما تكون منخفضة جداً
 * لدرجة أن العنصر يبدو "بلا لون" عملياً (نص/أيقونة شبه مطابقة لخلفيتها المباشرة).
 */
@Composable
fun reportIfLowContrast(tag: String, foreground: Color, background: Color) {
    val context = LocalContext.current
    remember(tag, foreground, background) {
        val l1 = foreground.luminance() + 0.05f
        val l2 = background.luminance() + 0.05f
        val ratio = max(l1, l2) / min(l1, l2)
        if (ratio < MIN_CONTRAST_RATIO) {
            AppErrorLog.record(
                context,
                SOURCE,
                "تباين لون ضعيف جداً في \"$tag\" (نسبة ${"%.2f".format(ratio)}) — يبدو بلا لون فعلياً " +
                    "على خلفيته المباشرة."
            )
        }
        Unit
    }
}
