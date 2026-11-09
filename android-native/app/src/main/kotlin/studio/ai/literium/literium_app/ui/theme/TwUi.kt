package studio.ai.literium.literium_app.ui.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween

/** أيقونة Lucide بحجم/لون صريحين (مثل `<Icon className="w-5 h-5 text-…" />` في الويب). */
@Composable
fun LuIcon(icon: ImageVector, size: Dp = 20.dp, tint: Color = LocalContentColor.current, modifier: Modifier = Modifier) {
    Image(
        imageVector = icon,
        contentDescription = null,
        modifier = modifier.size(size),
        colorFilter = ColorFilter.tint(tint)
    )
}

/** نقرة بلا موجة Material (الويب لا يملك ripple) مع `active:scale-N` اختيارية وانتقال 150ms. */
@Composable
fun Modifier.twClickable(
    enabled: Boolean = true,
    pressScale: Float = 1f,
    onClick: () -> Unit
): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && enabled) pressScale else 1f, tween(150), label = "press")
    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
}

fun Modifier.twBorder(width: Dp, color: Color, shape: androidx.compose.ui.graphics.Shape): Modifier =
    this.border(width, color, shape)

private const val AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"

/** `n.toLocaleString('ar-EG')` ⇒ أرقام هندية مع فاصل آلاف «٬». */
fun arNum(n: Long): String {
    val neg = n < 0
    val digits = kotlin.math.abs(n).toString()
    val grouped = digits.reversed().chunked(3).joinToString("٬").reversed()
    return (if (neg) "-" else "") + grouped.map { if (it in '0'..'9') AR_DIGITS[it - '0'] else it }.joinToString("")
}

/** تحويل أي أرقام لاتينية داخل نص إلى هندية (للتواريخ/الأوقات). */
fun arDigits(s: String): String = s.map { if (it in '0'..'9') AR_DIGITS[it - '0'] else it }.joinToString("")

// ───────────────────────── طبقة ألوان الأزرار المركزية (نظير index.css في الويب) ─────────────────────────

/** `color-mix(in oklab, a pct%, b)` — lerp في Compose يعمل في فضاء Oklab كما في CSS. */
fun mixColors(a: Color, b: Color, pctA: Float): Color =
    androidx.compose.ui.graphics.lerp(b, a, pctA)

/** نصّ/تدرّج الأزرار «المحايدة» (bg-white/slate-50/100…) كما تعيد طبقة index.css تلوينها. */
@Composable
fun neutralButtonBrush(tone: Color): androidx.compose.ui.graphics.Brush {
    val dark = LocalIsDarkTheme.current
    return if (!dark) androidx.compose.ui.graphics.Brush.verticalGradient(
        listOf(mixColors(tone, Tw.white, 0.07f), mixColors(tone, Tw.white, 0.17f))
    ) else androidx.compose.ui.graphics.Brush.verticalGradient(
        listOf(tone.copy(alpha = 0.20f), tone.copy(alpha = 0.11f))
    )
}

@Composable
fun neutralButtonRing(tone: Color): Color =
    if (LocalIsDarkTheme.current) tone.copy(alpha = 0.36f) else mixColors(tone, Tw.white, 0.30f)

@Composable
fun neutralButtonText(tone: Color): Color =
    if (LocalIsDarkTheme.current) mixColors(tone, Tw.white, 0.55f) else mixColors(tone, Tw.black, 0.78f)

/** الزر المحايد كاملاً: تدرّج + حلقة داخلية 1dp. */
@Composable
fun Modifier.neutralButton(shape: androidx.compose.ui.graphics.Shape, tone: Color = brand.s500): Modifier =
    this.background(neutralButtonBrush(tone), shape).border(1.dp, neutralButtonRing(tone), shape)

/** الأزرار الصلبة الملوّنة: لمعة بيضاء 18% → سوداء 7% فوق اللون. */
fun Modifier.solidSheen(shape: androidx.compose.ui.graphics.Shape): Modifier =
    this.background(
        androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.18f), Color.Black.copy(alpha = 0.07f))),
        shape
    )

/** هيكل التحميل `animate-pulse` (opacity 1 ↔ .5 كل ثانيتين). */
@Composable
fun pulseAlpha(): Float {
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse")
    val a by t.animateFloat(
        1f, 0.5f,
        androidx.compose.animation.core.infiniteRepeatable(
            androidx.compose.animation.core.tween(1000, easing = androidx.compose.animation.core.CubicBezierEasing(0.4f, 0f, 0.6f, 1f)),
            androidx.compose.animation.core.RepeatMode.Reverse
        ), label = "pulseA"
    )
    return a
}

/** `bg-gradient-to-tr from-X to-Y`: من أسفل-بداية-فيزيائياً (يسار) إلى أعلى-يمين. */
fun trBrush(from: Color, to: Color): androidx.compose.ui.graphics.Brush = androidx.compose.ui.graphics.Brush.linearGradient(
    listOf(from, to),
    start = androidx.compose.ui.geometry.Offset(0f, Float.POSITIVE_INFINITY),
    end = androidx.compose.ui.geometry.Offset(Float.POSITIVE_INFINITY, 0f)
)
