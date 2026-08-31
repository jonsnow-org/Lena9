package studio.ai.literium.literium_app.ui.screens.messages

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.ads.AdTickerBar
import studio.ai.literium.literium_app.util.DateFormatAr

private val OnlineGreen = Color(0xFF10B981)
private val OfflineGray = Color(0xFF94A3B8)

/**
 * Conversation list — spec §7 / `DirectMessagesModal.tsx`'s left pane. Unread badges, presence dots
 * ([studio.ai.literium.literium_app.util.PresenceRules]) and the messages-list-only ad ticker
 * ([studio.ai.literium.literium_app.data.model.AdSlotId.MESSAGES_LIST]) all live here — and ONLY here:
 * deliberately never rendered inside [ChatScreen] (source's own comment: "لا يظهر إطلاقاً داخل أي
 * محادثة مفتوحة حتى لا يزعج تدفّق الرسائل").
 */
@Composable
fun MessagesScreen(
    navController: NavController,
    viewModel: MessagesViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var pendingDelete by remember { mutableStateOf<ConversationDisplay?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("الرسائل والمحادثات") },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.NewConversation.route) }) {
                        Icon(Icons.Filled.Add, contentDescription = "محادثة جديدة")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                state.isLoading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                state.errorMessage != null -> Text(
                    text = state.errorMessage.orEmpty(),
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    color = MaterialTheme.colorScheme.error
                )
                state.conversations.isEmpty() -> Column(
                    modifier = Modifier
                        .fillMaxSize(),
                    verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(modifier = Modifier.padding(horizontal = 12.dp).fillMaxWidth()) {
                        AdSlot(slotId = AdSlotId.MESSAGES_LIST)
                    }
                    Spacer(Modifier.height(24.dp))
                    Text("لا توجد محادثات سابقة حالياً", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    item(key = "ad_ticker") {
                        // شريط إعلاني صغير أعلى قائمة المحادثات فقط — لا يُمرَّر أبداً إلى ChatScreen.
                        Box(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                            AdSlot(slotId = AdSlotId.MESSAGES_LIST)
                        }
                    }
                    items(items = state.conversations, key = { it.id }) { conv ->
                        ConversationRow(
                            conversation = conv,
                            onClick = { navController.navigate(Screen.Chat.of(conv.id)) },
                            onDeleteRequest = { pendingDelete = conv }
                        )
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                    }
                }
            }
        }
    }

    pendingDelete?.let { conv ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("حذف المحادثة") },
            text = { Text("حذف المحادثة مع ${conv.partnerName} من قائمتك؟ يمكنك استقبال رسائل جديدة منه لاحقاً بلا مشكلة.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.hideConversation(conv.id)
                    pendingDelete = null
                }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text("إلغاء") }
            }
        )
    }
}

@Composable
private fun ConversationRow(
    conversation: ConversationDisplay,
    onClick: () -> Unit,
    onDeleteRequest: () -> Unit
) {
    val emphasized = conversation.unreadCount > 0 && !conversation.isMutedByMe
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            AsyncImage(
                model = conversation.partnerAvatar,
                contentDescription = conversation.partnerName,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
            )
            Box(
                modifier = Modifier
                    .size(13.dp)
                    .align(Alignment.BottomEnd)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(2.dp)
                    .clip(CircleShape)
                    .background(if (conversation.isPartnerOnline) OnlineGreen else OfflineGray)
            )
        }

        Spacer(Modifier.width(10.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = conversation.partnerName,
                    fontWeight = if (emphasized) FontWeight.Black else FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (conversation.isMutedByMe) {
                    Spacer(Modifier.width(4.dp))
                    Icon(
                        Icons.Filled.NotificationsOff,
                        contentDescription = "مكتوم",
                        modifier = Modifier.size(12.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.width(6.dp))
                Text(
                    text = conversation.lastMessageTime?.let { DateFormatAr.timeAgoAr(it) } ?: "",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = if (conversation.isPartnerTypingNow) "يكتب الآن..." else conversation.lastMessage.ifBlank { "ابدأ المحادثة الآن" },
                    style = MaterialTheme.typography.bodySmall,
                    color = when {
                        conversation.isPartnerTypingNow -> MaterialTheme.colorScheme.primary
                        emphasized -> MaterialTheme.colorScheme.onSurface
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontWeight = if (emphasized) FontWeight.Bold else FontWeight.Normal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (emphasized) {
                    Spacer(Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .defaultMinSize(minWidth = 18.dp)
                            .height(18.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                            .padding(horizontal = 5.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (conversation.unreadCount > 9) "9+" else conversation.unreadCount.toString(),
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        IconButton(onClick = onDeleteRequest) {
            Icon(
                Icons.Filled.Delete,
                contentDescription = "حذف المحادثة",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}
