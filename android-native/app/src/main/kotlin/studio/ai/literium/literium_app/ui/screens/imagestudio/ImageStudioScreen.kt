package studio.ai.literium.literium_app.ui.screens.imagestudio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwButton
import studio.ai.literium.literium_app.ui.theme.TwError
import studio.ai.literium.literium_app.ui.theme.TwInput
import studio.ai.literium.literium_app.ui.theme.TwNotice
import studio.ai.literium.literium_app.ui.theme.TwPage
import studio.ai.literium.literium_app.ui.theme.TwSecondaryButton
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/**
 * استوديو توليد الصور — ImageStudioModal.tsx: ترويسة بحصّة/رصيد، وصف الصورة + أفكار سريعة، الأبعاد، الأنماط (رموز تعبيرية)،
 * زر التوليد، ثم معاينة داكنة slate-950 مع أزرار تحميل/نسخ/استخدام كغلاف، وسجل الصور السابقة.
 */
@Composable
fun ImageStudioScreen(
    onBack: () -> Unit,
    onImageSelected: ((String) -> Unit)? = null
) {
    val viewModel: ImageStudioViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()
    val clipboard = LocalClipboardManager.current
    val uri = LocalUriHandler.current
    val dark = isDark
    val box = RoundedCornerShape(16.dp)
    val line = if (dark) Tw.slate800 else Tw.slate200

    TwPage(title = "استوديو توليد الصور الذكية", onClose = onBack) {
        Text("حوّل أفكارك ومقالاتك إلى أغلفة ولوحات فنية أدبية متقنة", style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
        // حصة/رصيد
        Row(Modifier.fillMaxWidth().clip(box).background(Tw.slate950).padding(horizontal = 14.dp, vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LuIcon(Lu.Sparkles, 14.dp, Color(0xFF5EEAD4))
                Text(if (state.isGuest) "تصفّح كزائر" else "رصيدك:", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
            }
            Text(state.freeQuotaRemaining?.let { "$it مجانية متبقية" } ?: "3 صور مجانية", style = twText(11, FontWeight.Bold, 16), color = Color(0xFF6EE7B7))
            state.walletBalance?.let { Text("$${"%.2f".format(it)}", style = twText(11, FontWeight.Bold, 16).copy(fontFamily = FontFamily.Monospace), color = Tw.slate200) }
        }
        if (state.isGuest) TwNotice("تصفّحك حالياً كزائر — يمكنك توليد صور مجاناً الآن، لكن سجّل الدخول لحفظ سجلّك.", Tw.amber500)
        state.errorMessage?.let { TwError(it) }
        state.successMessage?.let { TwNotice(it) }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    LuIcon(Lu.Wand2, 16.dp, brand.s500)
                    Text("وصف الصورة والفكرة الإبداعية *", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                }
                Text("لغة عربية أو إنجليزية", style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
            }
            TwInput(state.prompt, viewModel::setPrompt, placeholder = "مثال: غلاف مقال أدبي يعبر عن تأمل كاتب عربي في مكتبة عتيقة على ضوء الشموع", singleLine = false, minLines = 3)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                LuIcon(Lu.Lightbulb, 12.dp, Tw.amber500)
                Text("أفكار مقترحة سريعة:", style = twText(10, FontWeight.Bold, 15), color = Tw.slate400)
            }
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IMAGE_PROMPT_SUGGESTIONS.forEach { s ->
                    Box(Modifier.clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100).twClickable { viewModel.setPrompt(s) }.padding(horizontal = 12.dp, vertical = 6.dp)) { Text(s, style = twText(10, FontWeight.Medium, 15), color = if (dark) Tw.slate300 else Tw.slate600, maxLines = 1) }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) { LuIcon(Lu.Ratio, 16.dp, brand.s500); Text("الأبعاد والتنسيق (Aspect Ratio)", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700) }
            ASPECT_RATIO_OPTIONS.chunked(2).forEach { r ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    r.forEach { o ->
                        val sel = state.aspectRatio == o.id
                        Box(Modifier.weight(1f).clip(box).background(if (sel) brand.s500.copy(alpha = 0.10f) else Color.Transparent).border(if (sel) 2.dp else 1.dp, if (sel) brand.s500 else line, box).twClickable { viewModel.setAspectRatio(o.id) }.padding(12.dp), contentAlignment = Alignment.Center) {
                            Text(o.labelAr, style = twText(12, FontWeight.Bold, 16).copy(textAlign = TextAlign.Center), color = if (sel) brand.s600 else (if (dark) Tw.slate400 else Tw.slate600))
                        }
                    }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) { LuIcon(Lu.Palette, 16.dp, brand.s500); Text("النمط والأسلوب الفني", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700) }
            IMAGE_STYLE_OPTIONS.chunked(2).forEach { r ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    r.forEach { o ->
                        val sel = state.style == o.id
                        Column(Modifier.weight(1f).clip(box).background(if (sel) brand.s500.copy(alpha = 0.10f) else Color.Transparent).border(if (sel) 2.dp else 1.dp, if (sel) brand.s500 else line, box).twClickable { viewModel.setStyle(o.id) }.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(o.emoji, style = twText(18, FontWeight.Normal, 24))
                            Text(o.labelAr, style = twText(12, FontWeight.Bold, 16), color = if (sel) brand.s600 else (if (dark) Tw.slate200 else Tw.slate800))
                            Text(o.descAr, style = twText(10, FontWeight.Normal, 15), color = Tw.slate500)
                        }
                    }
                    if (r.size == 1) Box(Modifier.weight(1f)) {}
                }
            }
        }

        TwButton(if (state.isLoading) "جاري رسم وتوليد اللوحة بالذكاء الاصطناعي..." else "توليد الصورة الآن", { viewModel.generate() }, enabled = state.prompt.isNotBlank(), loading = state.isLoading, icon = Lu.Wand2, container = brand.s600)

        // المعاينة
        val ps = RoundedCornerShape(24.dp)
        Column(Modifier.fillMaxWidth().clip(ps).background(Tw.slate950).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) { LuIcon(Lu.Image, 16.dp, brand.s400); Text("معاينة الصورة الناتجة", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
                if (state.currentImage != null) Text("جاهزة للتحميل والاستخدام", style = twText(10, FontWeight.Normal, 15).copy(fontFamily = FontFamily.Monospace), color = Tw.emerald400)
            }
            val ratio = when (state.aspectRatio) { "1:1" -> 1f; "4:3" -> 4f / 3f; "9:16" -> 9f / 16f; else -> 16f / 9f }
            Box(Modifier.fillMaxWidth().aspectRatio(ratio).clip(RoundedCornerShape(16.dp)).background(Tw.slate900).border(1.dp, Tw.slate800, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                when {
                    state.isLoading -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(Modifier.size(32.dp), color = brand.s400, strokeWidth = 3.dp)
                        Text("يقوم Gemini بمعالجة المشهد الفني...", style = twText(14, FontWeight.Bold, 20), color = Tw.white)
                        Text("تطبيق الإضاءة، الأسلوب البصري والتفاصيل الدقيقة", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
                    }
                    state.currentImage != null -> AsyncImage(state.currentImage, "الصورة الناتجة", Modifier.fillMaxWidth(), contentScale = ContentScale.Crop)
                    else -> Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(16.dp)) {
                        LuIcon(Lu.Image, 40.dp, Tw.slate600)
                        Text("لم يتم توليد أي صورة بعد", Modifier.padding(top = 8.dp), style = twText(12, FontWeight.Bold, 16), color = Tw.slate400)
                        Text("اكتب فكرتك في الحقل واضغط على \"توليد الصورة الآن\" لتشاهد الإبداع الفني هنا.", style = twText(11, FontWeight.Normal, 16).copy(textAlign = TextAlign.Center), color = Tw.slate500)
                    }
                }
            }
            state.currentImage?.let { img ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TwSecondaryButton("تحميل", { uri.openUri(img) }, Modifier.weight(1f), icon = Lu.Download)
                    TwSecondaryButton("نسخ الرابط", { clipboard.setText(AnnotatedString(img)) }, Modifier.weight(1f), icon = Lu.Copy)
                }
                if (onImageSelected != null) TwButton("استخدام كغلاف للمقال", { onImageSelected(img) }, container = Tw.teal600)
            }
        }
        if (state.history.size > 1) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("الصور السابقة في هذه الجلسة:", style = twText(10, FontWeight.Bold, 15), color = Tw.slate400)
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                state.history.forEach { h ->
                    val sel = h == state.currentImage
                    AsyncImage(h, null, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).border(if (sel) 2.dp else 1.dp, if (sel) brand.s500 else line, RoundedCornerShape(12.dp)).twClickable { viewModel.selectFromHistory(h) }, contentScale = ContentScale.Crop)
                }
            }
        }
    }
}
