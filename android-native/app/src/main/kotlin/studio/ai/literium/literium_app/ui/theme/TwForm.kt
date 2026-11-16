package studio.ai.literium.literium_app.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

/** صفحة بنمط النوافذ في الويب: بطاقة rounded-3xl، رأس (عنوان + X)، جسم قابل للتمرير (p-6 space-y-5). */
@Composable
fun TwPage(
    title: String,
    onClose: () -> Unit,
    scroll: Boolean = true,
    bodyPadding: Int = 24,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val dark = isDark
    val line = if (dark) Tw.slate800 else Tw.slate200
    val shell = RoundedCornerShape(24.dp)
    Box(Modifier.fillMaxSize().padding(8.dp)) {
        Column(Modifier.fillMaxSize().shadow(16.dp, shell, clip = false).clip(shell).background(if (dark) Tw.slate900 else Tw.white).androidBorder(line, shell)) {
            Row(
                Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, style = twText(15, FontWeight.ExtraBold, 22), color = if (dark) Tw.white else Tw.slate900)
                Box(Modifier.twClickable(onClick = onClose).padding(6.dp)) { LuIcon(Lu.X, 20.dp, Tw.slate400) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(line))
            val bodyMod = Modifier.weight(1f).fillMaxWidth().let { if (scroll) it.verticalScroll(rememberScrollState()) else it }.padding(bodyPadding.dp)
            Column(bodyMod, verticalArrangement = Arrangement.spacedBy(20.dp)) { content() }
            if (footer != null) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(line))
                Column(Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(16.dp)) { footer() }
            }
        }
    }
}

private fun Modifier.androidBorder(c: Color, s: androidx.compose.ui.graphics.Shape): Modifier = this.border(1.dp, c, s)

@Composable
fun TwLoading() {
    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }
}

@Composable
fun TwError(text: String) {
    val dark = isDark
    val es = RoundedCornerShape(16.dp)
    Row(Modifier.fillMaxWidth().clip(es).background(Tw.rose500.copy(alpha = 0.10f)).border(1.dp, Tw.rose500.copy(alpha = 0.20f), es).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LuIcon(Lu.AlertCircle, 16.dp, Tw.rose500)
        Text(text, style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.rose400 else Tw.rose600)
    }
}

@Composable
fun TwNotice(text: String, tone: Color = Tw.emerald500) {
    val es = RoundedCornerShape(16.dp)
    Row(Modifier.fillMaxWidth().clip(es).background(tone.copy(alpha = 0.10f)).border(1.dp, tone.copy(alpha = 0.20f), es).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LuIcon(Lu.CheckCircle2, 16.dp, tone)
        Text(text, style = twText(11, FontWeight.Bold, 16), color = if (isDark) tone else tone)
    }
}

@Composable
fun TwLabel(text: String, trailing: String? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(text, style = twText(12, FontWeight.Bold, 16), color = if (isDark) Tw.slate300 else Tw.slate700)
        if (trailing != null) Text(trailing, style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
    }
}

/** حقل إدخال الويب: px-3.5 py-2.5 rounded-xl bg-slate-50 border slate-200، تركيز بلون العلامة. */
@Composable
fun TwInput(
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    singleLine: Boolean = true,
    minLines: Int = 1,
    bold: Boolean = false,
    ltr: Boolean = false,
    enabled: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailing: (@Composable () -> Unit)? = null
) {
    val dark = isDark
    val s = RoundedCornerShape(12.dp)
    Row(
        modifier.fillMaxWidth().clip(s).background(if (dark) Tw.slate800 else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, s)
            .then(if (!enabled) Modifier.alpha(0.6f) else Modifier).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(Modifier.weight(1f)) {
            if (value.isEmpty() && placeholder.isNotEmpty()) Text(placeholder, style = twText(12, FontWeight.Normal, 20), color = Tw.slate400)
            var st = twText(if (bold) 14 else 12, if (bold) FontWeight.Bold else FontWeight.Normal, 20).copy(color = if (dark) Tw.white else Tw.slate900)
            if (ltr) st = st.copy(textDirection = androidx.compose.ui.text.style.TextDirection.Ltr)
            BasicTextField(value, onChange, enabled = enabled, singleLine = singleLine, minLines = minLines, textStyle = st, cursorBrush = SolidColor(brand.s500), keyboardOptions = keyboardOptions, visualTransformation = visualTransformation, modifier = Modifier.fillMaxWidth().then(if (minLines > 1) Modifier.heightIn(min = (minLines * 20).dp) else Modifier))
        }
        trailing?.invoke()
    }
}

