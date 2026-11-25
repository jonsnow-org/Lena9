package studio.ai.literium.literium_app.ui.screens.messages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.ads.AdTickerBar
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr

/** قائمة المحادثات — القسم الأيسر/الكامل من DirectMessagesModal.tsx: رأس (أيقونة 36dp + عنوان)، شريط إعلان، صفوف p-3.5. */
@Composable
fun MessagesScreen(
    navController: NavController,
    viewModel: MessagesViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var pendingDelete by remember { mutableStateOf<ConversationDisplay?>(null) }
    val dark = isDark
    val line = if (dark) Tw.slate800 else Tw.slate200
    val shape = RoundedCornerShape(24.dp)

    Box(Modifier.fillMaxSize().padding(8.dp)) {
        Column(Modifier.fillMaxSize().shadow(16.dp, shape, clip = false).clip(shape).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, line, shape)) {
            Row(
                Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(Tw.teal600.copy(alpha = 0.10f)), contentAlignment = Alignment.Center) {
                        LuIcon(Lu.MessageSquare, 20.dp, if (dark) Tw.teal300 else Tw.teal600)
                    }
                    Column {
                        Text("الرسائل والمحادثات", style = twText(16, FontWeight.ExtraBold, 24), color = if (dark) Tw.white else Tw.slate900)
                        Text("تواصل مباشر بين القراء والكتاب", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Box(Modifier.twClickable { navController.navigate(Screen.NewConversation.route) }.padding(6.dp)) { LuIcon(Lu.Plus, 20.dp, Tw.slate400) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(line))

            Box(Modifier.weight(1f).fillMaxWidth()) {
                when {
                    state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Tw.teal600)
                    state.errorMessage != null -> Text(state.errorMessage.orEmpty(), Modifier.align(Alignment.Center).padding(24.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.rose500)
                    else -> LazyColumn(Modifier.fillMaxSize()) {
                        item(key = "ad_ticker") { Box(Modifier.padding(start = 12.dp, end = 12.dp, top = 12.dp)) { AdTickerBar(slotId = AdSlotId.MESSAGES_LIST, viewerId = viewModel.currentUserId) } }
                        if (state.conversations.isEmpty()) item {
                            Text("لا توجد محادثات سابقة حالياً", Modifier.fillMaxWidth().padding(32.dp), style = twText(12, FontWeight.Normal, 16).copy(textAlign = TextAlign.Center), color = Tw.slate400)
                        }
                        items(state.conversations, key = { it.id }) { c ->
                            ConversationRow(c, dark, line, onClick = { navController.navigate(Screen.Chat.of(c.id)) }, onDelete = { pendingDelete = c })
                        }
                    }
                }
            }
        }
    }

    pendingDelete?.let { c ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("حذف المحادثة", style = twText(16, FontWeight.Bold, 24)) },
            text = { Text("حذف المحادثة مع ${c.partnerName} من قائمتك؟ يمكنك استقبال رسائل جديدة منه لاحقاً بلا مشكلة.", style = twText(13, FontWeight.Normal, 20)) },
            confirmButton = { TextButton({ viewModel.hideConversation(c.id); pendingDelete = null }) { Text("حذف", color = Tw.rose500, style = twText(13, FontWeight.Bold, 20)) } },
            dismissButton = { TextButton({ pendingDelete = null }) { Text("إلغاء", style = twText(13, FontWeight.Bold, 20)) } }
        )
    }
}

@Composable
private fun ConversationRow(c: ConversationDisplay, dark: Boolean, line: Color, onClick: () -> Unit, onDelete: () -> Unit) {
    val emphasized = c.unreadCount > 0 && !c.isMutedByMe
    var menu by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().then(if (c.isMutedByMe) Modifier.alpha(0.6f) else Modifier).twClickable(onClick = onClick).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box {
                AsyncImage(c.partnerAvatar, c.partnerName, Modifier.size(40.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                Box(Modifier.align(Alignment.BottomEnd).size(10.dp).clip(CircleShape).background(if (dark) Tw.slate900 else Tw.white).padding(2.dp).clip(CircleShape).background(if (c.isPartnerOnline) Tw.emerald500 else Tw.slate400))
            }
            Column(Modifier.weight(1f)) {
                Row(Modifier.fillMaxWidth().padding(bottom = 2.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(c.partnerName, style = twText(12, if (emphasized) FontWeight.Black else FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                        if (c.isMutedByMe) LuIcon(Lu.BellOff, 12.dp, Tw.slate400)
                    }
                    Text(c.lastMessageTime?.let { DateFormatAr.timeAgoAr(it) } ?: "", Modifier.padding(start = 8.dp), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    val txt = c.lastMessage.ifBlank { "ابدأ المحادثة الآن" }
                    Text(txt, Modifier.weight(1f), style = twText(11, if (emphasized) FontWeight.Bold else FontWeight.Normal, 16), color = if (emphasized) (if (dark) Tw.slate200 else Tw.slate700) else Tw.slate500, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (emphasized) Box(Modifier.padding(start = 8.dp).heightIn(min = 18.dp).width(18.dp).clip(CircleShape).background(Tw.teal600), contentAlignment = Alignment.Center) {
                        Text(if (c.unreadCount > 9) "9+" else "${c.unreadCount}".let { studio.ai.literium.literium_app.ui.theme.arDigits(it) }, style = twText(10, FontWeight.Bold, 14), color = Tw.white)
                    }
                }
            }
            Box {
                Box(Modifier.clip(RoundedCornerShape(8.dp)).twClickable { menu = true }.padding(6.dp)) { LuIcon(Lu.MoreVertical, 14.dp, Tw.slate300) }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }, containerColor = if (dark) Tw.slate800 else Tw.white) {
                    DropdownMenuItem(
                        text = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { LuIcon(Lu.Trash2, 14.dp, Tw.rose500); Text("حذف", style = twText(11, FontWeight.Bold, 16), color = Tw.rose500) } },
                        onClick = { menu = false; onDelete() }
                    )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate100))
    }
}
