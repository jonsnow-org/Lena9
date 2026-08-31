package studio.ai.literium.literium_app.ui.screens.messages

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

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                },
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { navController.navigate(Screen.WriterProfile.of(state.partnerId)) }
                    ) {
                        Box {
                            AsyncImage(
                                model = state.partnerAvatar.ifBlank { PlatformConstants.DEFAULT_AVATAR_URL },
                                contentDescription = state.partnerName,
                                modifier = Modifier.size(36.dp).clip(CircleShape)
                            )
                            Box(
                                modifier = Modifier
                                    .size(11.dp)
                                    .align(Alignment.BottomEnd)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.surface)
                                    .padding(2.dp)
                                    .clip(CircleShape)
                                    .background(if (state.isPartnerOnline) OnlineGreen else OfflineGray)
                            )
                        }
                        Spacer(Modifier.width(8.dp))
                        Column {
                            Text(
                                state.partnerName,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = when {
                                    state.isPartnerTyping -> "يكتب الآن..."
                                    state.isPartnerOnline -> "متصل الآن"
                                    else -> state.lastSeenLabel
                                },
                                style = MaterialTheme.typography.labelSmall,
                                color = if (state.isPartnerTyping) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                actions = {
                    if (state.isAdmin) {
                        IconButton(onClick = { showDeleteConversationConfirm = true }) {
                            Icon(Icons.Filled.DeleteForever, contentDescription = "حذف نهائي (صلاحية أدمن)")
                        }
                    }
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Filled.MoreVert, contentDescription = "خيارات المحادثة")
                        }
                        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                            DropdownMenuItem(
                                text = { Text("عرض الملف الشخصي") },
                                leadingIcon = { Icon(Icons.Filled.Person, contentDescription = null) },
                                onClick = {
                                    showMenu = false
                                    navController.navigate(Screen.WriterProfile.of(state.partnerId))
                                }
                            )
                            DropdownMenuItem(
                                text = { Text(if (state.isMutedByMe) "إلغاء الكتم" else "كتم الإشعارات") },
                                leadingIcon = {
                                    Icon(if (state.isMutedByMe) Icons.Filled.Notifications else Icons.Filled.NotificationsOff, contentDescription = null)
                                },
                                onClick = {
                                    showMenu = false
                                    viewModel.toggleMute(!state.isMutedByMe)
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("إبلاغ عن إساءة") },
                                leadingIcon = { Icon(Icons.Filled.Flag, contentDescription = null) },
                                onClick = { showMenu = false; showReport = true }
                            )
                            DropdownMenuItem(
                                text = { Text(if (state.isBlockedByMe) "إلغاء الحظر" else "حظر المستخدم") },
                                leadingIcon = { Icon(Icons.Filled.Block, contentDescription = null) },
                                onClick = {
                                    showMenu = false
                                    if (state.isBlockedByMe) viewModel.toggleBlock(false) else showBlockConfirm = true
                                }
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text("حذف المحادثة") },
                                leadingIcon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null) },
                                onClick = { showMenu = false; showHideConfirm = true }
                            )
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (state.isLoading) {
                Box(Modifier.fillMaxSize()) { CircularProgressIndicator(Modifier.align(Alignment.Center)) }
            } else {
                BoxWithConstraints(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    val maxBubbleWidth = maxWidth * 0.75f
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(items = state.messages, key = { it.id }) { msg ->
                            val isMe = msg.senderId == state.currentUserId
                            val canDelete = isMe || state.isAdmin
                            MessageBubbleRow(
                                msg = msg,
                                isMe = isMe,
                                canDelete = canDelete,
                                maxBubbleWidth = maxBubbleWidth,
                                onDelete = { pendingDeleteMessageId = msg.id },
                                onImageClick = { url -> fullscreenImage = url },
                                onVideoClick = { url ->
                                    runCatching {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                    }
                                }
                            )
                        }
                        if (state.isPartnerTyping) {
                            item(key = "typing") { TypingIndicatorBubble() }
                        }
                    }
                }

                if (!state.canChat) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = if (state.isBlockedByMe) "لقد حظرت هذا المستخدم — لا يمكنكما التراسل." else "لا يمكنك مراسلة هذا المستخدم حالياً.",
                            color = MaterialTheme.colorScheme.error,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                        if (state.isBlockedByMe) {
                            Spacer(Modifier.height(8.dp))
                            OutlinedButton(onClick = { viewModel.toggleBlock(false) }) { Text("إلغاء الحظر") }
                        }
                    }
                } else {
                    val displayedError = clientPickError ?: uploadState.error
                    if (displayedError != null) {
                        Text(
                            text = displayedError,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                        )
                    }

                    if (showEmojiPanel) {
                        EmojiStickerPanel(
                            tab = emojiTab,
                            onTabChange = { emojiTab = it },
                            onEmoji = { draftText += it },
                            onSticker = { id -> viewModel.sendSticker(id); showEmojiPanel = false }
                        )
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { showEmojiPanel = !showEmojiPanel }) {
                            Icon(Icons.Filled.SentimentSatisfiedAlt, contentDescription = "سمايلات وملصقات")
                        }
                        IconButton(onClick = { imagePicker.launch("image/*") }, enabled = uploadState.uploading == null) {
                            if (uploadState.uploading == MessageMediaType.IMAGE) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Filled.Image, contentDescription = "إرسال صورة")
                            }
                        }
                        IconButton(onClick = { videoPicker.launch("video/*") }, enabled = uploadState.uploading == null) {
                            if (uploadState.uploading == MessageMediaType.VIDEO) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Filled.Videocam, contentDescription = "إرسال فيديو قصير (حتى 5 دقائق)")
                            }
                        }
                        TextField(
                            value = draftText,
                            onValueChange = { draftText = it; viewModel.onTyping() },
                            placeholder = { Text("اكتب رسالتك...") },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(16.dp),
                            colors = TextFieldDefaults.colors(
                                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                                focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                                unfocusedIndicatorColor = Color.Transparent,
                                focusedIndicatorColor = Color.Transparent
                            ),
                            keyboardOptions = KeyboardOptions.Default
                        )
                        Spacer(Modifier.width(6.dp))
                        IconButton(
                            onClick = { viewModel.sendText(draftText); draftText = "" },
                            enabled = draftText.isNotBlank()
                        ) {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "إرسال")
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
private fun MessageBubbleRow(
    msg: DirectMessage,
    isMe: Boolean,
    canDelete: Boolean,
    maxBubbleWidth: Dp,
    onDelete: () -> Unit,
    onImageClick: (String) -> Unit,
    onVideoClick: (String) -> Unit
) {
    val sticker = if (msg.mediaType == MessageMediaType.STICKER) ChatStickers.find(msg.content) else null
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isMe) Arrangement.Start else Arrangement.End,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (isMe && canDelete) {
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Icon(
                    Icons.Filled.DeleteForever,
                    contentDescription = "حذف الرسالة",
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (sticker != null) {
            Column(
                modifier = Modifier.widthIn(max = 96.dp),
                horizontalAlignment = if (isMe) Alignment.Start else Alignment.End
            ) {
                ChatStickerFace(sticker, modifier = Modifier.size(80.dp))
                Text(
                    DateFormatAr.timeAgoAr(msg.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            Column(
                modifier = Modifier
                    .widthIn(max = maxBubbleWidth)
                    .clip(
                        RoundedCornerShape(
                            topStart = if (isMe) 16.dp else 0.dp,
                            topEnd = if (isMe) 0.dp else 16.dp,
                            bottomStart = 16.dp,
                            bottomEnd = 16.dp
                        )
                    )
                    .background(if (isMe) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant)
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                if (msg.mediaType == MessageMediaType.IMAGE && !msg.mediaUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = msg.mediaUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 220.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { msg.mediaUrl?.let(onImageClick) }
                    )
                    Spacer(Modifier.height(6.dp))
                }
                if (msg.mediaType == MessageMediaType.VIDEO && !msg.mediaUrl.isNullOrBlank()) {
                    VideoMessageCard(isMe = isMe, onClick = { msg.mediaUrl?.let(onVideoClick) })
                    Spacer(Modifier.height(6.dp))
                }
                if (msg.content.isNotBlank()) {
                    Text(
                        text = msg.content,
                        color = if (isMe) Color.White else MaterialTheme.colorScheme.onSurface,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                Text(
                    text = DateFormatAr.timeAgoAr(msg.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isMe) Color.White.copy(alpha = 0.75f) else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .align(Alignment.End)
                        .padding(top = 2.dp)
                )
            }
        }

        if (!isMe && canDelete) {
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Icon(
                    Icons.Filled.DeleteForever,
                    contentDescription = "حذف الرسالة (صلاحية أدمن)",
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun VideoMessageCard(isMe: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background((if (isMe) Color.White else MaterialTheme.colorScheme.primary).copy(alpha = 0.16f))
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            Icons.Filled.PlayCircle,
            contentDescription = null,
            tint = if (isMe) Color.White else MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(26.dp)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            "رسالة فيديو — اضغط للتشغيل",
            style = MaterialTheme.typography.labelMedium,
            color = if (isMe) Color.White else MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun TypingIndicatorBubble() {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 0.dp, bottomStart = 16.dp, bottomEnd = 16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            repeat(3) { index ->
                val transition = rememberInfiniteTransition(label = "typing")
                val offsetY by transition.animateFloat(
                    initialValue = 0f,
                    targetValue = -4f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(durationMillis = 400, delayMillis = index * 150, easing = LinearEasing),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "dot$index"
                )
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .offset(y = offsetY.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.onSurfaceVariant)
                )
            }
        }
    }
}

@Composable
private fun EmojiStickerPanel(
    tab: String,
    onTabChange: (String) -> Unit,
    onEmoji: (String) -> Unit,
    onSticker: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 220.dp)
            .padding(horizontal = 8.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            TextButton(onClick = { onTabChange("standard") }, modifier = Modifier.weight(1f)) {
                Text("الشائعة", fontWeight = if (tab == "standard") FontWeight.Bold else FontWeight.Normal)
            }
            TextButton(onClick = { onTabChange("stickers") }, modifier = Modifier.weight(1f)) {
                Text("ملصقات ليتيريوم", fontWeight = if (tab == "stickers") FontWeight.Bold else FontWeight.Normal)
            }
        }
        HorizontalDivider()
        if (tab == "standard") {
            LazyVerticalGrid(columns = GridCells.Fixed(8), modifier = Modifier.fillMaxWidth().heightIn(max = 180.dp)) {
                gridItems(items = STANDARD_EMOJIS) { emoji ->
                    Box(
                        modifier = Modifier
                            .padding(2.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { onEmoji(emoji) }
                            .padding(6.dp),
                        contentAlignment = Alignment.Center
                    ) { Text(emoji, style = MaterialTheme.typography.titleMedium) }
                }
            }
        } else {
            LazyVerticalGrid(columns = GridCells.Fixed(4), modifier = Modifier.fillMaxWidth().heightIn(max = 180.dp)) {
                gridItems(items = ChatStickers.ALL, key = { it.id }) { sticker ->
                    Column(
                        modifier = Modifier
                            .padding(4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onSticker(sticker.id) }
                            .padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        ChatStickerFace(sticker, modifier = Modifier.size(44.dp))
                        Text(sticker.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
