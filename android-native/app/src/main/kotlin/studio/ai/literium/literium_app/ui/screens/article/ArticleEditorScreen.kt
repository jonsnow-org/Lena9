package studio.ai.literium.literium_app.ui.screens.article

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Title
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.ArticleCategory
import studio.ai.literium.literium_app.data.model.ArticleStatus
import studio.ai.literium.literium_app.ui.components.HtmlContent
import studio.ai.literium.literium_app.ui.components.articleCategoryLabelAr
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.util.RevenueShares

/**
 * The article authoring screen (spec §4.5) — create/edit, backed by [ArticleEditorViewModel].
 *
 * Rich-text note (see final report for the full gap writeup): Compose has no native rich-text
 * editor, so the body is a plain backing `String` (as [Article.content] already is — raw HTML, not
 * Markdown) manipulated by a pragmatic formatting toolbar that wraps the current text-field
 * selection in the corresponding HTML tag (bold/italic/heading/bullet-list/numbered-list), with a
 * live [HtmlContent] preview rendered directly below the editor so the writer sees the real
 * tag-mapped output, not a guess.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleEditorScreen(
    articleId: String?,
    onBack: () -> Unit,
    onSaved: (String) -> Unit,
    onOpenImageStudio: () -> Unit,
    /** Image Studio's `onImageSelected` result, delivered back via the NavBackStackEntry's
     *  `SavedStateHandle` (see `LiteriumNavHost.kt`) — applied as the article's cover image the moment
     *  it arrives, since Compose Navigation preserves this screen's own [viewModel] instance across the
     *  push-to-ImageStudio-and-pop-back round trip. */
    selectedImageUrl: String? = null
) {
    val viewModel: ArticleEditorViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(articleId) { viewModel.load(articleId) }
    LaunchedEffect(state.savedArticleId) { state.savedArticleId?.let(onSaved) }
    LaunchedEffect(selectedImageUrl) { selectedImageUrl?.let { viewModel.setFeaturedImageUrl(it) } }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.uploadCoverImage(uri)
    }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.uploadArticleVideo(uri)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (state.isEditingExisting) "تعديل المقال" else "استوديو كتابة ونشر المقالات", fontSize = 14.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") } }
            )
        }
    ) { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = BrandTeal) }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text("${state.wordCount} كلمة", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (state.submitError != null) {
                item { ErrorBanner(state.submitError!!) }
            }

            // ---- AI writing-assistant toolbar (7 tools) ----
            item { AiToolbar(state, viewModel) }

            if (state.isAiLoading) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = BrandTeal)
                        Text("جاري صياغة وتحليل النص باستخدام Gemini AI...", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            if (state.aiError != null) { item { ErrorBanner(state.aiError!!) } }
            if (state.aiOutput != null) { item { AiOutputCard(state.aiOutput!!, onApply = viewModel::applyAiOutput, onDismiss = viewModel::dismissAiOutput) } }

            // ---- Title ----
            item {
                Column {
                    Text("عنوان المقال *", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = state.title,
                        onValueChange = viewModel::setTitle,
                        placeholder = { Text("اكتب عنواناً أدبياً جاذباً وملهماً...") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // ---- Category + tags + SEO generator ----
            item { CategoryAndTagsSection(state, viewModel) }

            // ---- Cover image / video ----
            item { CoverMediaSection(state, viewModel, onOpenImageStudio, imagePicker, videoPicker) }

            // ---- Description ----
            item {
                Column {
                    Text("الوصف القصير والمقدمة", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = state.description,
                        onValueChange = viewModel::setDescription,
                        placeholder = { Text("موجز جذاب يعبر عن جوهر المقال...") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                }
            }

            // ---- Body + formatting toolbar ----
            item {
                Column {
                    Text("محتوى المقال الكامل *", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    FormattingToolbar(viewModel)
                    OutlinedTextField(
                        value = state.content,
                        onValueChange = viewModel::setContent,
                        placeholder = { Text("اكتب أفكارك بتأنٍ وبلاغة... استخدم شريط التنسيق أعلاه أو أدوات الذكاء الاصطناعي.") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 10
                    )
                }
            }

            // ---- Live preview ----
            item {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Filled.Visibility, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(15.dp))
                        Text("معاينة حية", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(6.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Box(modifier = Modifier.padding(14.dp)) {
                            if (state.content.text.isBlank()) {
                                Text("اكتب محتوى المقال لتشاهد المعاينة الحية هنا...", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            } else {
                                HtmlContent(html = state.content.text)
                            }
                        }
                    }
                }
            }

            // ---- Monetization / locking ----
            item { MonetizationSection(state, viewModel) }

            // ---- Footer actions ----
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TextButton(
                        onClick = { viewModel.save(ArticleStatus.DRAFT) },
                        enabled = !state.isSubmitting,
                        modifier = Modifier.weight(1f)
                    ) { Text("حفظ كمسودة") }

                    Surface(
                        modifier = Modifier.weight(1f).clickable(enabled = !state.isSubmitting) { viewModel.save(ArticleStatus.PUBLISHED) },
                        color = BrandTeal,
                        contentColor = Color.White,
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (state.isSubmitting) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                                Spacer(Modifier.width(8.dp))
                            }
                            Text(if (state.isEditingExisting) "حفظ التعديلات" else "نشر المقال للجمهور", fontWeight = FontWeight.Black, fontSize = 13.sp)
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun ErrorBanner(message: String) {
    Surface(color = Color(0xFFE11D48).copy(alpha = 0.1f), contentColor = Color(0xFFE11D48), shape = RoundedCornerShape(12.dp)) {
        Text(message, modifier = Modifier.padding(10.dp), fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun AiToolbar(state: ArticleEditorUiState, viewModel: ArticleEditorViewModel) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = BrandAmber, modifier = Modifier.size(15.dp))
            Text("أدوات الذكاء الاصطناعي (Gemini):", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
        }
        Spacer(Modifier.height(6.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(AiWritingTool.ALL) { action ->
                Surface(
                    color = BrandTeal.copy(alpha = 0.08f),
                    contentColor = BrandTeal,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.clickable(enabled = !state.isAiLoading) { viewModel.runAiTool(action) }
                ) {
                    Text(AiWritingTool.labelAr(action), modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun AiOutputCard(output: String, onApply: () -> Unit, onDismiss: () -> Unit) {
    Surface(color = BrandTeal.copy(alpha = 0.08f), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("النتيجة المقترحة من الذكاء الاصطناعي:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = onApply) {
                        Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(14.dp))
                        Text("تطبيق", fontSize = 11.sp)
                    }
                    TextButton(onClick = onDismiss) { Text("تجاهل", fontSize = 11.sp) }
                }
            }
            Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(10.dp)) {
                Text(output, modifier = Modifier.padding(10.dp), fontSize = 11.sp, lineHeight = 17.sp)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryAndTagsSection(state: ArticleEditorUiState, viewModel: ArticleEditorViewModel) {
    var expanded by remember { mutableStateOf(false) }
    Surface(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("التصنيف والوسوم الذكية (SEO)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                TextButton(onClick = viewModel::generateAiSeo, enabled = !state.isSeoLoading) {
                    if (state.isSeoLoading) CircularProgressIndicator(modifier = Modifier.size(13.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = BrandAmber, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("توليد وسوم وسيو ذكي", fontSize = 11.sp)
                }
            }

            if (state.seoSuccess != null) {
                Text(state.seoSuccess, fontSize = 11.sp, color = BrandTeal, fontWeight = FontWeight.Medium)
            }

            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                OutlinedTextField(
                    value = articleCategoryLabelAr(state.category),
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("التصنيف الرئيسي", fontSize = 11.sp) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true)
                )
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    ArticleCategory.ALL.forEach { cat ->
                        DropdownMenuItem(text = { Text(articleCategoryLabelAr(cat)) }, onClick = { viewModel.setCategory(cat); expanded = false })
                    }
                }
            }

            OutlinedTextField(
                value = state.tagsInput,
                onValueChange = viewModel::setTagsInput,
                label = { Text("الوسوم (مفصولة بفواصل)", fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun CoverMediaSection(
    state: ArticleEditorUiState,
    viewModel: ArticleEditorViewModel,
    onOpenImageStudio: () -> Unit,
    imagePicker: androidx.activity.compose.ManagedActivityResultLauncher<androidx.activity.result.PickVisualMediaRequest, android.net.Uri?>,
    videoPicker: androidx.activity.compose.ManagedActivityResultLauncher<androidx.activity.result.PickVisualMediaRequest, android.net.Uri?>
) {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("صورة غلاف المقال", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                TextButton(onClick = onOpenImageStudio) {
                    Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = BrandAmber, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("توليد غلاف بالذكاء الاصطناعي", fontSize = 11.sp)
                }
            }

            AsyncImage(
                model = state.featuredImage,
                contentDescription = null,
                modifier = Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(14.dp)),
                contentScale = ContentScale.Crop
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { imagePicker.launch(androidx.activity.result.PickVisualMediaRequest(androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia.ImageOnly)) }, enabled = !state.isUploadingImage) {
                    if (state.isUploadingImage) CircularProgressIndicator(modifier = Modifier.size(13.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Filled.CloudUpload, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("رفع صورة من الجهاز", fontSize = 11.sp)
                }
            }

            OutlinedTextField(
                value = state.featuredImage,
                onValueChange = viewModel::setFeaturedImageUrl,
                label = { Text("أو رابط الصورة مباشرة", fontSize = 10.sp) },
                modifier = Modifier.fillMaxWidth()
            )

            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(COVER_IMAGE_PRESETS) { (label, url) ->
                    Surface(
                        color = if (state.featuredImage == url) BrandTeal else MaterialTheme.colorScheme.surface,
                        contentColor = if (state.featuredImage == url) Color.White else MaterialTheme.colorScheme.onSurface,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.clickable { viewModel.selectPresetCover(url) }
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            AsyncImage(model = url, contentDescription = null, modifier = Modifier.size(16.dp).clip(RoundedCornerShape(4.dp)), contentScale = ContentScale.Crop)
                            Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            HorizontalDivider()

            Text("فيديو المقال (اختياري)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            TextButton(onClick = { videoPicker.launch(androidx.activity.result.PickVisualMediaRequest(androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia.VideoOnly)) }, enabled = !state.isUploadingVideo) {
                if (state.isUploadingVideo) CircularProgressIndicator(modifier = Modifier.size(13.dp), strokeWidth = 2.dp)
                else Icon(Icons.Filled.CloudUpload, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(if (state.uploadedVideoUrl.isNotBlank()) "تم رفع فيديو — رفع فيديو آخر" else "رفع فيديو من الجهاز", fontSize = 11.sp)
            }
            OutlinedTextField(
                value = state.videoUrl,
                onValueChange = viewModel::setVideoUrl,
                label = { Text("أو رابط تضمين (يوتيوب/Vimeo)", fontSize = 10.sp) },
                modifier = Modifier.fillMaxWidth()
            )

            if (state.uploadError != null) {
                Text(state.uploadError, fontSize = 10.sp, color = Color(0xFFE11D48))
            }

            OutlinedTextField(
                value = state.sourceUrl,
                onValueChange = viewModel::setSourceUrl,
                label = { Text("رابط مرجعي/مصدر (اختياري)", fontSize = 10.sp) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun FormattingToolbar(viewModel: ArticleEditorViewModel) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        ToolbarButton(Icons.Filled.FormatBold, "غامق") { viewModel.applyInlineTag("<b>", "</b>") }
        ToolbarButton(Icons.Filled.FormatItalic, "مائل") { viewModel.applyInlineTag("<i>", "</i>") }
        ToolbarButton(Icons.Filled.Title, "عنوان") { viewModel.applyHeading() }
        ToolbarButton(Icons.Filled.FormatListBulleted, "قائمة نقطية") { viewModel.applyListTag(ordered = false) }
        ToolbarButton(Icons.Filled.FormatListNumbered, "قائمة مرقمة") { viewModel.applyListTag(ordered = true) }
    }
}

@Composable
private fun ToolbarButton(icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, onClick: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Icon(icon, contentDescription = description, modifier = Modifier.padding(8.dp).size(16.dp))
    }
}

@Composable
private fun MonetizationSection(state: ArticleEditorUiState, viewModel: ArticleEditorViewModel) {
    Surface(color = BrandAmber.copy(alpha = 0.08f), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = BrandAmber)
                Column {
                    Text("نمط النشر وتحقيق الأرباح", fontSize = 12.sp, fontWeight = FontWeight.Black)
                    Text(
                        "المجاني يربح ${RevenueShares.IN_ARTICLE_ADS.writerPercent}% من عوائد الإعلانات • المقفول يربح ${RevenueShares.LOCKED_ARTICLES.writerPercent}% من قيمة الشراء",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChoiceChip("مجاني للجميع", active = !state.isLocked) { viewModel.setLocked(false) }
                ChoiceChip("مقفول مدفوع", active = state.isLocked) { viewModel.setLocked(true) }
            }

            if (state.isLocked) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("السعر:", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    listOf(1.0, 2.5, 3.0, 5.0, 10.0).forEach { price ->
                        ChoiceChip("$${"%.2f".format(price)}", active = state.lockedPrice == price) { viewModel.setLockedPrice(price) }
                    }
                }
                Text(
                    "صافي أرباحك لكل قارئ: $${"%.2f".format(state.lockedPrice * RevenueShares.LOCKED_ARTICLES.writer)}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = BrandTeal
                )
            }
        }
    }
}

@Composable
private fun ChoiceChip(label: String, active: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (active) BrandTeal else MaterialTheme.colorScheme.surface,
        contentColor = if (active) Color.White else MaterialTheme.colorScheme.onSurface,
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Text(label, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}
