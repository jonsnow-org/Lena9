package studio.ai.literium.literium_app.ui.screens.notifications

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.model.AppNotification
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.ads.AdTickerBar
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arDigits
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import java.time.Instant
import java.time.OffsetDateTime

/** formatRelativeTime في NotificationsModal.tsx. */
private fun relativeTime(iso: String): String {
    val ms = runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(iso).toInstant().toEpochMilli() }.getOrNull()
        ?: return iso
    val min = ((System.currentTimeMillis() - ms) / 60000).toInt()
    if (min < 1) return "الآن"
    if (min < 60) return arDigits("منذ $min د")
    val h = min / 60
    if (h < 24) return arDigits("منذ $h س")
    val d = h / 24
    if (d < 30) return arDigits("منذ $d يوم")
    val dt = java.time.Instant.ofEpochMilli(ms).atZone(java.time.ZoneId.systemDefault())
    return arDigits("${dt.dayOfMonth}/${dt.monthValue}")
}

private fun iconFor(type: String): Pair<ImageVector, Color> = when (type) {
    "earning" -> Lu.DollarSign to Tw.emerald500
    "withdrawal" -> Lu.DollarSign to Tw.amber500
    "follow" -> Lu.UserPlus to Color(0xFF14B8A6)
    "comment" -> Lu.MessageSquare to Color(0xFF06B6D4)
    "reply" -> Lu.Reply to Color(0xFF06B6D4)
    "like" -> Lu.Heart to Tw.rose500
    "campaign" -> Lu.Megaphone to Color(0xFF3B82F6)
    else -> Lu.Sparkles to Tw.amber500
}

/** الإشعارات — NotificationsModal.tsx كصفحة: بطاقة rounded-3xl برأس/قائمة (p-4 space-y-2.5)/تذييل أفعال. */
@Composable
fun NotificationsScreen(
    navController: NavController,
    viewModel: NotificationsViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var showClearAll by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<String?>(null) }
    val dark = isDark
    val line = if (dark) Tw.slate800 else Tw.slate200
    val shape = RoundedCornerShape(24.dp)

    Box(Modifier.fillMaxSize().padding(8.dp)) {
        Column(Modifier.fillMaxSize().shadow(16.dp, shape, clip = false).clip(shape).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, line, shape)) {
            // الرأس
            Row(
                Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LuIcon(Lu.Bell, 20.dp, if (dark) Tw.teal300 else Tw.teal600)
                    Text("الإشعارات والتنبيهات", style = twText(16, FontWeight.ExtraBold, 24), color = if (dark) Tw.white else Tw.slate900)
                }
                Box(Modifier.twClickable { navController.popBackStack() }.padding(6.dp)) { LuIcon(Lu.X, 20.dp, Tw.slate400) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(line))

            // القائمة
            Box(Modifier.weight(1f).fillMaxWidth()) {
                when {
                    state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Tw.teal600)
                    else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (state.notifications.isNotEmpty()) item { AdTickerBar(slotId = "notifications_list", minHeightDp = 68.dp, modifier = Modifier.fillMaxWidth()) }
                        if (state.errorMessage != null) item { Text(state.errorMessage.orEmpty(), Modifier.fillMaxWidth().padding(32.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.rose500) }
                        else if (state.notifications.isEmpty()) item {
                            Text("لا توجد إشعارات جديدة حالياً", Modifier.fillMaxWidth().padding(32.dp), style = twText(12, FontWeight.Normal, 16).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = Tw.slate400)
                        }
                        items(state.notifications, key = { it.id }) { n ->
                            Row2(n, dark,
                                onClick = {
                                    if (!n.isRead) viewModel.markOneRead(n.id)
                                    when {
                                        !n.articleId.isNullOrBlank() -> navController.navigate(Screen.ArticleReader.of(n.articleId!!))
                                        !n.actorId.isNullOrBlank() -> navController.navigate(Screen.WriterProfile.of(n.actorId!!))
                                    }
                                },
                                onDelete = { pendingDelete = n.id })
                        }
                    }
                }
            }

            // التذييل
            Box(Modifier.fillMaxWidth().height(1.dp).background(line))
            Row(
                Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.twClickable { viewModel.markAllRead() }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        LuIcon(Lu.Check, 14.dp, if (dark) Tw.teal300 else Tw.teal600)
                        Text("تحديد الكل كمقروء", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal600)
                    }
                    if (state.notifications.isNotEmpty()) Row(Modifier.twClickable { showClearAll = true }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        LuIcon(Lu.Trash2, 14.dp, if (dark) Tw.rose400 else Tw.rose500)
                        Text("مسح الكل", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.rose400 else Tw.rose500)
                    }
                }
                Box(Modifier.clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate200).twClickable { navController.popBackStack() }.padding(horizontal = 16.dp, vertical = 6.dp)) {
                    Text("إغلاق", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                }
            }
        }
    }

    if (showClearAll) AlertDialog(
        onDismissRequest = { showClearAll = false },
        title = { Text("مسح الكل", style = twText(16, FontWeight.Bold, 24)) },
        text = { Text(arDigits("مسح كل الإشعارات (${state.notifications.size}) نهائياً؟ لا يمكن التراجع عن هذا."), style = twText(13, FontWeight.Normal, 20)) },
        confirmButton = { TextButton({ viewModel.clearAll(); showClearAll = false }) { Text("مسح", color = Tw.rose500, style = twText(13, FontWeight.Bold, 20)) } },
        dismissButton = { TextButton({ showClearAll = false }) { Text("إلغاء", style = twText(13, FontWeight.Bold, 20)) } }
    )
    pendingDelete?.let { id ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("حذف الإشعار", style = twText(16, FontWeight.Bold, 24)) },
            text = { Text("حذف هذا الإشعار نهائياً؟", style = twText(13, FontWeight.Normal, 20)) },
            confirmButton = { TextButton({ viewModel.deleteOne(id); pendingDelete = null }) { Text("حذف", color = Tw.rose500, style = twText(13, FontWeight.Bold, 20)) } },
            dismissButton = { TextButton({ pendingDelete = null }) { Text("إلغاء", style = twText(13, FontWeight.Bold, 20)) } }
        )
    }
}

