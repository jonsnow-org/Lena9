package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.DarkCard
import studio.ai.literium.literium_app.ui.theme.SlateCardBg
import studio.ai.literium.literium_app.ui.theme.SlateMuted
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

/**
 * "إعدادات المنظومة والمظهر" — Compose port of `AdminSettingsTab.tsx`: the
 * live, admin-controlled global theme accent + background presets
 * ([AdminRepository.setThemePreset]/[setBackgroundPreset], `settings/theme`
 * — public read, admin write, synced to every user in real time) and the
 * fixed revenue-split matrix reference.
 *
 * NOT ported: the "منطقة الخطر" one-time full financial-data reset button.
 * Its only backing route is `POST /api/admin/reset-test-financial-data`,
 * deliberately excluded from [LiteriumApiService]'s surface (see its file
 * KDoc) as a destructive, pre-launch-only ops utility — not reachable from
 * a shipped mobile client by design, not an oversight. A disabled
 * explanatory card is shown instead of a fabricated action.
 */
@Composable
fun SettingsTab(viewModel: AdminViewModel) {
    val theme by viewModel.themeSettings.collectAsState()

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { Text("إعدادات المنظومة والمظهر", fontWeight = FontWeight.Bold) }

        item { Text("لون السمة البصرية للمنصة (Theme Accent)", fontWeight = FontWeight.Bold) }
        item {
            NonLazyGrid(THEME_PRESETS, columns = 3) { preset ->
                val isSelected = (theme.preset ?: "purple") == preset.key
                Card(
                    onClick = { viewModel.setThemePreset(preset.key) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer else SlateCardBg,
                        contentColor = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else Color.White
                    )
                ) {
                    Row(Modifier.padding(8.dp)) {
                        Box(preset.hex)
                        Column(Modifier.padding(start = 6.dp)) {
                            Text(preset.label, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                            if (isSelected) Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }
        }

        item { Text("خلفية القالب الذكية (Background Style)", fontWeight = FontWeight.Bold) }
        item {
            NonLazyGrid(BACKGROUND_PRESETS, columns = 2) { preset ->
                val isSelected = (theme.backgroundPreset ?: "none") == preset.key
                Card(
                    onClick = { viewModel.setBackgroundPreset(preset.key) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSelected) MaterialTheme.colorScheme.secondaryContainer else SlateCardBg,
                        contentColor = if (isSelected) MaterialTheme.colorScheme.onSecondaryContainer else Color.White
                    )
                ) {
                    Column(Modifier.padding(10.dp)) {
                        Text(preset.label, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Text(preset.description, fontSize = 10.sp, color = if (isSelected) MaterialTheme.colorScheme.onSecondaryContainer else SlateMuted, maxLines = 2)
                    }
                }
            }
        }

        item {
            DarkCard {
                Column(Modifier.padding(12.dp)) {
                    Text("مصفوفة تقاسم العوائد والضمان المالي", fontWeight = FontWeight.Bold)
                    Text("إعلانات المقالات: ${RevenueShares.IN_ARTICLE_ADS.label}", fontSize = 12.sp, color = SlateMuted)
                    Text("إعلانات الملف الشخصي: ${RevenueShares.WRITER_PROFILE_ADS.label}", fontSize = 12.sp, color = SlateMuted)
                    Text("مبيعات المقالات الحصرية: ${RevenueShares.LOCKED_ARTICLES.label}", fontSize = 12.sp, color = SlateMuted)
                    Text(
                        "فترة تجميد الأرباح: 30 يوماً قبل أن تصبح قابلة للسحب.",
                        fontSize = 11.sp,
                        color = SlateMuted,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer
                )
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text("منطقة الخطر — تصفير كل البيانات المالية التجريبية", fontWeight = FontWeight.Bold)
                    Text(
                        "هذا الإجراء متاح فقط من لوحة تحكم الويب (يتطلب POST /api/admin/reset-test-financial-data، " +
                            "مستبعد عمداً من واجهة الجوال البرمجية). استخدمه من الموقع مباشرة إن احتجت تصفير البيانات التجريبية قبل الإطلاق.",
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun Box(hex: String) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color.Gray))
    )
}
