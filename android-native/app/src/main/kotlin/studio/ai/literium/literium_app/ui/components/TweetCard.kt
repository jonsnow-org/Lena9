package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.ModeComment
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.CommentReply
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.TweetComment
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.util.DateFormatAr

/**
 * The short-post ("tweet") card reused across the tweet feed, Explore, and profile screens —
 * full-fidelity port of `src/components/TweetCard.tsx`, including its inline expandable comment
 * thread (composer + flat comment list + one level of replies). Public API mirrors [ArticleCard]'s
 * philosophy: [tweet] + [currentUserId] are the load-bearing identity params; every interaction is
 * an optional callback defaulted to a no-op so a lighter-weight reuse (e.g. a compact profile list)
 * can render a mostly read-only card without wiring the whole comment thread.
 */
@Composable
fun TweetCard(
    tweet: Tweet,
    currentUserId: String,
    isLiked: Boolean,
    isFavorited: Boolean,
    modifier: Modifier = Modifier,
    isAdmin: Boolean = false,
    comments: List<TweetComment> = emptyList(),
    onToggleLike: (String) -> Unit = {},
    onToggleFavorite: (String) -> Unit = {},
    onShare: (Tweet) -> Unit = {},
    onDelete: ((String) -> Unit)? = null,
    onAddComment: (String, String) -> Unit = { _, _ -> },
    onLikeComment: (String, Boolean) -> Unit = { _, _ -> },
    onDeleteComment: ((String) -> Unit)? = null,
    onReplyToComment: (String, String) -> Unit = { _, _ -> },
    onSelectAuthor: ((String) -> Unit)? = null,
    startExpanded: Boolean = false
) {
    var showComments by remember { mutableStateOf(startExpanded) }
    var commentText by remember { mutableStateOf("") }
    var replyingToId by remember { mutableStateOf<String?>(null) }
    var replyText by remember { mutableStateOf("") }

    val canDelete = onDelete != null && (currentUserId == tweet.authorId || isAdmin)

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // ---- Header ----
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Row(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .clickable(enabled = onSelectAuthor != null) { onSelectAuthor?.invoke(tweet.authorId) },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AsyncImage(
                        model = tweet.authorAvatar,
                        contentDescription = tweet.authorName,
                        modifier = Modifier.size(38.dp).clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(tweet.authorName, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            if (tweet.authorRole == UserRole.WRITER) {
                                Surface(color = BrandTeal, contentColor = Color.White, shape = RoundedCornerShape(4.dp)) {
                                    Text(
                                        "الكاتب",
                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                            Text("@${tweet.authorUsername}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(DateFormatAr.timeAgoAr(tweet.createdAt), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                if (canDelete) {
                    IconButton(onClick = { onDelete!!(tweet.id) }, modifier = Modifier.size(40.dp)) {
                        Icon(Icons.Filled.Delete, contentDescription = "حذف", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(tweet.content, fontSize = 14.sp, lineHeight = 20.sp)

            Spacer(modifier = Modifier.height(10.dp))

            // ---- Actions (uniform size/touch-target/color system across all four) ----
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                ActionChip(
                    icon = if (isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    tint = if (isLiked) Color(0xFFE11D48) else MaterialTheme.colorScheme.onSurfaceVariant,
                    label = "${tweet.likesCount}",
                    contentDescription = "إعجاب",
                    onClick = { onToggleLike(tweet.id) }
                )
                ActionChip(
                    icon = Icons.Outlined.ModeComment,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    label = "${tweet.commentsCount}",
                    contentDescription = "التعليقات",
                    onClick = { showComments = !showComments }
                )
                ActionChip(
                    icon = Icons.Filled.Share,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    label = "${tweet.sharesCount}",
                    contentDescription = "مشاركة",
                    onClick = { onShare(tweet) }
                )
                ActionChip(
                    icon = if (isFavorited) Icons.Filled.Star else Icons.Outlined.StarBorder,
                    tint = if (isFavorited) BrandTeal else MaterialTheme.colorScheme.onSurfaceVariant,
                    label = null,
                    contentDescription = "إضافة إلى المفضلة",
                    onClick = { onToggleFavorite(tweet.id) }
                )
            }

            if (showComments) {
                Spacer(modifier = Modifier.height(6.dp))
                androidx.compose.material3.HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = commentText,
                        onValueChange = { commentText = it },
                        placeholder = { Text("اكتب تعليقاً...", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp)
                    )
                    TextButton(onClick = {
                        if (commentText.isNotBlank()) {
                            onAddComment(tweet.id, commentText.trim())
                            commentText = ""
                        }
                    }, enabled = commentText.isNotBlank()) {
                        Text("تعليق", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (comments.isEmpty()) {
                    Text(
                        "لا توجد تعليقات بعد.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                } else {
                    Column(modifier = Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        comments.forEach { comm ->
                            TweetCommentRow(
                                comment = comm,
                                currentUserId = currentUserId,
                                canDelete = onDeleteComment != null && (currentUserId == comm.userId || isAdmin),
                                isReplying = replyingToId == comm.id,
                                replyText = replyText,
                                onReplyTextChange = { replyText = it },
                                onToggleReplying = { replyingToId = if (replyingToId == comm.id) null else comm.id },
                                onLikeComment = onLikeComment,
                                onDeleteComment = { onDeleteComment?.invoke(comm.id) },
                                onSubmitReply = {
                                    if (replyText.isNotBlank()) {
                                        onReplyToComment(comm.id, replyText.trim())
                                        replyText = ""
                                        replyingToId = null
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: Color,
    label: String?,
    contentDescription: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .defaultMinSize(minWidth = 44.dp, minHeight = 40.dp)
            .padding(vertical = 8.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(icon, contentDescription = contentDescription, tint = tint, modifier = Modifier.size(18.dp))
        if (label != null) {
            Spacer(modifier = Modifier.width(5.dp))
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tint)
        }
    }
}

@Composable
private fun TweetCommentRow(
    comment: TweetComment,
    currentUserId: String,
    canDelete: Boolean,
    isReplying: Boolean,
    replyText: String,
    onReplyTextChange: (String) -> Unit,
    onToggleReplying: () -> Unit,
    onLikeComment: (String, Boolean) -> Unit,
    onDeleteComment: () -> Unit,
    onSubmitReply: () -> Unit
) {
    val likedByMe = comment.likedBy?.contains(currentUserId) == true
    var confirmingDelete by remember { mutableStateOf(false) }
    if (confirmingDelete) {
        AlertDialog(
            onDismissRequest = { confirmingDelete = false },
            title = { Text("حذف التعليق") },
            text = { Text("هل تريد حذف هذا التعليق نهائياً؟") },
            confirmButton = {
                TextButton(onClick = { onDeleteComment(); confirmingDelete = false }) {
                    Text("حذف", color = Color(0xFFE11D48))
                }
            },
            dismissButton = { TextButton(onClick = { confirmingDelete = false }) { Text("إلغاء") } }
        )
    }
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AsyncImage(
                    model = comment.userAvatar,
                    contentDescription = comment.userName,
                    modifier = Modifier.size(22.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
                Text(comment.userName, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text(DateFormatAr.timeAgoAr(comment.createdAt), fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(comment.content, fontSize = 11.sp, lineHeight = 15.sp)
            Spacer(modifier = Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { onLikeComment(comment.id, !likedByMe) }
                        .defaultMinSize(minHeight = 32.dp)
                        .padding(horizontal = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Icon(
                        if (likedByMe) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = "إعجاب بالتعليق",
                        tint = if (likedByMe) Color(0xFFE11D48) else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Text("${comment.likesCount}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = onToggleReplying)
                        .defaultMinSize(minHeight = 32.dp)
                        .padding(horizontal = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Icon(Icons.AutoMirrored.Filled.Reply, contentDescription = "رد على التعليق", tint = BrandTeal, modifier = Modifier.size(14.dp))
                    Text("رد", fontSize = 10.sp, fontWeight = FontWeight.Medium, color = BrandTeal)
                }
                if (canDelete) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { confirmingDelete = true }
                            .defaultMinSize(minHeight = 32.dp)
                            .padding(horizontal = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Icon(Icons.Filled.Delete, contentDescription = "حذف التعليق", tint = Color(0xFFE11D48), modifier = Modifier.size(14.dp))
                        Text("حذف", fontSize = 10.sp, fontWeight = FontWeight.Medium, color = Color(0xFFE11D48))
                    }
                }
            }

            if (isReplying) {
                Spacer(modifier = Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedTextField(
                        value = replyText,
                        onValueChange = onReplyTextChange,
                        placeholder = { Text("رد على ${comment.userName}...", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 11.sp)
                    )
                    TextButton(onClick = onSubmitReply, enabled = replyText.isNotBlank()) {
                        Text("إرسال", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            val replies = comment.replies
            if (replies.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    replies.forEach { rep -> TweetReplyRow(rep) }
                }
            }
        }
    }
}

@Composable
private fun TweetReplyRow(reply: CommentReply) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(10.dp)) {
        Column(modifier = Modifier.padding(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                AsyncImage(
                    model = reply.userAvatar,
                    contentDescription = reply.userName,
                    modifier = Modifier.size(18.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
                Text(reply.userName, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                if (reply.userRole == UserRole.WRITER) {
                    Surface(color = BrandTeal, contentColor = Color.White, shape = RoundedCornerShape(4.dp)) {
                        Text("الكاتب", modifier = Modifier.padding(horizontal = 4.dp), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Text(DateFormatAr.timeAgoAr(reply.createdAt), fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(modifier = Modifier.height(3.dp))
            Text(reply.content, fontSize = 10.sp)
        }
    }
}
