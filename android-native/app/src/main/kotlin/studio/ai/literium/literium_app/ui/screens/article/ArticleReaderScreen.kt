package studio.ai.literium.literium_app.ui.screens.article

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.data.model.Comment
import studio.ai.literium.literium_app.data.model.ReactionType
import studio.ai.literium.literium_app.ui.ads.AdSlot
import studio.ai.literium.literium_app.ui.components.HtmlContent
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.util.DateFormatAr
import studio.ai.literium.literium_app.util.RevenueShares
import studio.ai.literium.literium_app.ui.components.articleCategoryLabelAr

/**
 * The article-detail reading screen (spec §4.4) — full-fidelity port of `src/components/
 * ArticleReader.tsx`: locked-article paywall + unlock purchase flow, like/bookmark/follow, star
 * rating, emotional reactions, and the full comment thread (top-level + one level of replies). The
 * body is rendered with [HtmlContent] (Jsoup tag-mapping to native Compose widgets) — never a
 * WebView, per the whole point of this rewrite.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleReaderScreen(
    articleId: String,
    onBack: () -> Unit,
    onWriterClick: (String) -> Unit
) {
    val viewModel: ArticleReaderViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(articleId) { viewModel.load(articleId) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("قراءة المقال", fontSize = 15.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") }
                },
                actions = {
                    IconButton(onClick = viewModel::toggleBookmark) {
                        Icon(
                            if (state.isBookmarked) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                            contentDescription = "حفظ",
                            tint = if (state.isBookmarked) BrandTeal else MaterialTheme.colorScheme.onSurface
                        )
                    }
                    IconButton(onClick = {
                        val article = state.article ?: return@IconButton
                        val sendIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(android.content.Intent.EXTRA_TEXT, "${article.title}\n\n${article.description}")
                        }
                        context.startActivity(android.content.Intent.createChooser(sendIntent, null))
                        viewModel.shareArticle()
                    }) {
                        Icon(Icons.Filled.Share, contentDescription = "مشاركة")
                    }
                }
            )
        }
    ) { padding ->
        when {
            state.isLoading -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandTeal)
            }
            state.notFound || state.article == null -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("تعذر العثور على هذا المقال.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            else -> ArticleReaderBody(state, viewModel, padding, onWriterClick)
        }
    }
}

@Composable
private fun ArticleReaderBody(
    state: ArticleReaderUiState,
    viewModel: ArticleReaderViewModel,
    padding: PaddingValues,
    onWriterClick: (String) -> Unit
) {
    val article = state.article!!
    val isLocked = article.isLocked && !state.isUnlocked
    var commentText by remember { mutableStateOf("") }
    var replyingToId by remember { mutableStateOf<String?>(null) }
    var replyText by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(color = BrandTeal.copy(alpha = 0.1f), contentColor = BrandTeal, shape = RoundedCornerShape(50)) {
                    Text(articleCategoryLabelAr(article.category), modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                if (article.isLocked) {
                    Surface(color = BrandAmber.copy(alpha = 0.15f), contentColor = Color(0xFFB45309), shape = RoundedCornerShape(50)) {
                        Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.size(12.dp))
                            Text("مقال حصري مدفوع (${article.lockedPrice ?: 2.99}$)", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    Icon(Icons.Filled.RemoveRedEye, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(13.dp))
                    Text("${article.viewsCount} قراءة", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        item { Text(article.title, fontSize = 22.sp, fontWeight = FontWeight.Black, lineHeight = 28.sp) }

        item {
            Text(
                article.description,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BrandTeal.copy(alpha = 0.05f))
                    .padding(10.dp)
            )
        }

        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        modifier = Modifier.weight(1f).clickable { onWriterClick(article.writerId) },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        AsyncImage(
                            model = article.writerAvatar,
                            contentDescription = article.writerName,
                            modifier = Modifier.size(46.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(article.writerName, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                if (article.writerIsVerified) Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(14.dp))
                            }
                            Text(
                                "نُشر في ${DateFormatAr.formatDateTimeAr(article.publishedAt)} (${DateFormatAr.timeAgoAr(article.publishedAt)}) • ${article.readingTimeMinutes} د",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    if (state.currentUserId != null && state.currentUserId != article.writerId) {
                        Surface(
                            color = if (state.isFollowingWriter) MaterialTheme.colorScheme.surfaceVariant else BrandTeal,
                            contentColor = if (state.isFollowingWriter) MaterialTheme.colorScheme.onSurfaceVariant else Color.White,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.clickable(onClick = viewModel::toggleFollowWriter)
                        ) {
                            Text(
                                if (state.isFollowingWriter) "تتابعه" else "+ متابعة",
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        item {
            AsyncImage(
                model = article.featuredImage,
                contentDescription = article.title,
                modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(20.dp)),
                contentScale = ContentScale.Crop
            )
        }

        if (isLocked) {
            item { LockedArticleTeaser(price = article.lockedPrice ?: 2.99, writerName = article.writerName, state = state, viewModel = viewModel) }
        } else {
            item { HtmlContent(html = article.content) }

            // Not `remember { }`: this branch runs directly inside LazyListScope's builder DSL (not
            // an @Composable context) — only the `item { }` blocks around it are, so `remember` can't
            // be called here. The computation itself is cheap enough that recomputing it on every
            // recomposition of this scope is fine.
            val wordCount = org.jsoup.Jsoup.parse(article.content).text().split(Regex("\\s+")).count { it.isNotBlank() }
            if (wordCount >= 500) {
                item { AdSlot(slotId = AdSlotId.ARTICLE_MID) }
            }

            item { AdSlot(slotId = AdSlotId.ARTICLE_BOTTOM) }
        }

        if (article.tags.isNotEmpty()) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    article.tags.forEach { tag ->
                        Surface(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), shape = RoundedCornerShape(8.dp)) {
                            Text("#$tag", modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        item { ReactionsAndRatingBar(state, viewModel) }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Row(
                    modifier = Modifier.clickable(onClick = viewModel::toggleLike),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        if (state.isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = null,
                        tint = if (state.isLiked) Color(0xFFE11D48) else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text("${article.likesCount} إعجاب", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            HorizontalDivider(modifier = Modifier.padding(top = 10.dp))
        }

        item {
            Text("التعليقات والمناقشات (${state.comments.size})", fontSize = 15.sp, fontWeight = FontWeight.Black)
        }

        if (state.currentUserId != null) {
            item {
                Column {
                    OutlinedTextField(
                        value = commentText,
                        onValueChange = { commentText = it },
                        placeholder = { Text("أضف رأيك أو سؤالك حول المقال...", fontSize = 12.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                    Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.End) {
                        TextButton(
                            onClick = {
                                if (commentText.isNotBlank()) {
                                    viewModel.addComment(commentText)
                                    commentText = ""
                                }
                            },
                            enabled = commentText.isNotBlank()
                        ) {
                            Text("نشر التعليق", fontWeight = FontWeight.Bold)
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }
        }

        state.comments.forEachIndexed { idx, comment ->
            if (idx == 3 && state.comments.size >= 5) {
                item { AdSlot(slotId = AdSlotId.COMMENTS_FEED) }
            }
            item {
                CommentRow(
                    comment = comment,
                    currentUserId = state.currentUserId,
                    isReplying = replyingToId == comment.id,
                    replyText = replyText,
                    onReplyTextChange = { replyText = it },
                    onToggleReply = { replyingToId = if (replyingToId == comment.id) null else comment.id },
                    onLike = { viewModel.likeComment(comment.id) },
                    onSubmitReply = {
                        if (replyText.isNotBlank()) {
                            viewModel.replyToComment(comment.id, replyText)
                            replyText = ""
                            replyingToId = null
                        }
                    }
                )
            }
        }

        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun LockedArticleTeaser(price: Double, writerName: String, state: ArticleReaderUiState, viewModel: ArticleReaderViewModel) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BrandAmber.copy(alpha = 0.08f), RoundedCornerShape(24.dp))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(CircleShape).background(BrandAmber),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Filled.Lock, contentDescription = null, tint = Color(0xFF0F172A))
        }
        Spacer(Modifier.height(12.dp))
        Text("هذا المحتوى حصري ومقفول", fontSize = 17.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(6.dp))
        Text(
            "ادعم الكاتب $writerName لفتح باقي المقال بالكامل مقابل دفعة واحدة بدون اشتراكات دورية.",
            fontSize = 12.sp,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(16.dp))

        if (state.unlockError != null) {
            Text(state.unlockError, fontSize = 11.sp, color = Color(0xFFE11D48), modifier = Modifier.padding(bottom = 8.dp))
        }

        Surface(
            color = BrandAmber,
            contentColor = Color(0xFF0F172A),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.clickable(enabled = !state.isUnlocking, onClick = viewModel::unlockArticle)
        ) {
            Row(modifier = Modifier.padding(horizontal = 24.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.isUnlocking) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF0F172A))
                }
                Text(if (state.isUnlocking) "جارٍ فتح المقال..." else "فتح المقال مقابل $price$ فقط", fontWeight = FontWeight.Black, fontSize = 13.sp)
            }
        }

        Spacer(Modifier.height(10.dp))
        Text(
            "توزيع العوائد: ${RevenueShares.LOCKED_ARTICLES.writerPercent}% مباشرة للكاتب • ${RevenueShares.LOCKED_ARTICLES.platformPercent}% رسم المنصة",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private val REACTIONS = listOf(
    ReactionType.LOVE to "❤️" to "أحببته",
    ReactionType.INSIGHTFUL to "💡" to "ملهم ومفيد",
    ReactionType.FUNNY to "😂" to "طريف",
    ReactionType.SURPRISED to "😲" to "مدهش",
    ReactionType.SAD to "😢" to "مؤثر"
)

@Composable
private fun ReactionsAndRatingBar(state: ArticleReaderUiState, viewModel: ArticleReaderViewModel) {
    val article = state.article ?: return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f), RoundedCornerShape(20.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("ما هو انطباعك عن هذا المقال؟", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            REACTIONS.forEach { (typeEmoji, label) ->
                val (type, emoji) = typeEmoji
                val active = state.activeReaction == type
                Surface(
                    color = if (active) BrandTeal else MaterialTheme.colorScheme.surface,
                    contentColor = if (active) Color.White else MaterialTheme.colorScheme.onSurface,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.clickable { viewModel.setReaction(type) }
                ) {
                    Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(emoji, fontSize = 14.sp)
                        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (state.currentUserId != null) {
            HorizontalDivider()
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("تقييم المقال:", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(6.dp))
                (1..5).forEach { star ->
                    Icon(
                        if (star <= state.myRating) Icons.Filled.Star else Icons.Outlined.StarBorder,
                        contentDescription = null,
                        tint = BrandAmber,
                        modifier = Modifier.size(20.dp).clickable { viewModel.rate(star) }
                    )
                }
                Spacer(Modifier.weight(1f))
                Text(
                    if (article.ratingsCount > 0) "${"%.1f".format(article.rating)} ★ من ${article.ratingsCount}" else "كن أول من يقيّم",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun CommentRow(
    comment: Comment,
    currentUserId: String?,
    isReplying: Boolean,
    replyText: String,
    onReplyTextChange: (String) -> Unit,
    onToggleReply: () -> Unit,
    onLike: () -> Unit,
    onSubmitReply: () -> Unit
) {
    val likedByMe = currentUserId != null && comment.likedBy?.contains(currentUserId) == true
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = if (comment.isPinned == true) BrandTeal.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AsyncImage(
                    model = comment.userAvatar,
                    contentDescription = comment.userName,
                    modifier = Modifier.size(30.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
                Column(Modifier.weight(1f)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(comment.userName, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        if (comment.isWriter == true) {
                            Surface(color = BrandTeal, contentColor = Color.White, shape = RoundedCornerShape(4.dp)) {
                                Text("الكاتب", modifier = Modifier.padding(horizontal = 4.dp), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Text(DateFormatAr.timeAgoAr(comment.createdAt), fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (comment.isPinned == true) {
                    Text("📌 مثبت", fontSize = 9.sp, color = BrandTeal, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(6.dp))
            Text(comment.content, fontSize = 12.sp, lineHeight = 17.sp)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(modifier = Modifier.clickable(onClick = onLike), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(
                        if (likedByMe) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = null,
                        tint = if (likedByMe) Color(0xFFE11D48) else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Text("${comment.likesCount}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(modifier = Modifier.clickable(onClick = onToggleReply), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Reply, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(14.dp))
                    Text("رد", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = BrandTeal)
                }
            }

            if (isReplying) {
                Row(modifier = Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = replyText,
                        onValueChange = onReplyTextChange,
                        placeholder = { Text("رد على ${comment.userName}...", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = onSubmitReply, enabled = replyText.isNotBlank()) { Text("إرسال") }
                }
            }

            if (comment.replies.isNotEmpty()) {
                Column(modifier = Modifier.padding(top = 8.dp, start = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    comment.replies.forEach { reply ->
                        Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(12.dp)) {
                            Column(Modifier.padding(8.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    AsyncImage(
                                        model = reply.userAvatar,
                                        contentDescription = reply.userName,
                                        modifier = Modifier.size(20.dp).clip(CircleShape),
                                        contentScale = ContentScale.Crop
                                    )
                                    Text(reply.userName, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    Text(DateFormatAr.timeAgoAr(reply.createdAt), fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Spacer(Modifier.height(3.dp))
                                Text(reply.content, fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
