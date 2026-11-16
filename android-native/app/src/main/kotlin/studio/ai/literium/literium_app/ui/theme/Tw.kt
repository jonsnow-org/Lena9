package studio.ai.literium.literium_app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.colorspace.ColorSpaces
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import studio.ai.literium.literium_app.R
import kotlin.math.cos
import kotlin.math.sin

/**
 * رموز التصميم المطابقة لـ Tailwind في الويب (نفس الأسماء: slate/brand/rose/amber…) كي تُترجَم أصناف
 * الويب سطراً بسطر: `bg-slate-100` ⇐ `Tw.slate100`، `text-brand-700` ⇐ `brand.s700`.
 * ألوان brand تتبع قالب الأدمن الحي (LocalBrand) تماماً كمتغيرات --color-brand-* في الويب.
 */

/** oklch(L% C H) → Color عبر فضاء Oklab (نفس تحويل CSS Color 4 الذي يستخدمه المتصفح). */
fun oklch(lPercent: Float, c: Float, hDeg: Float, alpha: Float = 1f): Color {
    val h = Math.toRadians(hDeg.toDouble())
    return Color(
        (lPercent / 100f),
        (c * cos(h)).toFloat(),
        (c * sin(h)).toFloat(),
        alpha,
        ColorSpaces.Oklab
    ).convert(ColorSpaces.Srgb)
}

object Tw {
    val white = Color(0xFFFFFFFF)
    val black = Color(0xFF000000)

    val slate50 = Color(0xFFF8FAFC)
    val slate100 = Color(0xFFF1F5F9)
    val slate200 = Color(0xFFE2E8F0)
    val slate300 = Color(0xFFCBD5E1)
    val slate400 = Color(0xFF94A3B8)
    val slate500 = Color(0xFF64748B)
    val slate600 = Color(0xFF475569)
    val slate700 = Color(0xFF334155)
    val slate800 = Color(0xFF1E293B)
    val slate900 = Color(0xFF0F172A)
    val slate950 = Color(0xFF020617)

    val rose50 = Color(0xFFFFF1F2)
    val rose100 = Color(0xFFFFE4E6)
    val rose200 = Color(0xFFFECDD3)
    val rose300 = Color(0xFFFDA4AF)
    val rose400 = Color(0xFFFB7185)
    val rose500 = Color(0xFFF43F5E)
    val rose600 = Color(0xFFE11D48)
    val rose700 = Color(0xFFBE123C)

    val amber50 = Color(0xFFFFFBEB)
    val amber100 = Color(0xFFFEF3C7)
    val amber200 = Color(0xFFFDE68A)
    val amber300 = Color(0xFFFCD34D)
    val amber400 = Color(0xFFFBBF24)
    val amber500 = Color(0xFFF59E0B)
    val amber600 = Color(0xFFD97706)
    val amber700 = Color(0xFFB45309)

    val emerald50 = Color(0xFFECFDF5)
    val emerald100 = Color(0xFFD1FAE5)
    val emerald200 = Color(0xFFA7F3D0)
    val emerald300 = Color(0xFF6EE7B7)
    val emerald400 = Color(0xFF34D399)
    val emerald500 = Color(0xFF10B981)
    val emerald600 = Color(0xFF059669)
    val emerald700 = Color(0xFF047857)
    val emerald800 = Color(0xFF065F46)
    val emerald950 = Color(0xFF022C22)

    val cyan50 = Color(0xFFECFEFF)
    val cyan300 = Color(0xFF67E8F9)
    val cyan600 = Color(0xFF0891B2)
    val cyan700 = Color(0xFF0E7490)

    val sky50 = Color(0xFFF0F9FF)
    val sky100 = Color(0xFFE0F2FE)
    val sky200 = Color(0xFFBAE6FD)
    val sky500 = Color(0xFF0EA5E9)
    val sky600 = Color(0xFF0284C7)
    val sky700 = Color(0xFF0369A1)

    val blue50 = Color(0xFFEFF6FF)
    val blue500 = Color(0xFF3B82F6)
    val blue600 = Color(0xFF2563EB)

    val teal300 = Color(0xFF5EEAD4)
    val teal600 = Color(0xFF0D9488)
    val teal700 = Color(0xFF0F766E)
}

/** درجات brand-* الحيّة (تتبع قالب الأدمن). الاسم s50..s950 يقابل brand-50..brand-950 في الويب. */
class BrandScale(
    val s50: Color, val s100: Color, val s200: Color, val s300: Color, val s400: Color,
    val s500: Color, val s600: Color, val s700: Color, val s800: Color, val s900: Color, val s950: Color
)

fun ThemeShadeScale.toBrand() = BrandScale(
    shade50, shade100, shade200, shade300, shade400, shade500, shade600, shade700, shade800, shade900, shade950
)

val LocalBrand = compositionLocalOf { THEME_PRESETS.getValue(DEFAULT_THEME_PRESET).shades.toBrand() }

/** اختصار: `brand.s600` داخل أي Composable. */
val brand: BrandScale
    @Composable @ReadOnlyComposable get() = LocalBrand.current

/** وضع داكن؟ (نفس صنف `.dark` في الويب). */
val isDark: Boolean
    @Composable @ReadOnlyComposable get() = LocalIsDarkTheme.current

/** يختار قيمة بحسب الوضع: `pick(light = Tw.slate100, dark = Tw.slate900)` ⇐ `bg-slate-100 dark:bg-slate-900`. */
@Composable
@ReadOnlyComposable
fun <T> pick(light: T, dark: T): T = if (LocalIsDarkTheme.current) dark else light

/** خط Cairo (خط الموقع) بكل أوزانه عبر الخط المتغيّر. */
@OptIn(ExperimentalTextApi::class)
val CairoFamily = FontFamily(
    listOf(400, 500, 600, 700, 800, 900).map { w ->
        Font(
            R.font.cairo_var,
            weight = FontWeight(w),
            variationSettings = FontVariation.Settings(FontVariation.weight(w))
        )
    }
)
