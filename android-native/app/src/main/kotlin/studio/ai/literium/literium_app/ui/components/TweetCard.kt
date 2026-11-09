package studio.ai.literium.literium_app.ui.components

import android.content.Intent
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.CommentReply
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.TweetComment
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.repository.MessageRepository
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.mixColors
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr
import studio.ai.literium.literium_app.util.uploadTweetImage

private enum class Tone { Rose, Brand, Sky, Amber }

/**
 * بطاقة التغريدة — نسخة طبق الأصل من TweetCard.tsx: p-4 rounded-2xl بإطار slate-200 وفواصل space-y-3،
 * رأس (صورة دائرية 40dp + اسم/شارة الكاتب/@معرّف/وقت) وقائمة ثلاث نقاط، نص sm، وسائط، صف أزرار
 * إجراءات ملوّنة (إعجاب ورد/تعليق سماوي/مشاركة/مفضلة) بتدرّج عمودي، وخيط تعليقات قابل للطي.
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
    onAddComment: (String, String, String?) -> Unit = { _, _, _ -> },
    onLikeComment: (String, Boolean) -> Unit = { _, _ -> },
    onDeleteComment: ((String) -> Unit)? = null,
    onReplyToComment: (String, String) -> Unit = { _, _ -> },
    onSelectAuthor: ((String) -> Unit)? = null,
    startExpanded: Boolean = false
) {
    var showComments by remember { mutableStateOf(startExpanded) }
    var commentText by remember { mutableStateOf("") }
    var commentImageUrl by remember { mutableStateOf<String?>(null) }
    var commentImageUploading by remember { mutableStateOf(false) }
    var commentImageError by remember { mutableStateOf<String?>(null) }
    var replyingToId by remember { mutableStateOf<String?>(null) }
    var replyText by remember { mutableStateOf("") }
    var showMenu by remember { mutableStateOf(false) }
    var showReport by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dark = isDark
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        commentImageError = null
        commentImageUploading = true
        scope.launch {
            uploadTweetImage(context, uri).fold(
                onSuccess = { url -> commentImageUploading = false; commentImageUrl = url },
                onFailure = { e -> commentImageUploading = false; commentImageError = e.message ?: "تعذّر رفع الصورة." }
            )
        }
    }
    val canDelete = onDelete != null && (currentUserId == tweet.authorId || isAdmin)
    val shareUrl = "https://literium.ai.studio/?tweet=${tweet.id}"
    fun doShare() {
        onShare(tweet)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "تغريدة ${tweet.authorName}")
            putExtra(Intent.EXTRA_TEXT, (tweet.content.take(200).ifBlank { "شاهد هذه التغريدة على ليتيريوم" }) + "\n" + shareUrl)
        }
        context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier = modifier.fillMaxWidth()
            .shadow(1.dp, shape, clip = false)
            .clip(shape).background(if (dark) Tw.slate900 else Tw.white)
            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // ── الرأس
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Row(
                Modifier.weight(1f, fill = false).twClickable(enabled = onSelectAuthor != null) { onSelectAuthor?.invoke(tweet.authorId) },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                AsyncImage(tweet.authorAvatar, tweet.authorName, Modifier.size(40.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                Column(Modifier.weight(1f, fill = false)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(tweet.authorName, style = twText(14, FontWeight.Bold, 20), color = if (dark) Tw.white else Tw.slate900, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                        if (tweet.authorRole == UserRole.WRITER) {
                            Text("الكاتب", Modifier.clip(RoundedCornerShape(4.dp)).background(Tw.teal600).padding(horizontal = 6.dp, vertical = 1.dp), style = twText(9, FontWeight.Bold, 13), color = Tw.white)
                        }
                        Text("@${tweet.authorUsername}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1)
                    }
                    Text(DateFormatAr.timeAgoAr(tweet.createdAt), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
                }
            }
            // قائمة النقاط الثلاث
            Box {
                Box(
                    Modifier.clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate100)
                        .border(1.dp, if (dark) Tw.slate700.copy(alpha = 0.60f) else Tw.slate200, RoundedCornerShape(12.dp))
                        .twClickable(pressScale = 0.90f) { showMenu = !showMenu }.padding(8.dp)
                ) { LuIcon(Lu.MoreVertical, 16.dp, Tw.slate400) }
                DropdownMenu(
                    expanded = showMenu, onDismissRequest = { showMenu = false },
                    modifier = Modifier.width(192.dp).background(if (dark) Tw.slate800 else Tw.white),
                    shape = RoundedCornerShape(16.dp),
                    containerColor = if (dark) Tw.slate800 else Tw.white,
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (dark) Tw.slate700 else Tw.slate200)
                ) {
                    MenuItem(Lu.UserCircle2, "عرض الملف الشخصي", if (dark) Tw.slate200 else Tw.slate700) { showMenu = false; onSelectAuthor?.invoke(tweet.authorId) }
                    MenuItem(Lu.Share2, "مشاركة", if (dark) Tw.slate200 else Tw.slate700) { showMenu = false; doShare() }
                    if (currentUserId != tweet.authorId) MenuItem(Lu.Flag, "إبلاغ", Tw.amber600) { showMenu = false; showReport = true }
                    if (canDelete) {
                        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate700 else Tw.slate100))
                        MenuItem(Lu.Trash2, "حذف", Tw.rose600) { showMenu = false; onDelete?.invoke(tweet.id) }
                    }
                }
            }
        }

        if (showReport) ReportDialog(tweet = tweet, reporterId = currentUserId) { showReport = false }

        // ── المحتوى
        if (tweet.content.isNotEmpty()) {
            Text(tweet.content, style = twText(14, FontWeight.Normal, 23), color = if (dark) Tw.slate100 else Tw.slate800)
        }
        tweet.imageUrl?.let { url ->
            val ms = RoundedCornerShape(12.dp)
            if (tweet.mediaType == "video") {
                VideoPlayer(src = url, modifier = Modifier.fillMaxWidth().heightIn(max = 384.dp).clip(ms).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, ms))
            } else {
                AsyncImage(url, null, Modifier.fillMaxWidth().heightIn(max = 384.dp).clip(ms).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, ms), contentScale = ContentScale.Crop)
            }
        }

        // ── الإجراءات: pt-1 border-t
        Column {
            Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate100))
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                ActionBtn(Tone.Rose, isLiked, Lu.Heart, arNumPlain(tweet.likesCount), filled = isLiked) { onToggleLike(tweet.id) }
                ActionBtn(Tone.Brand, showComments, Lu.MessageSquare, arNumPlain(tweet.commentsCount)) { showComments = !showComments }
                ActionBtn(Tone.Sky, false, Lu.Share2, arNumPlain(tweet.sharesCount)) { doShare() }
                ActionBtn(Tone.Amber, isFavorited, Lu.Star, null, filled = isFavorited) { onToggleFavorite(tweet.id) }
            }
        }

        // ── خيط التعليقات
        if (showComments) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate100))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.clip(RoundedCornerShape(8.dp)).twClickable(enabled = !commentImageUploading, pressScale = 0.90f) { picker.launch("image/*") }.padding(8.dp)) {
                            if (commentImageUploading) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = brand.s500)
                            else LuIcon(Lu.Paperclip, 16.dp, Tw.slate400)
                        }
                        SmallField(commentText, { commentText = it }, "اكتب تعليقاً...", Modifier.weight(1f))
                        val enabled = commentText.isNotBlank() && !commentImageUploading
                        Box(
                            Modifier.clip(RoundedCornerShape(12.dp)).background(brand.s600.copy(alpha = if (enabled) 1f else 0.4f))
                                .twClickable(enabled = enabled, pressScale = 0.90f) {
                                    onAddComment(tweet.id, commentText.trim(), commentImageUrl)
                                    commentText = ""; commentImageUrl = null; commentImageError = null; showComments = true
                                }.padding(horizontal = 12.dp, vertical = 6.dp)
                        ) { Text("تعليق", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
                    }
                    if (commentImageUploading) Text("جاري رفع الصورة...", Modifier.padding(start = 4.dp), style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                    commentImageUrl?.let { url ->
                        Box(Modifier.padding(start = 32.dp)) {
                            AsyncImage(url, null, Modifier.heightIn(max = 96.dp).clip(RoundedCornerShape(8.dp)).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
                            Box(
                                Modifier.align(Alignment.TopEnd).padding(4.dp).clip(RoundedCornerShape(6.dp)).background(Tw.slate950.copy(alpha = 0.70f))
                                    .twClickable(pressScale = 0.90f) { commentImageUrl = null }.padding(2.dp)
                            ) { LuIcon(Lu.X, 12.dp, Tw.white) }
                        }
                    }
                    commentImageError?.let { Text(it, Modifier.padding(start = 4.dp), style = twText(11, FontWeight.Medium, 16), color = Tw.rose500) }
                }

                if (comments.isEmpty()) {
                    Text("لا توجد تعليقات بعد.", Modifier.fillMaxWidth().padding(vertical = 8.dp), style = twText(11, FontWeight.Normal, 16).copy(textAlign = TextAlign.Center), color = Tw.slate400)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        comments.forEach { comm ->
                            CommentBlock(
                                comm, currentUserId, onDeleteComment != null && (currentUserId == comm.userId || isAdmin),
                                replyingToId == comm.id, replyText, { replyText = it },
                                { replyingToId = if (replyingToId == comm.id) null else comm.id },
                                onLikeComment, { onDeleteComment?.invoke(comm.id) },
                                { if (replyText.isNotBlank()) { onReplyToComment(comm.id, replyText.trim()); replyText = ""; replyingToId = null } }
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun arNumPlain(n: Long): String = n.toString()

@Composable
private fun MenuItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: Color, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().twClickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        LuIcon(icon, 14.dp, tint)
        Text(label, style = twText(12, FontWeight.Bold, 16), color = tint)
    }
}

@Composable
private fun SmallField(value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier, fontSize: Int = 12) {
    val dark = isDark
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier.clip(shape).background(if (dark) Tw.slate800 else Tw.slate50)
            .border(1.dp, if (dark) Tw.slate700 else Tw.slate200, shape).padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        if (value.isEmpty()) Text(placeholder, style = twText(fontSize, FontWeight.Normal, fontSize + 4), color = Tw.slate400)
        BasicTextField(
            value = value, onValueChange = onChange, singleLine = true,
            textStyle = twText(fontSize, FontWeight.Normal, fontSize + 4).copy(color = if (dark) Tw.white else Tw.slate900),
            cursorBrush = SolidColor(brand.s500), modifier = Modifier.fillMaxWidth()
        )
    }
}

/** زر إجراء ملوّن — TweetActionButton: px-3.5 py-2 rounded-2xl min-w-48 border، تدرّج عمودي، ويمتلئ عند التفعيل. */
@Composable
private fun ActionBtn(
    tone: Tone, active: Boolean, icon: androidx.compose.ui.graphics.vector.ImageVector, label: String?,
    filled: Boolean = false, onClick: () -> Unit
) {
    val dark = isDark
    val b = brand
    // (idleFrom, idleTo, idleBorder, idleText, activeFrom, activeTo, activeBorder)
    val c: List<Color> = when (tone) {
        Tone.Rose -> listOf(Tw.rose50, Tw.rose100.copy(alpha = 0.70f), Tw.rose200, Tw.rose600, Tw.rose500, Tw.rose600, Tw.rose600)
        Tone.Brand -> listOf(b.s50, b.s100.copy(alpha = 0.70f), b.s200, b.s700, b.s500, b.s600, b.s600)
        Tone.Sky -> listOf(Tw.sky50, Tw.sky100.copy(alpha = 0.70f), Tw.sky200, Tw.sky700, Tw.sky500, Tw.sky600, Tw.sky600)
        Tone.Amber -> listOf(Tw.amber50, Tw.amber100.copy(alpha = 0.70f), Tw.amber200, Tw.amber700, Tw.amber400, Tw.amber500, Tw.amber500)
    }
    val base = when (tone) { Tone.Rose -> Tw.rose500; Tone.Brand -> b.s500; Tone.Sky -> Tw.sky500; Tone.Amber -> Tw.amber500 }
    val darkText = when (tone) { Tone.Rose -> Color(0xFFFDA4AF); Tone.Brand -> b.s300; Tone.Sky -> Color(0xFF7DD3FC); Tone.Amber -> Tw.amber300 }
    val shape = RoundedCornerShape(16.dp)
    val bg = if (active) Brush.verticalGradient(listOf(c[4], c[5]))
             else if (dark) Brush.verticalGradient(listOf(base.copy(alpha = 0.10f), base.copy(alpha = 0.20f)))
             else Brush.verticalGradient(listOf(c[0], c[1]))
    val border = if (active) c[6] else if (dark) base.copy(alpha = 0.30f) else c[2]
    val fg = if (active) Tw.white else if (dark) darkText else c[3]
    Row(
        Modifier.widthIn(min = 48.dp)
            .shadow(if (active) 3.dp else 2.dp, shape, ambientColor = base.copy(alpha = 0.30f), spotColor = base.copy(alpha = 0.30f))
            .clip(shape).background(bg).border(1.dp, border, shape)
            .twClickable(pressScale = 0.90f, onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically
    ) {
        // fill-white عند التفعيل: نرسم الأيقونة بالأبيض (المسار خطي) فنحاكي الامتلاء بإضافة قرص خلفها
        Box(contentAlignment = Alignment.Center) {
            if (filled) Box(Modifier.size(12.dp).clip(CircleShape).background(Tw.white))
            LuIcon(icon, 16.dp, fg)
        }
        if (label != null) Text(label, style = twText(12, FontWeight.ExtraBold, 16), color = fg)
    }
}

@Composable
private fun CommentBlock(
    comment: TweetComment, currentUserId: String, canDelete: Boolean, isReplying: Boolean, replyText: String,
    onReplyTextChange: (String) -> Unit, onToggleReplying: () -> Unit, onLikeComment: (String, Boolean) -> Unit,
    onDeleteComment: () -> Unit, onSubmitReply: () -> Unit
) {
    val dark = isDark
    val likedByMe = comment.likedBy?.contains(currentUserId) == true
    var confirm by remember { mutableStateOf(false) }
    if (confirm) Dialog(onDismissRequest = { confirm = false }) {
        val s = RoundedCornerShape(16.dp)
        Column(Modifier.clip(s).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, s).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("حذف التعليق", style = twText(14, FontWeight.ExtraBold, 20), color = if (dark) Tw.white else Tw.slate900)
            Text("هل تريد حذف هذا التعليق نهائياً؟", style = twText(12, FontWeight.Normal, 18), color = if (dark) Tw.slate300 else Tw.slate600)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100).twClickable { confirm = false }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) { Text("إلغاء", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate600) }
                Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Tw.rose600).twClickable { onDeleteComment(); confirm = false }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) { Text("حذف", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
            }
        }
    }
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(if (dark) Tw.slate800.copy(alpha = 0.50f) else Tw.slate50.copy(alpha = 0.70f))
            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), shape).padding(12.dp)
    ) {
        Row(Modifier.padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AsyncImage(comment.userAvatar, comment.userName, Modifier.size(24.dp).clip(CircleShape), contentScale = ContentScale.Crop)
            Text(comment.userName, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900)
            Text(DateFormatAr.timeAgoAr(comment.createdAt), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
        }
        Text(comment.content, Modifier.padding(bottom = 8.dp), style = twText(12, FontWeight.Normal, 20), color = if (dark) Tw.slate100 else Tw.slate800)
        comment.imageUrl?.let { url ->
            AsyncImage(url, null, Modifier.padding(bottom = 8.dp).fillMaxWidth().heightIn(max = 224.dp).clip(RoundedCornerShape(8.dp)).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            MiniAction(Lu.Heart, arNumPlain(comment.likesCount), if (likedByMe) Tw.rose500 else Tw.slate500, filled = likedByMe) { onLikeComment(comment.id, !likedByMe) }
            MiniAction(Lu.CornerDownLeft, "رد", Tw.slate500) { onToggleReplying() }
            if (canDelete) MiniAction(Lu.Trash2, "حذف", Tw.rose600) { confirm = true }
        }
        if (isReplying) {
            Row(Modifier.padding(top = 8.dp).fillMaxWidth().drawBehindStartBar(brand.s500), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(12.dp))
                SmallField(replyText, onReplyTextChange, "رد على ${comment.userName}...", Modifier.weight(1f), fontSize = 11)
                Box(Modifier.clip(RoundedCornerShape(8.dp)).background(brand.s600).twClickable(pressScale = 0.90f, onClick = onSubmitReply).padding(horizontal = 10.dp, vertical = 4.dp)) { Text("إرسال", style = twText(11, FontWeight.Bold, 16), color = Tw.white) }
            }
        }
        if (comment.replies.isNotEmpty()) {
            Column(Modifier.padding(top = 8.dp).fillMaxWidth().drawBehindStartBar(if (dark) brand.s900 else brand.s200), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                comment.replies.forEach { rep -> ReplyBlock(rep) }
            }
        }
    }
}

