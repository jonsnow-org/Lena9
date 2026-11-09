package studio.ai.literium.literium_app.ui.components

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.uploadTweetImage

private const val MAX_TWEET_LENGTH = 280

/**
 * مُنشئ التغريدة — TweetComposer.tsx: p-4 rounded-2xl، صورة دائرية 40dp، حقل نص بلا إطار (سطران)،
 * مرفقات، وصف سفلي: مشبك + عدّاد mono، وزر «تغريد» دائري px-4 py-1.5 بلون brand-600.
 */
@Composable
fun TweetComposerBar(
    avatarUrl: String,
    onSubmit: (String, String?) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "بماذا تفكر؟ شارك خاطرة قصيرة...",
    clearOnSubmit: Boolean = true
) {
    var content by remember { mutableStateOf("") }
    var imageUrl by remember { mutableStateOf<String?>(null) }
    var uploading by remember { mutableStateOf(false) }
    var imageError by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dark = isDark
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        imageError = null
        uploading = true
        scope.launch {
            uploadTweetImage(context, uri).fold(
                onSuccess = { url -> uploading = false; imageUrl = url },
                onFailure = { e -> uploading = false; imageError = e.message ?: "تعذّر رفع الصورة." }
            )
        }
    }
    val remaining = MAX_TWEET_LENGTH - content.length
    val over = remaining < 0
    val canSubmit = (content.isNotBlank() || imageUrl != null) && !over && !uploading

    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier.fillMaxWidth().shadow(1.dp, shape, clip = false).clip(shape).background(if (dark) Tw.slate900 else Tw.white)
            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape).padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top
    ) {
        AsyncImage(avatarUrl, null, Modifier.size(40.dp).clip(CircleShape), contentScale = ContentScale.Crop)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.fillMaxWidth().heightIn(min = 44.dp)) {
                if (content.isEmpty()) Text(placeholder, style = twText(14, FontWeight.Normal, 20), color = Tw.slate400)
                BasicTextField(
                    value = content, onValueChange = { content = it }, minLines = 2,
                    textStyle = twText(14, FontWeight.Normal, 20).copy(color = if (dark) Tw.white else Tw.slate900),
                    cursorBrush = SolidColor(brand.s500), modifier = Modifier.fillMaxWidth()
                )
            }
            if (uploading) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50).padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp, color = Tw.slate500)
                    Text("جاري رفع الملف...", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
                }
            }
            if (imageError != null && !uploading) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (dark) Tw.rose50.copy(alpha = 0.10f) else Tw.rose50)
                        .border(1.dp, if (dark) Tw.rose200.copy(alpha = 0.25f) else Tw.rose200, RoundedCornerShape(8.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(imageError ?: "", Modifier.weight(1f), style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.rose400 else Tw.rose600)
                    Box(Modifier.twClickable { imageError = null }.padding(2.dp)) { LuIcon(Lu.X, 12.dp, Tw.rose600) }
                }
            }
            imageUrl?.let { url ->
                if (!uploading) Box {
                    AsyncImage(url, null, Modifier.heightIn(max = 160.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(6.dp).clip(RoundedCornerShape(8.dp)).background(Tw.slate950.copy(alpha = 0.70f))
                            .twClickable(pressScale = 0.90f) { imageUrl = null }.padding(4.dp)
                    ) { LuIcon(Lu.X, 14.dp, Tw.white) }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.alpha(if (uploading) 0.4f else 1f).clip(RoundedCornerShape(8.dp)).twClickable(enabled = !uploading, pressScale = 0.90f) { picker.launch("image/*") }.padding(8.dp)) {
                        LuIcon(Lu.Paperclip, 16.dp, Tw.slate400)
                    }
                    Text(
                        "$remaining",
                        style = twText(11, FontWeight.Bold, 16).copy(fontFamily = FontFamily.Monospace),
                        color = when { over -> Tw.rose500; remaining <= 20 -> Tw.amber500; else -> Tw.slate400 }
                    )
                }
                Row(
                    Modifier.alpha(if (canSubmit) 1f else 0.4f).clip(CircleShape).background(brand.s600)
                        .twClickable(enabled = canSubmit, pressScale = 0.90f) {
                            onSubmit(content.trim(), imageUrl)
                            if (clearOnSubmit) { content = ""; imageUrl = null; imageError = null }
                        }.padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text("تغريد", style = twText(12, FontWeight.Bold, 16), color = Tw.white)
                    LuIcon(Lu.Send, 14.dp, Tw.white, Modifier.rotate(180f))
                }
            }
        }
    }
}
