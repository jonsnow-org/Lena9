package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.data.model.Conversation
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.DarkCard
import studio.ai.literium.literium_app.ui.theme.SlateMuted
import androidx.compose.ui.unit.sp

/**
 * "مراقبة المحادثات — جودة المنصة" — Compose port of `AdminChatsTab.tsx`.
 * Read-only oversight: opening a conversation here never writes `isRead`/
 * `typing`, so neither participant is notified the admin opened it — see
 * [studio.ai.literium.literium_app.data.repository.MessageRepository.observeConversationMessagesForAdmin]'s
 * own KDoc.
 */
@Composable
fun ChatsTab(viewModel: AdminViewModel, users: List<User>) {
    val conversations by viewModel.conversations.collectAsState()
    var search by remember { mutableStateOf("") }
    var openConversation by remember { mutableStateOf<Conversation?>(null) }

    fun userLabel(id: String?): String {
        val u = users.find { it.id == id }
        return u?.penName ?: u?.companyName ?: u?.fullName ?: "مستخدم محذوف"
    }

    val filtered = conversations.filter { c ->
        if (search.isBlank()) return@filter true
        val q = search.trim().lowercase()
        c.participants.any { userLabel(it).lowercase().contains(q) }
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("مراقبة المحادثات — القراءة هنا صامتة تماماً ولا تُخطر أياً من الطرفين.", fontWeight = FontWeight.Bold)
        }
        item {
            OutlinedTextField(
                value = search, onValueChange = { search = it },
                label = { Text("ابحث باسم مستخدم...") }, modifier = Modifier.fillMaxWidth()
            )
        }
        if (filtered.isEmpty()) {
            item { EmptyHint("لا توجد محادثات مطابقة حالياً") }
        } else {
            items(filtered, key = { it.id }) { c ->
                val a = c.participants.getOrNull(0)
                val b = c.participants.getOrNull(1)
                DarkCard(onClick = { openConversation = c }) {
                    Column(Modifier.padding(12.dp)) {
                        Text("${userLabel(a)} ↔ ${userLabel(b)}", fontWeight = FontWeight.Bold)
                        Text(c.lastMessage.ifBlank { "—" }, fontSize = 12.sp, color = SlateMuted, maxLines = 1)
                    }
                }
            }
        }
    }

    openConversation?.let { conv ->
        ConversationDialog(viewModel, conv, ::userLabel) { openConversation = null }
    }
}

@Composable
private fun ConversationDialog(
    viewModel: AdminViewModel,
    conversation: Conversation,
    userLabel: (String?) -> String,
    onDismiss: () -> Unit
) {
    val messages by viewModel.conversationMessages(conversation.id).collectAsState(initial = emptyList())

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("وضع الإشراف — قراءة صامتة") },
        text = {
            Column(Modifier.fillMaxSize()) {
                if (messages.isEmpty()) {
                    Text("لا توجد رسائل بعد في هذه المحادثة", style = MaterialTheme.typography.bodySmall)
                } else {
                    messages.forEach { m ->
                        Column(Modifier.padding(vertical = 4.dp)) {
                            Text(userLabel(m.senderId), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                            Text(
                                when (m.mediaType) {
                                    "sticker" -> "[ملصق]"
                                    "image" -> "[صورة]"
                                    "video" -> "[فيديو]"
                                    else -> m.content
                                },
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        },
        confirmButton = { OutlinedButton(onClick = onDismiss) { Text("إغلاق") } }
    )
}
