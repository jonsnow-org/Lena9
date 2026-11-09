package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/**
 * هيكل نافذة الدخول — AuthModal.tsx: خلفية `from-brand-950 via-slate-950 to-slate-950` (App.tsx للتطبيق بلا جلسة)
 * وفوقها طبقة slate-950/80 ثم بطاقة max-w-xl rounded-3xl (رأس px-6 py-4 + حد سفلي + جسم p-6 بتباعد 20dp).
 */
@Composable
fun AuthShell(
    icon: ImageVector,
    title: String,
    subtitle: String?,
    maxWidth: androidx.compose.ui.unit.Dp = 576.dp,
    content: @Composable () -> Unit
) {
    val dark = isDark
    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(brand.s950, Tw.slate950, Tw.slate950)))
    ) {
        Box(Modifier.fillMaxSize().background(Tw.slate950.copy(alpha = 0.80f)))
        Box(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()
                .verticalScroll(rememberScrollState()).padding(12.dp),
            contentAlignment = Alignment.Center
        ) {
            val shape = RoundedCornerShape(24.dp)
            Column(
                Modifier.widthIn(max = maxWidth).fillMaxWidth().shadow(24.dp, shape).clip(shape)
                    .background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape)
            ) {
                Row(
                    Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.90f) else Tw.slate50.copy(alpha = 0.90f)).padding(horizontal = 24.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(Modifier.size(36.dp).clip(RoundedCornerShape(16.dp)).background(Tw.teal600.copy(alpha = 0.10f)), contentAlignment = Alignment.Center) {
                        LuIcon(icon, 16.dp, if (dark) Tw.teal300 else Tw.teal600)
                    }
                    Column {
                        Text(title, style = twText(16, FontWeight.ExtraBold, 24), color = if (dark) Tw.white else Tw.slate900)
                        if (subtitle != null) Text(subtitle, style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate200))
                Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) { content() }
            }
        }
    }
}

/** حقل نص: label xs bold، حقل px-4 py-2.5 rounded-2xl، حد teal-500 عند التركيز. */
@Composable
fun AuthField(
    label: String, value: String, onChange: (String) -> Unit, placeholder: String,
    modifier: Modifier = Modifier, password: Boolean = false, email: Boolean = false, small: Boolean = false,
    multiline: Boolean = false, hint: String? = null
) {
    val dark = isDark
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(if (small) 12.dp else 16.dp)
    Column(modifier) {
        Text(label, Modifier.padding(bottom = 4.dp), style = twText(if (small) 11 else 12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
        Box(
            Modifier.fillMaxWidth().clip(shape).background(if (small) (if (dark) Tw.slate800 else Tw.white) else (if (dark) Tw.slate800 else Tw.slate50))
                .border(1.dp, if (focused) Tw.teal600.copy(alpha = 1f).let { Color(0xFF14B8A6) } else (if (dark) Tw.slate700 else Tw.slate200), shape)
                .padding(horizontal = if (small) 14.dp else 16.dp, vertical = if (small) 8.dp else 10.dp)
        ) {
            if (value.isEmpty()) Text(placeholder, style = twText(12, FontWeight.Normal, 18), color = Tw.slate400)
            BasicTextField(
                value = value, onValueChange = onChange, singleLine = !multiline, minLines = if (multiline) 2 else 1,
                textStyle = twText(12, FontWeight.Normal, 18).copy(color = if (dark) Tw.white else Tw.slate900),
                cursorBrush = SolidColor(Color(0xFF14B8A6)),
                visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else if (email) KeyboardType.Email else KeyboardType.Text),
                modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused }
            )
        }
        if (hint != null) Text(hint, Modifier.padding(top = 4.dp), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
    }
}

@Composable
fun AuthLink(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Text(
        text, modifier.twClickable(onClick = onClick),
        style = twText(11, FontWeight.Bold, 16), color = if (isDark) Tw.teal300 else Tw.teal600
    )
}

/** زر رئيسي: py-3.5 rounded-2xl bg-teal-600 وظل teal، نص xs extrabold. */
@Composable
fun AuthPrimaryButton(text: String, loading: Boolean, enabled: Boolean = true, trailing: ImageVector? = null, icon: ImageVector? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().alpha(if (loading || !enabled) 0.6f else 1f)
            .shadow(6.dp, shape, ambientColor = Color(0xFF14B8A6).copy(alpha = 0.20f), spotColor = Color(0xFF14B8A6).copy(alpha = 0.20f))
            .clip(shape).background(Tw.teal600).twClickable(enabled = !loading && enabled, pressScale = 0.95f, onClick = onClick).padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(16.dp), color = Tw.white, strokeWidth = 2.dp)
        else {
            if (icon != null) LuIcon(icon, 16.dp, Tw.white)
            Text(text, style = twText(12, FontWeight.ExtraBold, 16), color = Tw.white)
            if (trailing != null) LuIcon(trailing, 16.dp, Tw.white)
        }
    }
}

/** صندوق خطأ rose: p-3.5 rounded-2xl bg rose/10 border rose/20. */
@Composable
fun AuthErrorBox(message: String) {
    val dark = isDark
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(Tw.rose500.copy(alpha = 0.10f)).border(1.dp, Tw.rose500.copy(alpha = 0.20f), shape).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        LuIcon(Lu.AlertCircle, 16.dp, if (dark) Tw.rose400 else Tw.rose600)
        Text(message, Modifier.weight(1f), style = twText(12, FontWeight.Medium, 16), color = if (dark) Tw.rose400 else Tw.rose600)
    }
}

@Composable
fun AuthSuccessBox(message: String) {
    val dark = isDark
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(Tw.emerald500.copy(alpha = 0.10f)).border(1.dp, Tw.emerald500.copy(alpha = 0.20f), shape).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        LuIcon(Lu.CheckCircle2, 16.dp, if (dark) Color(0xFF34D399) else Tw.emerald700)
        Text(message, Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = if (dark) Color(0xFF34D399) else Tw.emerald700)
    }
}

@Composable
fun AuthInfoBox(message: String) {
    val dark = isDark
    val shape = RoundedCornerShape(16.dp)
    Text(
        message,
        Modifier.fillMaxWidth().clip(shape).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.20f) else Color(0xFFF0FDFA).copy(alpha = 0.60f))
            .border(1.dp, if (dark) Color(0xFF134E4A).copy(alpha = 0.40f) else Color(0xFF99F6E4).copy(alpha = 0.60f), shape).padding(14.dp),
        style = twText(11, FontWeight.Normal, 18), color = if (dark) Tw.teal300 else Color(0xFF115E59)
    )
}