@Composable
private fun Row2(n: AppNotification, dark: Boolean, onClick: () -> Unit, onDelete: () -> Unit) {
    val s = RoundedCornerShape(16.dp)
    val (icon, tint) = iconFor(n.type)
    val bg = if (n.isRead) (if (dark) Tw.slate800.copy(alpha = 0.40f) else Tw.slate50.copy(alpha = 0.50f)) else (if (dark) Color(0xFF042F2E).copy(alpha = 0.40f) else Color(0xFFF0FDFA).copy(alpha = 0.70f))
    val br = if (n.isRead) (if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.60f)) else (if (dark) Color(0xFF115E59) else Color(0xFF99F6E4))
    Row(Modifier.fillMaxWidth().clip(s).background(bg).border(1.dp, br, s).twClickable(onClick = onClick).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        val is8 = RoundedCornerShape(12.dp)
        Box(Modifier.size(32.dp).shadow(1.dp, is8, clip = false).clip(is8).background(if (dark) Tw.slate800 else Tw.white), contentAlignment = Alignment.Center) { LuIcon(icon, 16.dp, tint) }
        Column(Modifier.weight(1f)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 2.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(n.title, Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900)
                Text(relativeTime(n.createdAt), Modifier.padding(start = 8.dp), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
            }
            Text(n.message, style = twText(12, FontWeight.Normal, 19), color = if (dark) Tw.slate300 else Tw.slate600)
        }
        Box(Modifier.clip(RoundedCornerShape(8.dp)).twClickable(onClick = onDelete).padding(6.dp)) { LuIcon(Lu.Trash2, 14.dp, Tw.slate300) }
    }
}