@Composable
fun TwLabeled(label: String, trailing: String? = null, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) { TwLabel(label, trailing); content() }
}

/** زر أساسي: rounded-2xl py-3 لون brand-600 مع active:scale-95. */
@Composable
fun TwButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    icon: ImageVector? = null,
    container: Color = brand.s600,
    content: Color = Tw.white,
    full: Boolean = true
) {
    val s = RoundedCornerShape(16.dp)
    Row(
        modifier.then(if (full) Modifier.fillMaxWidth() else Modifier).clip(s).background(container).then(if (!enabled || loading) Modifier.alpha(0.6f) else Modifier)
            .twClickable(enabled = enabled && !loading, pressScale = 0.95f, onClick = onClick).padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically
    ) {
        if (loading) CircularProgressIndicator(Modifier.height(16.dp).padding(0.dp), color = content, strokeWidth = 2.dp)
        else if (icon != null) LuIcon(icon, 16.dp, content)
        Text(text, style = twText(12, FontWeight.ExtraBold, 16), color = content)
    }
}

@Composable
fun TwSecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null) {
    val dark = isDark
    val s = RoundedCornerShape(12.dp)
    Row(
        modifier.clip(s).background(if (dark) Tw.slate800 else Tw.slate100).then(if (!enabled) Modifier.alpha(0.5f) else Modifier)
            .twClickable(enabled = enabled, onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (icon != null) LuIcon(icon, 14.dp, if (dark) Tw.slate200 else Tw.slate700)
        Text(text, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate700)
    }
}

/** شريحة اختيار (pill) مثل تبويبات الويب الفرعية: نشطة teal-600/brand أو رمادية. */
@Composable
fun TwPill(text: String, active: Boolean, onClick: () -> Unit, icon: ImageVector? = null, modifier: Modifier = Modifier) {
    val dark = isDark
    val s = RoundedCornerShape(12.dp)
    Row(
        modifier.clip(s).background(if (active) Tw.teal600 else (if (dark) Tw.slate800 else Tw.slate100)).twClickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (icon != null) LuIcon(icon, 14.dp, if (active) Tw.white else Tw.slate500)
        Text(text, style = twText(11, FontWeight.Bold, 16), color = if (active) Tw.white else Tw.slate500, maxLines = 1)
    }
}

/** بطاقة محتوى: rounded-2xl أو 3xl، حدّ slate، خلفية بيضاء/slate-900. */
@Composable
fun TwCard(modifier: Modifier = Modifier, radius: Int = 16, padding: Int = 16, content: @Composable ColumnScope.() -> Unit) {
    val dark = isDark
    val s = RoundedCornerShape(radius.dp)
    Column(modifier.fillMaxWidth().shadow(1.dp, s, clip = false).clip(s).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), s).padding(padding.dp), content = content)
}

@Composable
fun TwSwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit, sub: String? = null) {
    val dark = isDark
    Row(Modifier.fillMaxWidth().twClickable { onChange(!checked) }, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate800)
            if (sub != null) Text(sub, style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
        }
        Box(Modifier.width(40.dp).height(24.dp).clip(RoundedCornerShape(50)).background(if (checked) Tw.teal600 else (if (dark) Tw.slate700 else Tw.slate300)).padding(2.dp)) {
            Box(Modifier.align(if (checked) Alignment.CenterEnd else Alignment.CenterStart).size(20.dp).clip(RoundedCornerShape(50)).background(Tw.white))
        }
    }
}
