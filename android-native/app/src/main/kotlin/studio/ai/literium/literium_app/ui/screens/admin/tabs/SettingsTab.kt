package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.RevenueShares

private data class ThemePresetOption(val key: String, val label: String, val hex: String)

/** Ported verbatim from `src/constants/themePresets.ts` — 11 presets, purple is default. */
private val THEME_PRESETS = listOf(
    ThemePresetOption("purple", "بنفسجي (افتراضي)", "#9333ea"),
    ThemePresetOption("red", "أحمر", "#dc2626"),
    ThemePresetOption("amber", "أصفر ذهبي", "#d97706"),
    ThemePresetOption("green", "أخضر", "#16a34a"),
    ThemePresetOption("blue", "أزرق", "#2563eb"),
    ThemePresetOption("cyan", "سماوي", "#0891b2"),
    ThemePresetOption("rose", "وردي", "#e11d48"),
    ThemePresetOption("gold", "ذهبي", "#c8952a"),
    ThemePresetOption("silver", "فضي", "#6b7c93"),
    ThemePresetOption("orange", "برتقالي", "#ea580c"),
    ThemePresetOption("bronze", "برونزي", "#a15b34")
)

private data class BackgroundPresetOption(val key: String, val label: String, val description: String)

/** Ported verbatim from `src/constants/backgroundPresets.ts` — "none" is default. */
private val BACKGROUND_PRESETS = listOf(
    BackgroundPresetOption("none", "بدون خلفية (افتراضي)", "الخلفية الافتراضية النقية والهادئة."),
    BackgroundPresetOption("library_warm", "مكتبة كلاسيكية عريقة", "أجواء مكتبة أدبية دافئة وهادئة."),
    BackgroundPresetOption("parchment_manuscript", "ورق ومخطوطات عتيقة", "ملمس أدبي تاريخي مستوحى من المخطوطات."),
    BackgroundPresetOption("celestial_night", "سماء وسديم ليلي هادئ", "أفق ليلي وسديم كوني خافت."),
    BackgroundPresetOption("arabesque_geometry", "زخارف هندسية فاخرة", "أنماط هندسية معمارية راقية."),
    BackgroundPresetOption("minimalist_gradient", "أمواج شفق أدبي ناعم", "تدرجات لونية هادئة وشفق ضوئي."),
    BackgroundPresetOption("emerald_forest", "واحة زمردية مريحة", "طبيعة زمردية ضبابية مريحة."),
    BackgroundPresetOption("aurora_mesh", "توهّج الشفق الأدبي", "تدرّج ألوان ناعم — بلا صورة خارجية."),
    BackgroundPresetOption("midnight_gradient", "عمق ليلي متدرّج", "تدرّج داكن هادئ — بلا صورة خارجية."),
    BackgroundPresetOption("marble_luxury", "رخام فاخر دافئ", "درجات رخام كريمية فاخرة — بلا صورة خارجية.")
)

