package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Conversation
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr

private const val FALLBACK_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"

/** "مراقبة المحادثات — جودة المنصة" — ترجمة حرفية لـ AdminChatsTab.tsx (القراءة صامتة: لا isRead ولا typing). */
@Composable
fun ChatsTab(viewModel: AdminViewModel, users: List<User>) {
    val conversations by viewModel.conversations.collectAsState()
    var search by remember { mutableStateOf("") }
    var openConversation by remember { mutableStateOf<Conversation?>(null) }

    fun name(id: String?): String {
        val u = users.find { it.id == id }
        return u?.penName ?: u?.companyName ?: u?.fullName ?: "مستخدم محذوف"
    }
    fun avatar(id: String?): String = users.find { it.id == id }?.avatarUrl ?: FALLBACK_AVATAR

    val q = search.trim().lowercase()
    val filtered = if (q.isEmpty()) conversations else conversations.filter { c ->
        val a = c.participants.getOrNull(0); val b = c.participants.getOrNull(1)
        name(a).lowercase().contains(q) || name(b).lowercase().contains(q)
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        AdmCard(bg = Tw.slate900.copy(alpha = 0.9f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.ShieldAlert, 20.dp, Adm.amber400)
                Text("مراقبة المحادثات — جودة المنصة", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text(
                "جدول بكل المحادثات الجارية بين المستخدمين حالياً. القراءة هنا صامتة تماماً ولا تُخطر أياً من الطرفين — استخدمها فقط للتحقق من بلاغات إساءة حقيقية أو مراقبة جودة المحتوى.",
                Modifier.padding(top = 2.dp, bottom = 16.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400
            )
            val s = RoundedCornerShape(12.dp)
            Box(Modifier.fillMaxWidth().clip(s).background(Tw.slate800).border(1.dp, Tw.slate700, s).padding(horizontal = 14.dp, vertical = 8.dp)) {
                if (search.isEmpty()) Text("ابحث باسم مستخدم...", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
                androidx.compose.foundation.text.BasicTextField(
                    value = search, onValueChange = { search = it }, singleLine = true,
                    textStyle = twText(12, FontWeight.Normal, 16).copy(color = Color.White),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(Color.White), modifier = Modifier.fillMaxWidth()
                )
            }
        }

        val s16 = RoundedCornerShape(16.dp)
        Column(Modifier.fillMaxWidth().clip(s16).background(Tw.slate900.copy(alpha = 0.9f)).border(1.dp, Tw.slate800, s16)) {
            if (filtered.isEmpty()) {
                Text("لا توجد محادثات مطابقة حالياً", Modifier.fillMaxWidth().padding(32.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            } else {
                filtered.forEachIndexed { i, c ->
                    val a = c.participants.getOrNull(0); val b = c.participants.getOrNull(1)
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            listOf(a, b).forEach { id ->
                                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    AsyncImage(avatar(id), null, Modifier.size(28.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                                    Text(name(id), style = twText(12, FontWeight.Bold, 16), color = Tw.slate200, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(c.lastMessage.ifBlank { "—" }, Modifier.weight(1f), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(c.lastMessageAt?.let { DateFormatAr.timeAgoAr(it) } ?: "", Modifier.padding(start = 8.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
                        }
                        AdmButton("قراءة صامتة", { openConversation = c }, Adm.amber500.copy(alpha = 0.1f), Adm.amber400, Adm.amber500.copy(alpha = 0.3f), Lu.Eye)
                    }
                    if (i < filtered.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(Tw.slate800.copy(alpha = 0.6f)))
                }
            }
        }
    }

    openConversation?.let { conv -> ConversationDialog(viewModel, conv, ::name, ::avatar) { openConversation = null } }
}

@Composable
private fun ConversationDialog(
    viewModel: AdminViewModel,
    conversation: Conversation,
    name: (String?) -> String,
    avatar: (String?) -> String,
    onDismiss: () -> Unit
) {
    val messages by viewModel.conversationMessages(conversation.id).collectAsState(initial = emptyList())
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        val s = RoundedCornerShape(24.dp)
        Column(Modifier.padding(16.dp).fillMaxWidth().height(520.dp).clip(s).background(Tw.slate900).border(1.dp, Tw.slate700, s)) {
            Row(
                Modifier.fillMaxWidth().background(Adm.amber500.copy(alpha = 0.1f)).padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LuIcon(Lu.Flag, 16.dp, Adm.amber400)
                    Text("وضع الإشراف — أنت تقرأ هذه المحادثة دون علم الطرفين", style = twText(12, FontWeight.Bold, 16), color = Adm.amber400)
                }
                Box(Modifier.twClickable { onDismiss() }.padding(4.dp)) { LuIcon(Lu.X, 16.dp, Tw.slate400) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Tw.slate800))
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (messages.isEmpty()) {
                    Column(Modifier.fillMaxWidth().padding(top = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(Lu.MessageSquare, 24.dp, Tw.slate500)
                        Text("لا توجد رسائل بعد في هذه المحادثة", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
                    }
                } else {
                    messages.forEach { m ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                            AsyncImage(avatar(m.senderId), null, Modifier.padding(top = 2.dp).size(24.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                            Column(Modifier.weight(1f, fill = false)) {
                                Row(Modifier.padding(bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(name(m.senderId), style = twText(11, FontWeight.Bold, 16), color = Tw.slate300)
                                    Text(DateFormatAr.timeAgoAr(m.createdAt), style = twText(9, FontWeight.Normal, 12), color = Tw.slate500)
                                }
                                Column(Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate800).padding(horizontal = 12.dp, vertical = 8.dp)) {
                                    if (m.mediaType == "image" && !m.mediaUrl.isNullOrBlank()) {
                                        AsyncImage(m.mediaUrl, null, Modifier.padding(bottom = 4.dp).height(192.dp).clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Fit)
                                    }
                                    if (m.mediaType == "video" && !m.mediaUrl.isNullOrBlank()) {
                                        Text("[فيديو]", Modifier.padding(bottom = 4.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                                    }
                                    Text(if (m.mediaType == "sticker") "[ملصق]" else m.content,
                                        style = twText(12, FontWeight.Normal, 16), color = if (m.mediaType == "sticker") Tw.slate400 else Tw.slate200)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
