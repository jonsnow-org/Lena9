package studio.ai.literium.literium_app.ui.screens.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.model.AppNotification
import studio.ai.literium.literium_app.data.model.NotificationType
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.util.DateFormatAr

private fun iconFor(type: String): Pair<ImageVector, Color> = when (type) {
    NotificationType.LIKE -> Icons.Filled.Favorite to Color(0xFFF43F5E)
    NotificationType.COMMENT -> Icons.Filled.ChatBubble to Color(0xFF06B6D4)
    NotificationType.REPLY -> Icons.AutoMirrored.Filled.Reply to Color(0xFF06B6D4)
    NotificationType.FOLLOW -> Icons.Filled.PersonAdd to Color(0xFF14B8A6)
    NotificationType.EARNING -> Icons.Filled.AttachMoney to Color(0xFF10B981)
    NotificationType.WITHDRAWAL -> Icons.Filled.AttachMoney to Color(0xFFF59E0B)
    NotificationType.CAMPAIGN -> Icons.Filled.Campaign to Color(0xFF3B82F6)
    NotificationType.SHARE -> Icons.Filled.Share to Color(0xFF3B82F6)
    else -> Icons.Filled.AutoAwesome to Color(0xFFF59E0B)
}

/** spec §9 — notification center, with real Firestore-backed read-state and delete (see [NotificationsViewModel]'s KDoc). */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun NotificationsScreen(
    navController: NavController,
    viewModel: NotificationsViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var showClearAllConfirm by remember { mutableStateOf(false) }
    var pendingDeleteId by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("الإشعارات والتنبيهات") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::markAllRead) {
                        Icon(Icons.Filled.DoneAll, contentDescription = "تحديد الكل كمقروء")
                    }
                    if (state.notifications.isNotEmpty()) {
                        IconButton(onClick = { showClearAllConfirm = true }) {
                            Icon(Icons.Filled.DeleteSweep, contentDescription = "مسح الكل", tint = MaterialTheme.colorScheme.error)
                        }
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
                state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.errorMessage != null -> Text(
                    state.errorMessage.orEmpty(),
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    color = MaterialTheme.colorScheme.error
                )
                state.notifications.isEmpty() -> Text(
                    "لا توجد إشعارات جديدة حالياً",
                    modifier = Modifier.align(Alignment.Center),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                    verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)
                ) {
                    items(items = state.notifications, key = { it.id }) { notif ->
                        NotificationRow(
                            notification = notif,
                            onClick = {
                                if (!notif.isRead) viewModel.markOneRead(notif.id)
                                when {
                                    !notif.articleId.isNullOrBlank() -> navController.navigate(Screen.ArticleReader.of(notif.articleId!!))
                                    !notif.actorId.isNullOrBlank() -> navController.navigate(Screen.WriterProfile.of(notif.actorId!!))
                                }
                            },
                            onDeleteRequest = { pendingDeleteId = notif.id }
                        )
                    }
                }
            }
        }
    }

    if (showClearAllConfirm) {
        AlertDialog(
            onDismissRequest = { showClearAllConfirm = false },
            title = { Text("مسح كل الإشعارات") },
            text = { Text("مسح كل الإشعارات (${state.notifications.size}) نهائياً؟ لا يمكن التراجع عن هذا.") },
            confirmButton = {
                TextButton(onClick = { viewModel.clearAll(); showClearAllConfirm = false }) {
                    Text("مسح الكل", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { showClearAllConfirm = false }) { Text("إلغاء") } }
        )
    }

    pendingDeleteId?.let { id ->
        AlertDialog(
            onDismissRequest = { pendingDeleteId = null },
            title = { Text("حذف الإشعار") },
            text = { Text("حذف هذا الإشعار نهائياً؟") },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteOne(id); pendingDeleteId = null }) {
                    Text("حذف", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { pendingDeleteId = null }) { Text("إلغاء") } }
        )
    }
}

@Composable
private fun NotificationRow(
    notification: AppNotification,
    onClick: () -> Unit,
    onDeleteRequest: () -> Unit
) {
    val (icon, tint) = iconFor(notification.type)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(
                if (notification.isRead) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                else MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
            )
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surface),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    notification.title,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    DateFormatAr.timeAgoAr(notification.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                notification.message,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        IconButton(onClick = onDeleteRequest, modifier = Modifier.size(28.dp)) {
            Icon(
                Icons.Filled.Delete,
                contentDescription = "حذف الإشعار",
                modifier = Modifier.size(14.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