/** border-s-2: خط 2dp على جهة البداية. */
private fun Modifier.drawBehindStartBar(color: Color): Modifier = this.drawBehind {
    val w = 2.dp.toPx()
    val rtl = layoutDirection == androidx.compose.ui.unit.LayoutDirection.Rtl
    drawRect(color, topLeft = androidx.compose.ui.geometry.Offset(if (rtl) size.width - w else 0f, 0f), size = androidx.compose.ui.geometry.Size(w, size.height))
}

@Composable
private fun MiniAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: Color, filled: Boolean = false, onClick: () -> Unit) {
    val dark = isDark
    val s = RoundedCornerShape(8.dp)
    Row(
        Modifier.clip(s).background(if (dark) Tw.slate900.copy(alpha = 0.60f) else Tw.white).border(1.dp, if (dark) Tw.slate700.copy(alpha = 0.50f) else Tw.slate200.copy(alpha = 0.70f), s)
            .twClickable(pressScale = 0.90f, onClick = onClick).padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        LuIcon(icon, 12.dp, tint)
        Text(label, style = twText(11, FontWeight.Medium, 16), color = tint)
    }
}

@Composable
private fun ReplyBlock(reply: CommentReply) {
    val dark = isDark
    val s = RoundedCornerShape(8.dp)
    Column(Modifier.fillMaxWidth().padding(start = 12.dp).clip(s).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate700.copy(alpha = 0.60f) else Tw.slate200.copy(alpha = 0.60f), s).padding(8.dp)) {
        Row(Modifier.padding(bottom = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AsyncImage(reply.userAvatar, reply.userName, Modifier.size(20.dp).clip(CircleShape), contentScale = ContentScale.Crop)
            Text(reply.userName, style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900)
            Text(DateFormatAr.timeAgoAr(reply.createdAt), style = twText(9, FontWeight.Normal, 13), color = Tw.slate400)
        }
        Text(reply.content, style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate200 else Tw.slate700)
    }
}

