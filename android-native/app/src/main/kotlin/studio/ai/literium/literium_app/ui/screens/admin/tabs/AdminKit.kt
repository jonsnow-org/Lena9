package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/** أدوات مشتركة لتبويبات الأدمن — تترجم أصناف Tailwind المتكررة في ملفات components/admin حرفياً. */
object Adm {
    val emerald400 = Color(0xFF34D399); val emerald500 = Color(0xFF10B981); val emerald600 = Color(0xFF059669)
    val amber300 = Color(0xFFFCD34D); val amber400 = Color(0xFFFBBF24); val amber500 = Color(0xFFF59E0B); val amber600 = Color(0xFFD97706)
    val rose300 = Color(0xFFFDA4AF); val rose400 = Color(0xFFFB7185); val rose500 = Color(0xFFF43F5E); val rose600 = Color(0xFFE11D48)
    val blue300 = Color(0xFF93C5FD); val blue400 = Color(0xFF60A5FA); val blue500 = Color(0xFF3B82F6)
    val mono = FontFamily.Monospace
    fun usd(v: Double) = "$" + String.format(java.util.Locale.US, "%.2f", v)
}

@Composable
fun AdmCard(
    modifier: Modifier = Modifier,
    radius: Dp = 16.dp,
    bg: Color = Tw.slate900,
    border: Color = Tw.slate800,
    padding: Dp = 16.dp,
    content: @Composable () -> Unit
) {
    val s = RoundedCornerShape(radius)
    Column(modifier.fillMaxWidth().clip(s).background(bg).border(1.dp, border, s).padding(padding)) { content() }
}

@Composable
fun AdmStat(value: String, label: String, valueColor: Color, border: Color, modifier: Modifier = Modifier) {
    val s = RoundedCornerShape(16.dp)
    Column(modifier.clip(s).background(Tw.slate900).border(1.dp, border, s).padding(16.dp)) {
        Text(value, style = twText(24, FontWeight.Black, 32), color = valueColor, fontFamily = Adm.mono)
        Text(label, Modifier.padding(top = 4.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
    }
}

/** صفّان من بطاقات الإحصاء (grid-cols-2). */
@Composable
fun AdmStatGrid(items: List<@Composable (Modifier) -> Unit>, columns: Int = 2) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { it(Modifier.weight(1f)) }
                repeat(columns - row.size) { Box(Modifier.weight(1f)) {} }
            }
        }
    }
}

@Composable
fun AdmBadge(text: String, fg: Color, bg: Color, border: Color?, mono: Boolean = true, size: Int = 10, round: Dp = 50.dp) {
    val s = RoundedCornerShape(round)
    var m = Modifier.clip(s).background(bg)
    if (border != null) m = m.border(1.dp, border, s)
    Text(text, m.padding(horizontal = 8.dp, vertical = 2.dp), style = twText(size, FontWeight.Bold, size + 4), color = fg,
        fontFamily = if (mono) Adm.mono else FontFamily.Default)
}

@Composable
fun AdmButton(
    text: String,
    onClick: () -> Unit,
    bg: Color,
    fg: Color = Color.White,
    border: Color? = null,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    size: Int = 12,
    modifier: Modifier = Modifier
) {
    val s = RoundedCornerShape(12.dp)
    var m = modifier.clip(s).background(if (enabled) bg else bg.copy(alpha = 0.5f))
    if (border != null) m = m.border(1.dp, border, s)
    Row(
        m.twClickable(enabled = enabled) { onClick() }.padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (icon != null) LuIcon(icon, 14.dp, fg)
        Text(text, style = twText(size, FontWeight.Bold, size + 4), color = fg)
    }
}

/** حقل بحث داكن (bg-slate-900 border-slate-800 rounded-xl text-xs). */
@Composable
fun AdmSearch(value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    val s = RoundedCornerShape(12.dp)
    Row(
        modifier.fillMaxWidth().clip(s).background(Tw.slate900).border(1.dp, Tw.slate800, s).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        LuIcon(Lu.Search, 16.dp, Tw.slate400)
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(placeholder, style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
            BasicTextField(
                value = value, onValueChange = onChange, singleLine = true,
                textStyle = twText(12, FontWeight.Normal, 16).copy(color = Color.White),
                cursorBrush = SolidColor(Color.White), modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/** مجموعة أزرار مقسّمة (bg-slate-900 p-1 rounded-xl border) — النشط بلون accent. */
@Composable
fun AdmSegment(options: List<Pair<String, String>>, selected: String, accent: Color, onSelect: (String) -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Row(
        Modifier.clip(s).background(Tw.slate900).border(1.dp, Tw.slate800, s).horizontalScroll(rememberScrollState()).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        options.forEach { (k, label) ->
            val on = selected == k
            Text(
                label,
                Modifier.clip(RoundedCornerShape(8.dp)).background(if (on) accent else Color.Transparent)
                    .twClickable(pressScale = 1f) { onSelect(k) }.padding(horizontal = 10.dp, vertical = 4.dp),
                style = twText(12, FontWeight.Bold, 16), color = if (on) Color.White else Tw.slate400
            )
        }
    }
}

@Composable
fun AdmEmpty(text: String) {
    Text(
        text,
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tw.slate900).border(1.dp, Tw.slate800, RoundedCornerShape(16.dp)).padding(40.dp),
        style = twText(14, FontWeight.Normal, 20), color = Tw.slate400, textAlign = androidx.compose.ui.text.style.TextAlign.Center
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdmFlow(content: @Composable () -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
}

/** حقل إدخال داكن (bg-slate-950 border-slate-800 rounded-xl text-xs) متعدد الأسطر اختيارياً. */
@Composable
fun AdmInput(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    minLines: Int = 1,
    mono: Boolean = false,
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text
) {
    val s = RoundedCornerShape(12.dp)
    Box(modifier.fillMaxWidth().clip(s).background(Tw.slate950).border(1.dp, Tw.slate800, s).padding(horizontal = 12.dp, vertical = 10.dp)) {
        if (value.isEmpty()) Text(placeholder, style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
        BasicTextField(
            value = value, onValueChange = onChange, singleLine = minLines == 1, minLines = minLines,
            textStyle = twText(12, FontWeight.Normal, 16).copy(color = Color.White, fontFamily = if (mono) Adm.mono else FontFamily.Default),
            cursorBrush = SolidColor(Color.White),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
fun AdmLabel(text: String) {
    Text(text, Modifier.padding(bottom = 6.dp), style = twText(12, FontWeight.Bold, 16), color = Tw.slate300)
}

/** غلاف نافذة منبثقة على نمط rounded-3xl bg-slate-900 border-slate-800 (مودالات الأدمن). */
@Composable
fun AdmDialog(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
    ) {
        val s = RoundedCornerShape(24.dp)
        Column(
            Modifier.padding(12.dp).fillMaxWidth().clip(s).background(Tw.slate900).border(1.dp, Tw.slate800, s)
                .androidxVerticalScroll().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) { content() }
    }
}

@Composable
private fun Modifier.androidxVerticalScroll(): Modifier = this.then(Modifier.verticalScroll(rememberScrollState()))
