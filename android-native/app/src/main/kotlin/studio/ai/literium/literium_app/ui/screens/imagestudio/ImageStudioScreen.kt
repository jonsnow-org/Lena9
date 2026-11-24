package studio.ai.literium.literium_app.ui.screens.imagestudio

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * AI image-generation studio (spec §4.6) — full-fidelity port of `src/components/
 * ImageStudioModal.tsx`: prompt input with quick suggestions, aspect-ratio + artistic-style
 * pickers, generate action, and a result panel with quota/cost/charged display, download-equivalent
 * (copy link — see final report on why an in-app file save isn't wired), and an optional
 * "use as cover" hookup for the article editor via [onImageSelected].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImageStudioScreen(
    onBack: () -> Unit,
    onImageSelected: ((String) -> Unit)? = null
) {
    val viewModel: ImageStudioViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()
    val clipboard = LocalClipboardManager.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("استوديو توليد الصور الذكية", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") } }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "حوّل أفكارك ومقالاتك إلى أغلفة ولوحات فنية أدبية متقنة",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f)
                    )
                    if (!state.isGuest) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text("رصيدك: $${"%.2f".format(state.walletBalance ?: 0.0)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
                            Text(
                                if (state.freeQuotaRemaining != null) "${state.freeQuotaRemaining} مجانية متبقية" else "3 صور مجانية",
                                fontSize = 9.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            if (state.isGuest) {
                item {
                    Surface(color = BrandAmber.copy(alpha = 0.1f), shape = RoundedCornerShape(12.dp)) {
                        Text(
                            "تصفّحك حالياً كزائر — يمكنك توليد صور مجاناً الآن، لكن سجّل الدخول لحفظ سجلّ صورك.",
                            modifier = Modifier.padding(10.dp),
                            fontSize = 11.sp,
                            color = Color(0xFFB45309)
                        )
                    }
                }
            }

            val errorMessage = state.errorMessage
            if (errorMessage != null) {
                item {
                    Surface(color = Color(0xFFE11D48).copy(alpha = 0.1f), shape = RoundedCornerShape(12.dp)) {
                        Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(errorMessage, fontSize = 11.sp, color = Color(0xFFE11D48), modifier = Modifier.weight(1f))
                        }
                    }
                }
            }

            val successMessage = state.successMessage
            if (successMessage != null) {
                item {
                    Surface(color = BrandTeal.copy(alpha = 0.1f), shape = RoundedCornerShape(12.dp)) {
                        Text(successMessage, modifier = Modifier.padding(10.dp), fontSize = 11.sp, color = BrandTeal, fontWeight = FontWeight.Medium)
                    }
                }
            }

            item {
                Column {
                    Text("وصف الصورة والفكرة الإبداعية *", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = state.prompt,
                        onValueChange = viewModel::setPrompt,
                        placeholder = { Text("مثال: غلاف مقال أدبي يعبر عن تأمل كاتب عربي في مكتبة عتيقة...") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3
                    )
                    Spacer(Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(IMAGE_PROMPT_SUGGESTIONS) { suggestion ->
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.clickable { viewModel.setPrompt(suggestion) }
                            ) {
                                Text(
                                    suggestion.take(30) + "…",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                    fontSize = 10.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }

            item {
                Column {
                    Text("الأبعاد والتنسيق", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ASPECT_RATIO_OPTIONS.forEach { ratio ->
                            ChipOption(ratio.labelAr, active = state.aspectRatio == ratio.id, modifier = Modifier.weight(1f)) {
                                viewModel.setAspectRatio(ratio.id)
                            }
                        }
                    }
                }
            }

            item {
                Column {
                    Text("النمط والأسلوب الفني", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(IMAGE_STYLE_OPTIONS) { style ->
                            Surface(
                                color = if (state.style == style.id) BrandTeal.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                                contentColor = if (state.style == style.id) BrandTeal else MaterialTheme.colorScheme.onSurface,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.width(140.dp).clickable { viewModel.setStyle(style.id) }
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text(style.emoji, fontSize = 16.sp)
                                    Text(style.labelAr, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(style.descAr, fontSize = 9.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }

            item {
                Surface(
                    color = BrandTeal,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth().clickable(enabled = !state.isLoading && state.prompt.isNotBlank(), onClick = viewModel::generate)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (state.isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White)
                            Spacer(Modifier.width(8.dp))
                            Text("جاري رسم وتوليد اللوحة...", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        } else {
                            Icon(Icons.Filled.AutoAwesome, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("توليد الصورة الآن", fontWeight = FontWeight.Black, fontSize = 13.sp)
                        }
                    }
                }
            }

            item {
                Column {
                    Text("معاينة الصورة الناتجة", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(240.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            when {
                                state.isLoading -> CircularProgressIndicator(color = BrandTeal)
                                state.currentImage != null -> AsyncImage(
                                    model = state.currentImage,
                                    contentDescription = "الصورة المولّدة",
                                    modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(20.dp)),
                                    contentScale = ContentScale.Fit
                                )
                                else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Filled.Image, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(40.dp))
                                    Spacer(Modifier.height(6.dp))
                                    Text("لم يتم توليد أي صورة بعد", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }

            if (state.currentImage != null) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f).clickable {
                                clipboard.setText(AnnotatedString(state.currentImage!!))
                            }
                        ) {
                            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("نسخ الرابط", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (onImageSelected != null) {
                            Surface(
                                color = BrandTeal,
                                contentColor = Color.White,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f).clickable { onImageSelected(state.currentImage!!) }
                            ) {
                                Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text("استخدام كغلاف للمقال", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            if (state.history.size > 1) {
                item {
                    Column {
                        Text("الصور السابقة في هذه الجلسة", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(6.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(state.history) { url ->
                                AsyncImage(
                                    model = url,
                                    contentDescription = null,
                                    modifier = Modifier
                                        .size(56.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable { viewModel.selectFromHistory(url) },
                                    contentScale = ContentScale.Crop
                                )
                            }
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun ChipOption(label: String, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = if (active) BrandTeal else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        contentColor = if (active) Color.White else MaterialTheme.colorScheme.onSurface,
        shape = RoundedCornerShape(10.dp)
    ) {
        Text(
            label,
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            maxLines = 1
        )
    }
}
