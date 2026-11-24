package studio.ai.literium.literium_app.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Shared dark card/stat design system for the admin dashboard, extracted from what was originally
 * built inline in `AnalyticsTab.kt` — that tab was rebuilt to match `AdminAnalyticsTab.tsx`'s actual
 * look (dark `bg-slate-900` cards, a colored icon chip, a big white number) after a side-by-side
 * screenshot comparison showed every OTHER admin tab still used bare Material3 `Card()` (white, no
 * icon, no color), which is why they read as visually unfinished next to the web version and next to
 * this one tab. Every admin tab should use [DarkCard]/[StatCard]/these colors instead of `Card()`
 * directly, so the whole dashboard reads as one consistent design instead of a patchwork.
 *
 * Colors are the same Tailwind hex values the web uses (slate-900/slate-400/emerald/teal/blue/amber/
 * rose-500), copied verbatim rather than approximated.
 */
val SlateCardBg = Color(0xFF0F172A) // slate-900
val SlateBorder = Color(0xFF1E293B) // slate-800
val SlateMuted = Color(0xFF94A3B8) // slate-400
val Emerald = Color(0xFF10B981) // emerald-500
val Teal500 = Color(0xFF14B8A6) // teal-500
val BluePill = Color(0xFF3B82F6) // blue-500
val Amber500 = Color(0xFFF59E0B) // amber-500
val Rose500 = Color(0xFFF43F5E) // rose-500
val Purple500 = Color(0xFFA855F7) // purple-500

/** Drop-in replacement for a bare `Card { content() }` — same call shape, dark themed. */
@Composable
fun DarkCard(modifier: Modifier = Modifier, borderColor: Color = SlateBorder, onClick: (() -> Unit)? = null, content: @Composable () -> Unit) {
    if (onClick != null) {
        Surface(
            onClick = onClick,
            color = SlateCardBg,
            contentColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, borderColor),
            modifier = modifier
        ) { content() }
        return
    }
    Surface(
        color = SlateCardBg,
        // صريح وليس متروكاً للافتراضي — بلا هذا فإن أي Text داخل هذه البطاقة بلا لون صريح خاص به
        // (النمط الأكثر شيوعاً في كل تبويبات الأدمن) يرث `contentColorFor(SlateCardBg)` من نظام
        // الألوان الحالي (غالباً كحة داكنة قريبة من الأسود في السمة الفاتحة الافتراضية) فوق خلفية
        // داكنة أصلاً — نص شبه غير مرئي. أبيض هنا يضمن نصاً مقروءاً افتراضياً؛ أي Text يريد لوناً
        // خافتاً يحدده صراحة (SlateMuted) فوق هذا الافتراضي.
        contentColor = Color.White,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, borderColor),
        modifier = modifier
    ) { content() }
}

/** A [DarkCard] with a bold white title + muted subtitle body — the most common `Card { Column {
 *  Text(bold); Text(small) } }` pattern repeated across every admin tab, now consistent and dark. */
@Composable
fun TitledDarkCard(title: String, modifier: Modifier = Modifier, content: (@Composable () -> Unit)? = null) {
    DarkCard(modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text(title, fontWeight = FontWeight.Bold, color = Color.White)
            content?.invoke()
        }
    }
}

/** Statistic tile matching `AdminAnalyticsTab.tsx`'s cards: colored icon chip, big white number,
 *  colored unit label, optional footer row. */
@Composable
fun StatCard(
    label: String,
    value: String,
    icon: ImageVector,
    accent: Color,
    modifier: Modifier = Modifier,
    unit: String? = null,
    footer: (@Composable () -> Unit)? = null
) {
    DarkCard(modifier = modifier, borderColor = accent.copy(alpha = 0.3f)) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SlateMuted, modifier = Modifier.weight(1f))
                Box(
                    Modifier.size(28.dp).clip(RoundedCornerShape(10.dp)).background(accent.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(15.dp))
                }
            }
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
                Text(value, fontSize = 22.sp, fontWeight = FontWeight.Black, color = Color.White)
                if (unit != null) {
                    Text(unit, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = accent, modifier = Modifier.padding(bottom = 3.dp))
                }
            }
            if (footer != null) {
                Column(Modifier.padding(top = 6.dp)) { footer() }
            }
        }
    }
}

@Composable
fun StatFooterLine(left: String, right: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(left, fontSize = 11.sp, color = SlateMuted)
        Text(right, fontSize = 11.sp, color = SlateMuted)
    }
}

/** Rounded colored-pill icon toggle — active/inactive state reads as a real colored button instead of
 *  a bare default-tint [androidx.compose.material3.IconButton] (flat gray/black, no fill at all). */
@Composable
fun StatusPillIconButton(
    active: Boolean,
    activeContainer: Color,
    activeContent: Color,
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val resolvedContainer = if (active) activeContainer else SlateCardBg
    val resolvedContent = if (active) activeContent else SlateMuted
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = resolvedContainer,
        border = if (active) null else BorderStroke(1.dp, SlateBorder),
        modifier = modifier.size(36.dp)
    ) {
        Box(Modifier.fillMaxWidth().padding(6.dp), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = contentDescription, tint = resolvedContent, modifier = Modifier.size(18.dp))
        }
    }
}