@Composable
private fun ReportDialog(tweet: Tweet, reporterId: String, onDismiss: () -> Unit) {
    val dark = isDark
    var reason by remember { mutableStateOf("abusive") }
    var details by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    Dialog(onDismissRequest = onDismiss) {
        val s = RoundedCornerShape(16.dp)
        Column(
            Modifier.widthIn(max = 384.dp).fillMaxWidth().clip(s).background(if (dark) Tw.slate900 else Tw.white)
                .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, s).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LuIcon(Lu.Flag, 16.dp, Tw.amber500)
                Text("إبلاغ عن تغريدة ${tweet.authorName}", style = twText(14, FontWeight.ExtraBold, 20), color = if (dark) Tw.white else Tw.slate900)
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("abusive" to "محتوى مسيء", "harassment" to "مضايقة أو إزعاج", "spam" to "رسائل مزعجة/دعائية", "other" to "سبب آخر").forEach { (id, label) ->
                    Row(Modifier.fillMaxWidth().twClickable { reason = id }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(16.dp).clip(CircleShape).border(1.5.dp, if (reason == id) Tw.teal600 else Tw.slate400, CircleShape), contentAlignment = Alignment.Center) {
                            if (reason == id) Box(Modifier.size(8.dp).clip(CircleShape).background(Tw.teal600))
                        }
                        Text(label, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate700)
                    }
                }
            }
            SmallField(details, { details = it }, "تفاصيل إضافية (اختياري)...", Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100).twClickable(onClick = onDismiss).padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                    Text("إلغاء", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate600)
                }
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Tw.amber500.copy(alpha = if (sending) 0.5f else 1f))
                        .twClickable(enabled = !sending) {
                            sending = true
                            scope.launch {
                                val full = "تغريدة (${tweet.id}): \"${tweet.content.take(200)}\"" + (if (details.isNotBlank()) " — ${details.trim()}" else "")
                                MessageRepository().submitUserReport(reporterId, tweet.authorId, null, reason, full)
                                sending = false
                                android.widget.Toast.makeText(context, "تم إرسال البلاغ، شكراً لك.", android.widget.Toast.LENGTH_SHORT).show()
                                onDismiss()
                            }
                        }.padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) { Text(if (sending) "جارٍ الإرسال..." else "إرسال البلاغ", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
            }
        }
    }
}