/** "إعدادات المنظومة والمظهر" — ترجمة حرفية لـ AdminSettingsTab.tsx. */
@Composable
fun SettingsTab(viewModel: AdminViewModel) {
    val theme by viewModel.themeSettings.collectAsState()
    val publishedOnStores by viewModel.appPublishedOnStores.collectAsState()
    val currentTheme = theme.preset ?: "purple"
    val currentBg = theme.backgroundPreset ?: "none"
    val blue = Color(0xFF3B82F6)
    val rose = Color(0xFFF43F5E)
    val s16 = RoundedCornerShape(16.dp)

    @Composable
    fun Panel(border: Color = Tw.slate800, bg: Color = Tw.slate900, content: @Composable () -> Unit) {
        Column(Modifier.fillMaxWidth().clip(s16).background(bg).border(1.dp, border, s16).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { content() }
    }
    @Composable
    fun H(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, title: String, sub: String? = null) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(icon, 16.dp, tint)
                Text(title, style = twText(14, FontWeight.Bold, 20), color = Color.White)
            }
            if (sub != null) Text(sub, Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        AdmCard(bg = Tw.slate900.copy(alpha = 0.9f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.Settings, 20.dp, brand.s400)
                Text("إعدادات المنظومة والمظهر", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text("تخصيص هوية التطبيق البصرية، خلفيات القالب، والاطلاع على معايير تقاسم الأرباح الثابتة.", Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
        }

        Panel {
            H(Lu.Sparkles, brand.s400, "لون السمة البصرية للمنصة (Theme Accent)", "يغير اللون الرئيسي للأزرار، التمييز، والواجهات في كل التطبيق.")
            Text(THEME_PRESETS.firstOrNull { it.key == currentTheme }?.label ?: currentTheme,
                Modifier.clip(RoundedCornerShape(50)).background(brand.s950).border(1.dp, brand.s500.copy(alpha = 0.2f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp),
                style = twText(12, FontWeight.Bold, 16), color = brand.s300, fontFamily = Adm.mono)
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                THEME_PRESETS.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        row.forEach { p ->
                            val sel = currentTheme == p.key
                            val sh = RoundedCornerShape(16.dp)
                            Row(
                                Modifier.weight(1f).clip(sh).background(if (sel) Tw.slate950 else Tw.slate950.copy(alpha = 0.6f))
                                    .border(if (sel) 2.dp else 1.dp, if (sel) brand.s500 else Tw.slate800, sh)
                                    .twClickable { viewModel.setThemePreset(p.key) }.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Box(Modifier.size(28.dp).clip(RoundedCornerShape(12.dp)).background(runCatching { Color(android.graphics.Color.parseColor(p.hex)) }.getOrDefault(Color.Gray)), contentAlignment = Alignment.Center) {
                                    if (sel) LuIcon(Lu.CheckCircle2, 16.dp, Color.White)
                                }
                                Text(p.label, Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        if (row.size < 2) Box(Modifier.weight(1f)) {}
                    }
                }
            }
        }

        Panel {
            H(Lu.Layers, Adm.blue400, "خلفية القالب الذكية (Background Style)", "نمط وتدرج خلفية الشاشة وتأثيراتها البصرية العامة.")
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                BACKGROUND_PRESETS.forEach { p ->
                    val sel = currentBg == p.key
                    val sh = RoundedCornerShape(16.dp)
                    Column(
                        Modifier.fillMaxWidth().clip(sh).background(if (sel) Tw.slate950 else Tw.slate950.copy(alpha = 0.6f))
                            .border(if (sel) 2.dp else 1.dp, if (sel) blue else Tw.slate800, sh)
                            .twClickable { viewModel.setBackgroundPreset(p.key) }.padding(16.dp)
                    ) {
                        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(p.label, style = twText(12, FontWeight.Bold, 16), color = Color.White)
                            if (sel) LuIcon(Lu.CheckCircle2, 16.dp, Adm.blue400)
                        }
                        Text(p.description, style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                    }
                }
            }
        }

        Panel {
            H(Lu.BadgePercent, Adm.emerald400, "مصفوفة تقاسم العوائد والضمان المالي (Revenue Split Matrix)")
            @Composable
            fun Cell(title: String, value: String, color: Color, note: String) {
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).padding(14.dp)) {
                    Text(title, Modifier.padding(bottom = 4.dp), style = twText(12, FontWeight.Bold, 16), color = Color.White)
                    Text(value, style = twText(12, FontWeight.Bold, 16), color = color, fontFamily = Adm.mono)
                    Text(note, Modifier.padding(top = 4.dp), style = twText(10, FontWeight.Normal, 14), color = Tw.slate500)
                }
            }
            Cell("إعلانات المقالات (In-Article)", "${RevenueShares.IN_ARTICLE_ADS.writerPercent}% للكاتب / ${RevenueShares.IN_ARTICLE_ADS.platformPercent}% للمنصة", Adm.emerald400, "تُطبق آلياً عند فحص أحداث النقرات والظهور.")
            Cell("إعلانات الملف الشخصي (Profile)", "${RevenueShares.WRITER_PROFILE_ADS.writerPercent}% للكاتب / ${RevenueShares.WRITER_PROFILE_ADS.platformPercent}% للمنصة", Adm.emerald400, "إعلانات البانر في صفحة الكاتب الشخصية.")
            Cell("مبيعات المقالات الحصرية", "${RevenueShares.LOCKED_ARTICLES.writerPercent}% للكاتب / ${RevenueShares.LOCKED_ARTICLES.platformPercent}% للمنصة", Adm.amber400, "15% رسوم المنصة على كل عملية شراء مقال.")
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(blue.copy(alpha = 0.10f)).border(1.dp, blue.copy(alpha = 0.2f), RoundedCornerShape(12.dp)).padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top
            ) {
                LuIcon(Lu.Info, 16.dp, Adm.blue400, Modifier.padding(top = 2.dp))
                Text("فترة التجميد المالية (30 يوماً): لضمان حماية المنصة من النقر الاحتيالي ومطالبات الاسترداد، تظل أرباح الكُتّاب في رصيد \"أرباح مجمّدة\" لمدة 30 يوماً قبل أن تظهر في تبويب \"تحرير الأرباح\" وتصبح قابلة للسحب.",
                    style = twText(12, FontWeight.Normal, 16), color = Adm.blue300)
            }
        }

        Panel {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(brand.s600.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) { LuIcon(Lu.Store, 20.dp, brand.s500) }
                Column(Modifier.weight(1f)) {
                    Text("التطبيق منشور على متاجر التطبيقات", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                    Text("فعّله فقط بعد رفع ونشر التطبيق فعلياً على Google Play (أو أي متجر آخر). عند التفعيل يختفي زر \"تحديث\" العائم داخل التطبيق لدى كل من يملك نسخة APK نهائياً — تحديث النسخة يصبح مسؤولية المتجر وحده.",
                        Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
            }
            Row(
                Modifier.clip(RoundedCornerShape(12.dp)).background(if (publishedOnStores) Adm.emerald600 else Tw.slate800)
                    .twClickable { viewModel.setAppPublishedOnStores(!publishedOnStores) }.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                LuIcon(Lu.Power, 14.dp, if (publishedOnStores) Color.White else Tw.slate400)
                Text(if (publishedOnStores) "منشور ✓" else "غير منشور بعد", style = twText(12, FontWeight.Black, 16), color = if (publishedOnStores) Color.White else Tw.slate400)
            }
        }

        Panel(border = rose.copy(alpha = 0.3f), bg = Color(0xFF4C0519).copy(alpha = 0.2f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.AlertOctagon, 16.dp, Adm.rose400)
                Text("منطقة الخطر — تصفير كل البيانات المالية التجريبية", style = twText(14, FontWeight.Bold, 20), color = Adm.rose300)
            }
            Text("يُصفِّر رصيد كل حساب وإنفاق كل حملة ومبيعات كل مقال إلى صفر، ويحذف نهائياً كل سجلات الإيداعات والسحوبات والمشتريات والأرباح وأحداث الإعلانات وبلاغات الاحتيال. هذا الإجراء متاح من لوحة تحكم الويب فقط (مستبعد عمداً من واجهة الجوال البرمجية).",
                style = twText(12, FontWeight.Normal, 20), color = Color(0xFFFECDD3).copy(alpha = 0.8f))
        }
    }
}
