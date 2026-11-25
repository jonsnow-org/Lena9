package studio.ai.literium.literium_app.ui.screens.messages

import androidx.compose.foundation.border
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.SolidColor
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import studio.ai.literium.literium_app.data.firebase.PlatformConstants
import studio.ai.literium.literium_app.data.model.DirectMessage
import studio.ai.literium.literium_app.data.model.MessageMediaType
import studio.ai.literium.literium_app.data.model.ReportReason
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.components.ChatStickerFace
import studio.ai.literium.literium_app.ui.components.ChatStickers
import studio.ai.literium.literium_app.ui.components.STANDARD_EMOJIS
import studio.ai.literium.literium_app.util.DateFormatAr

private val OnlineGreen = Color(0xFF10B981)
private val OfflineGray = Color(0xFF94A3B8)

private val REPORT_REASONS = listOf(
    ReportReason.ABUSIVE to "محتوى مسيء",
    ReportReason.HARASSMENT to "مضايقة أو إزعاج",
    ReportReason.SPAM to "رسائل مزعجة/دعائية",
    ReportReason.OTHER to "سبب آخر"
)

/**
 * Open-thread view — spec §7 / `DirectMessagesModal.tsx`'s right pane. Deliberately carries NO
 * [studio.ai.literium.literium_app.ui.ads.AdTickerBar] (nor any [studio.ai.literium.literium_app.ui.ads.AdSlot])
 * anywhere on this screen — see [MessagesScreen]'s file KDoc for why that's a preserved, deliberate
 * placement decision, not an oversight.
 *
 * Bubble overflow: source has a documented real bug fix here (`min-w-0` on the flex panel — without
 * it, long message content forced the flexbox container past the viewport width because CSS flex
 * items default to `min-width: auto`). Compose's layout model doesn't share that default — a
 * [Modifier.widthIn] `max` is a hard upper bound regardless of the text's unconstrained intrinsic
 * width — but the *equivalent* risk here is a bubble sized from unconstrained content instead of the
 * available width, so [MessageBubbleRow] is always given an explicit `maxBubbleWidth` computed from
 * real available width via [BoxWithConstraints] (75%, matching source's `max-w-[75%]`) rather than
 * left to size itself.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun ChatScreen(
    conversationId: String,
    navController: NavController,
    viewModel: ChatViewModel = viewModel(
        factory = viewModelFactory { initializer { ChatViewModel(conversationId = conversationId) } }
    )
) {
    val state by viewModel.uiState.collectAsState()
    val uploadState by viewModel.uploadState.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showMenu by remember { mutableStateOf(false) }
    var showReport by remember { mutableStateOf(false) }
    var showBlockConfirm by remember { mutableStateOf(false) }
    var showHideConfirm by remember { mutableStateOf(false) }
    var showDeleteConversationConfirm by remember { mutableStateOf(false) }
    var pendingDeleteMessageId by remember { mutableStateOf<String?>(null) }
    var fullscreenImage by remember { mutableStateOf<String?>(null) }
    var draftText by remember { mutableStateOf("") }
    var showEmojiPanel by remember { mutableStateOf(false) }
    var emojiTab by remember { mutableStateOf("standard") }
    var clientPickError by remember { mutableStateOf<String?>(null) }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val (bytes, name, mime) = readUriBytes(context, uri)
            if (!mime.startsWith("image/")) {
                clientPickError = "يرجى اختيار ملف صورة صالح."
                return@launch
            }
            clientPickError = null
            viewModel.sendMedia(bytes, name, mime, MessageMediaType.IMAGE)
        }
    }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val (bytes, name, mime) = readUriBytes(context, uri)
            if (!mime.startsWith("video/")) {
                clientPickError = "يرجى اختيار ملف فيديو صالح."
                return@launch
            }
            val durationSec = videoDurationSeconds(context, uri)
            if (durationSec != null && durationSec > 300) {
                clientPickError = "مدة الفيديو تتجاوز 5 دقائق. اختر مقطعاً أقصر."
                return@launch
            }
            clientPickError = null
            viewModel.sendMedia(bytes, name, mime, MessageMediaType.VIDEO)
        }
    }

    val listState = rememberLazyListState()
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.size - 1)
    }

    val dark = isDark
    val line = if (dark) Tw.slate800 else Tw.slate200
    val txt = if (dark) Tw.white else Tw.slate900
    val shell = RoundedCornerShape(24.dp)

    Box(Modifier.fillMaxSize().padding(8.dp)) {
        Column(Modifier.fillMaxSize().shadow(16.dp, shell, clip = false).clip(shell).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, line, shell)) {
            // الرأس
            Row(
                Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.twClickable { navController.popBackStack() }.padding(4.dp)) { LuIcon(Lu.ArrowRight, 16.dp, Tw.slate500) }
                    Row(Modifier.weight(1f).twClickable { navController.navigate(Screen.WriterProfile.of(state.partnerId)) }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box {
                            AsyncImage(state.partnerAvatar.ifBlank { PlatformConstants.DEFAULT_AVATAR_URL }, state.partnerName, Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                            Box(Modifier.align(Alignment.BottomEnd).size(10.dp).clip(CircleShape).background(if (dark) Tw.slate900 else Tw.white).padding(2.dp).clip(CircleShape).background(if (state.isPartnerOnline) OnlineGreen else OfflineGray))
                        }
                        Column(Modifier.weight(1f)) {
                            Text(state.partnerName, style = twText(14, FontWeight.ExtraBold, 20), color = txt, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val statusText = when { state.isPartnerTyping -> "يكتب الآن..."; state.isPartnerOnline -> "متصل الآن"; else -> state.lastSeenLabel }
                            Text(statusText, style = twText(10, if (state.isPartnerTyping) FontWeight.Bold else FontWeight.Normal, 15), color = if (state.isPartnerTyping) (if (dark) Tw.teal300 else Tw.teal600) else Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Box {
                    Box(Modifier.clip(RoundedCornerShape(12.dp)).twClickable { showMenu = true }.padding(6.dp)) { LuIcon(Lu.MoreVertical, 18.dp, Tw.slate400) }
                    DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }, containerColor = if (dark) Tw.slate800 else Tw.white, modifier = Modifier.width(208.dp)) {
                        ChatMenuItem(Lu.UserCircle2, "عرض الملف الشخصي", if (dark) Tw.slate200 else Tw.slate700) { showMenu = false; navController.navigate(Screen.WriterProfile.of(state.partnerId)) }
                        ChatMenuItem(if (state.isMutedByMe) Lu.Bell else Lu.BellOff, if (state.isMutedByMe) "إلغاء الكتم" else "كتم الإشعارات", if (dark) Tw.slate200 else Tw.slate700) { showMenu = false; viewModel.toggleMute(!state.isMutedByMe) }
                        ChatMenuItem(Lu.Flag, "إبلاغ عن إساءة", Tw.amber600) { showMenu = false; showReport = true }
                        ChatMenuItem(Lu.Ban, if (state.isBlockedByMe) "إلغاء الحظر" else "حظر المستخدم", Tw.rose600) { showMenu = false; if (state.isBlockedByMe) viewModel.toggleBlock(false) else showBlockConfirm = true }
                        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate700 else Tw.slate100))
                        ChatMenuItem(Lu.LogOut, "إخفاء المحادثة", Tw.slate500) { showMenu = false; showHideConfirm = true }
                        if (state.isAdmin) ChatMenuItem(Lu.Trash2, "حذف نهائي (صلاحية أدمن)", Tw.rose600) { showMenu = false; showDeleteConversationConfirm = true }
                    }
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(line))

            if (state.isLoading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }
            } else {
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.50f) else Tw.slate50.copy(alpha = 0.50f))) {
                    val maxBubbleWidth = maxWidth * 0.75f
                    LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(items = state.messages, key = { it.id }) { msg ->
                            val isMe = msg.senderId == state.currentUserId
                            MessageBubbleRow(
                                msg = msg, isMe = isMe, canDelete = isMe || state.isAdmin, maxBubbleWidth = maxBubbleWidth, dark = dark,
                                onDelete = { pendingDeleteMessageId = msg.id },
                                onImageClick = { url -> fullscreenImage = url },
                                onVideoClick = { url -> runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
                            )
                        }
                        if (state.isPartnerTyping) item(key = "typing") { TypingIndicatorBubble(dark) }
                    }
                }

                Box(Modifier.fillMaxWidth().height(1.dp).background(line))
                if (!state.canChat) {
                    Column(Modifier.fillMaxWidth().background(if (dark) Tw.slate900 else Tw.white).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(if (state.isBlockedByMe) "لقد حظرت هذا المستخدم — لا يمكنكما التراسل." else "لا يمكنك مراسلة هذا المستخدم حالياً.", Modifier.padding(bottom = 8.dp), style = twText(12, FontWeight.Bold, 16).copy(textAlign = TextAlign.Center), color = Tw.rose500)
                        if (state.isBlockedByMe) Box(Modifier.clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100).twClickable { viewModel.toggleBlock(false) }.padding(horizontal = 16.dp, vertical = 8.dp)) {
                            Text("إلغاء الحظر", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate700)
                        }
                    }
                } else {
                    Column(Modifier.fillMaxWidth().background(if (dark) Tw.slate900 else Tw.white)) {
                        val displayedError = clientPickError ?: uploadState.error
                        if (displayedError != null) Row(Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            LuIcon(Lu.AlertCircle, 14.dp, Tw.rose500)
                            Text(displayedError, style = twText(11, FontWeight.Medium, 16), color = Tw.rose500)
                        }
                        if (showEmojiPanel) EmojiStickerPanel(tab = emojiTab, dark = dark, onTabChange = { emojiTab = it }, onEmoji = { draftText += it }, onSticker = { id -> viewModel.sendSticker(id); showEmojiPanel = false })
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(Modifier.clip(RoundedCornerShape(12.dp)).then(if (showEmojiPanel) Modifier.background(if (dark) Color(0xFF042F2E) else Color(0xFFF0FDFA)) else Modifier).twClickable { showEmojiPanel = !showEmojiPanel }.padding(8.dp)) {
                                LuIcon(Lu.Smile, 18.dp, if (showEmojiPanel) Tw.teal600 else Tw.slate400)
                            }
                            Box(Modifier.clip(RoundedCornerShape(12.dp)).twClickable(enabled = uploadState.uploading == null) { imagePicker.launch("image/*") }.padding(8.dp).then(if (uploadState.uploading != null) Modifier.alpha(0.5f) else Modifier)) {
                                if (uploadState.uploading == MessageMediaType.IMAGE) CircularProgressIndicator(Modifier.size(18.dp), color = Tw.slate400, strokeWidth = 2.dp) else LuIcon(Lu.Image, 18.dp, Tw.slate400)
                            }
                            Box(Modifier.clip(RoundedCornerShape(12.dp)).twClickable(enabled = uploadState.uploading == null) { videoPicker.launch("video/*") }.padding(8.dp).then(if (uploadState.uploading != null) Modifier.alpha(0.5f) else Modifier)) {
                                if (uploadState.uploading == MessageMediaType.VIDEO) CircularProgressIndicator(Modifier.size(18.dp), color = Tw.slate400, strokeWidth = 2.dp) else LuIcon(Lu.Video, 18.dp, Tw.slate400)
                            }
                            val fs = RoundedCornerShape(12.dp)
                            Box(Modifier.weight(1f).clip(fs).background(if (dark) Tw.slate800 else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, fs).padding(horizontal = 16.dp, vertical = 8.dp)) {
                                if (draftText.isEmpty()) Text("اكتب رسالتك...", style = twText(12, FontWeight.Normal, 20), color = Tw.slate400)
                                BasicTextField(draftText, { draftText = it; viewModel.onTyping() }, singleLine = true, textStyle = twText(12, FontWeight.Normal, 20).copy(color = txt), cursorBrush = SolidColor(Tw.teal600), modifier = Modifier.fillMaxWidth())
                            }
                            val canSend = draftText.isNotBlank()
                            Box(Modifier.shadow(1.dp, RoundedCornerShape(12.dp), clip = false).clip(RoundedCornerShape(12.dp)).background(Tw.teal600).then(if (!canSend) Modifier.alpha(0.5f) else Modifier).twClickable(enabled = canSend) { viewModel.sendText(draftText); draftText = "" }.padding(horizontal = 16.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
                                LuIcon(Lu.Send, 14.dp, Tw.white, Modifier.rotate(180f))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showReport) {
        ReportDialog(
            partnerName = state.partnerName,
            onDismiss = { showReport = false },
            onSubmit = { reason, details -> viewModel.submitReport(reason, details); showReport = false }
        )
    }

    if (showBlockConfirm) {
        AlertDialog(
            onDismissRequest = { showBlockConfirm = false },
            title = { Text("حظر المستخدم") },
            text = { Text("هل تريد حظر ${state.partnerName}؟ لن يستطيع مراسلتك بعد الآن.") },
            confirmButton = {
                TextButton(onClick = { viewModel.toggleBlock(true); showBlockConfirm = false }) {
                    Text("حظر", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { showBlockConfirm = false }) { Text("إلغاء") } }
        )
    }

    if (showHideConfirm) {
        AlertDialog(
            onDismissRequest = { showHideConfirm = false },
            title = { Text("حذف المحادثة") },
            text = { Text("حذف المحادثة مع ${state.partnerName} من قائمتك؟ يمكنك استقبال رسائل جديدة منه لاحقاً بلا مشكلة.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.hideConversation()
                    showHideConfirm = false
                    navController.popBackStack()
                }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { showHideConfirm = false }) { Text("إلغاء") } }
        )
    }

    if (showDeleteConversationConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConversationConfirm = false },
            title = { Text("حذف نهائي (صلاحية أدمن)") },
            text = { Text("سيتم حذف محادثتك مع ${state.partnerName} بكل رسائلها نهائياً. هل تريد المتابعة؟") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteConversationAsAdmin()
                    showDeleteConversationConfirm = false
                    navController.popBackStack()
                }) { Text("حذف نهائياً", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { showDeleteConversationConfirm = false }) { Text("إلغاء") } }
        )
    }

    pendingDeleteMessageId?.let { id ->
        AlertDialog(
            onDismissRequest = { pendingDeleteMessageId = null },
            title = { Text("حذف الرسالة") },
            text = { Text("حذف هذه الرسالة نهائياً؟") },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteMessage(id); pendingDeleteMessageId = null }) {
                    Text("حذف", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { pendingDeleteMessageId = null }) { Text("إلغاء") } }
        )
    }

    fullscreenImage?.let { url ->
        Dialog(onDismissRequest = { fullscreenImage = null }) {
            AsyncImage(
                model = url,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { fullscreenImage = null },
                contentScale = ContentScale.Fit
            )
        }
    }
}

@Composable
private fun ChatMenuItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, color: Color, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { LuIcon(icon, 14.dp, color); Text(label, style = twText(12, FontWeight.Bold, 16), color = color) } },
        onClick = onClick
    )
}

@Composable
private fun MessageBubbleRow(
    msg: DirectMessage,
    isMe: Boolean,
    canDelete: Boolean,
    maxBubbleWidth: Dp,
    dark: Boolean,
    onDelete: () -> Unit,
    onImageClick: (String) -> Unit,
    onVideoClick: (String) -> Unit
) {
    val sticker = if (msg.mediaType == MessageMediaType.STICKER) ChatStickers.find(msg.content) else null
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (isMe) Arrangement.Start else Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
        if (isMe && canDelete) Box(Modifier.clip(RoundedCornerShape(8.dp)).twClickable(onClick = onDelete).padding(4.dp)) { LuIcon(Lu.Trash2, 14.dp, Tw.slate400) }
        if (isMe && canDelete) Spacer(Modifier.width(6.dp))

        if (sticker != null) {
            Column(Modifier.widthIn(max = maxBubbleWidth * 0.6f), horizontalAlignment = if (isMe) Alignment.Start else Alignment.End) {
                ChatStickerFace(sticker, Modifier.size(80.dp))
                Text(DateFormatAr.timeAgoAr(msg.createdAt), Modifier.padding(top = 2.dp), style = twText(9, FontWeight.Normal, 13), color = Tw.slate400)
            }
        } else {
            val shape = RoundedCornerShape(topStart = if (isMe) 16.dp else 0.dp, topEnd = if (isMe) 0.dp else 16.dp, bottomStart = 16.dp, bottomEnd = 16.dp)
            Column(
                Modifier.widthIn(max = maxBubbleWidth)
                    .then(if (!isMe) Modifier.shadow(1.dp, shape, clip = false) else Modifier)
                    .clip(shape).background(if (isMe) Tw.teal600 else (if (dark) Tw.slate800 else Tw.white))
                    .then(if (!isMe) Modifier.border(1.dp, if (dark) Tw.slate700 else Tw.slate200, shape) else Modifier)
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                if (msg.mediaType == MessageMediaType.IMAGE && !msg.mediaUrl.isNullOrBlank()) {
                    AsyncImage(msg.mediaUrl, null, Modifier.fillMaxWidth().heightIn(max = 256.dp).clip(RoundedCornerShape(12.dp)).twClickable { msg.mediaUrl?.let(onImageClick) }, contentScale = ContentScale.Crop)
                    Spacer(Modifier.height(6.dp))
                }
                if (msg.mediaType == MessageMediaType.VIDEO && !msg.mediaUrl.isNullOrBlank()) {
                    VideoMessageCard(isMe = isMe, dark = dark, onClick = { msg.mediaUrl?.let(onVideoClick) })
                    Spacer(Modifier.height(6.dp))
                }
                if (msg.content.isNotBlank()) Text(msg.content, style = twText(12, FontWeight.Normal, 20), color = if (isMe) Tw.white else (if (dark) Tw.white else Tw.slate900))
                Text(DateFormatAr.timeAgoAr(msg.createdAt), Modifier.align(Alignment.End).padding(top = 4.dp), style = twText(9, FontWeight.Normal, 13), color = if (isMe) Color(0xFF99F6E4) else Tw.slate400)
            }
        }

        if (!isMe && canDelete) Spacer(Modifier.width(6.dp))
        if (!isMe && canDelete) Box(Modifier.clip(RoundedCornerShape(8.dp)).twClickable(onClick = onDelete).padding(4.dp)) { LuIcon(Lu.Trash2, 14.dp, Tw.slate400) }
    }
}

@Composable
private fun VideoMessageCard(isMe: Boolean, dark: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).clip(RoundedCornerShape(12.dp)).background((if (isMe) Color.White else Tw.teal600).copy(alpha = 0.16f)).twClickable(onClick = onClick).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        LuIcon(Lu.Video, 24.dp, if (isMe) Tw.white else Tw.teal600)
        Text("رسالة فيديو — اضغط للتشغيل", style = twText(11, FontWeight.Medium, 16), color = if (isMe) Tw.white else (if (dark) Tw.white else Tw.slate900))
    }
}

@Composable
private fun TypingIndicatorBubble(dark: Boolean) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        val shape = RoundedCornerShape(topStart = 0.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 16.dp)
        Row(Modifier.clip(shape).background(if (dark) Tw.slate800 else Tw.white).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, shape).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(3) { index ->
                val transition = rememberInfiniteTransition(label = "typing")
                val offsetY by transition.animateFloat(0f, -4f, infiniteRepeatable(tween(durationMillis = 400, delayMillis = index * 150, easing = LinearEasing), RepeatMode.Reverse), label = "dot$index")
                Box(Modifier.size(6.dp).offset(y = offsetY.dp).clip(CircleShape).background(Tw.slate400))
            }
        }
    }
}

@Composable
private fun EmojiStickerPanel(tab: String, dark: Boolean, onTabChange: (String) -> Unit, onEmoji: (String) -> Unit, onSticker: (String) -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp).padding(bottom = 4.dp).shadow(8.dp, shape, clip = false).clip(shape).background(if (dark) Tw.slate800 else Tw.white).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, shape)) {
        Row(Modifier.fillMaxWidth()) {
            listOf("standard" to "الشائعة", "stickers" to "ملصقات ليتيريوم").forEach { (id, label) ->
                Column(Modifier.weight(1f).twClickable { onTabChange(id) }, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(label, Modifier.padding(vertical = 8.dp), style = twText(11, FontWeight.Bold, 16), color = if (tab == id) Tw.teal600 else Tw.slate400)
                    Box(Modifier.fillMaxWidth().height(2.dp).background(if (tab == id) Tw.teal600 else Color.Transparent))
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate700 else Tw.slate100))
        if (tab == "standard") {
            LazyVerticalGrid(columns = GridCells.Fixed(8), modifier = Modifier.fillMaxWidth().heightIn(max = 208.dp).padding(10.dp)) {
                gridItems(items = STANDARD_EMOJIS) { emoji ->
                    Box(Modifier.padding(3.dp).clip(RoundedCornerShape(8.dp)).twClickable { onEmoji(emoji) }.padding(6.dp), contentAlignment = Alignment.Center) { Text(emoji, style = twText(18, FontWeight.Normal, 24)) }
                }
            }
        } else {
            LazyVerticalGrid(columns = GridCells.Fixed(4), modifier = Modifier.fillMaxWidth().heightIn(max = 208.dp).padding(10.dp)) {
                gridItems(items = ChatStickers.ALL, key = { it.id }) { sticker ->
                    Column(Modifier.padding(4.dp).clip(RoundedCornerShape(12.dp)).twClickable { onSticker(sticker.id) }.padding(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        ChatStickerFace(sticker, Modifier.size(44.dp))
                        Text(sticker.label, style = twText(9, FontWeight.Normal, 13), color = Tw.slate400)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportDialog(
    partnerName: String,
    onDismiss: () -> Unit,
    onSubmit: (reason: String, details: String) -> Unit
) {
    var reason by remember { mutableStateOf(ReportReason.ABUSIVE) }
    var details by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إبلاغ عن $partnerName") },
        text = {
            Column {
                REPORT_REASONS.forEach { (value, label) ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { reason = value }
                            .padding(vertical = 2.dp)
                    ) {
                        RadioButton(selected = reason == value, onClick = { reason = value })
                        Text(label)
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = details,
                    onValueChange = { details = it },
                    placeholder = { Text("تفاصيل إضافية (اختياري)...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSubmit(reason, details) }) { Text("إرسال البلاغ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } }
    )
}

private suspend fun readUriBytes(context: Context, uri: Uri): Triple<ByteArray, String, String> =
    withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: ByteArray(0)
        val ext = when {
            mime.contains("png") -> "png"
            mime.contains("gif") -> "gif"
            mime.startsWith("image/") -> "jpg"
            mime.startsWith("video/") -> "mp4"
            else -> "bin"
        }
        Triple(bytes, "upload_${System.currentTimeMillis()}.$ext", mime)
    }

/** Best-effort — a failure to read duration never blocks the upload, matching source's own try/catch. */
private fun videoDurationSeconds(context: Context, uri: Uri): Long? {
    val retriever = MediaMetadataRetriever()
    return try {
        retriever.setDataSource(context, uri)
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.let { it / 1000 }
    } catch (e: Exception) {
        null
    } finally {
        try { retriever.release() } catch (e: Exception) { /* no-op */ }
    }
}
