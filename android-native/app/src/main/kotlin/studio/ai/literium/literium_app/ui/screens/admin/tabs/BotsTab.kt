package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel

/**
 * "بوتات النشر والتفاعل التلقائي" — Compose port of `AdminBotsTab.tsx`.
 * Toggle/activity/content-list/delete all go through [AdminRepository]'s
 * publishing-bots methods, already built. The source's "seed 8 bot
 * accounts" action (`onSeedBotAccounts`) has no ported equivalent — the
 * live server has no `/api/admin/bots/seed` route exposed to this client
 * either (see [LiteriumApiService]'s file KDoc: deliberately excluded as a
 * destructive ops-only utility), so no seed button is offered here; the
 * bots list simply reflects whatever `isBot` accounts already exist.
 */
@Composable
fun BotsTab(viewModel: AdminViewModel, users: List<User>) {
    val bots = users.filter { it.isBot == true }
    val publishingBotsEnabled by viewModel.publishingBotsEnabled.collectAsState()
    val activity by viewModel.botActivity.collectAsState()
    val content by viewModel.botContent.collectAsState()
    var selected by remember { mutableStateOf(setOf<String>()) }

    LaunchedEffect(Unit) { viewModel.loadBotActivity() }
    LaunchedEffect(bots.map { it.id }) { viewModel.loadBotContent(bots.map { it.id }) }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Card {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("بوتات النشر والتفاعل التلقائي", fontWeight = FontWeight.Bold)
                        Text("مقال وتغريدة يومياً بالتداول بين 8 حسابات افتراضية، مستبعدة من الأرباح.", style = MaterialTheme.typography.labelSmall)
                    }
                    Switch(checked = publishingBotsEnabled, onCheckedChange = { viewModel.setPublishingBotsEnabled(it) })
                }
            }
        }

        item { Text("حسابات الكتّاب الافتراضيين (${bots.size}/8)", fontWeight = FontWeight.Bold) }
        items(bots, key = { it.id }) { bot ->
            Card {
                Row(Modifier.padding(10.dp)) {
                    AsyncImage(model = bot.avatarUrl, contentDescription = bot.fullName, modifier = Modifier.size(40.dp).clip(CircleShape))
                    Column(Modifier.padding(start = 8.dp)) {
                        Text(bot.fullName, fontWeight = FontWeight.Bold)
                        Text(bot.bio ?: "", style = MaterialTheme.typography.labelSmall, maxLines = 1)
                    }
                }
            }
        }

        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Text(
                    "المحتوى المنشور (${content.size})",
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f).padding(end = 8.dp),
                    maxLines = 2,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                if (selected.isNotEmpty()) {
                    OutlinedButton(onClick = {
                        viewModel.deleteBotContent(content.filter { it.id in selected }, bots.map { it.id })
                        selected = emptySet()
                    }) { Text("حذف المحدد (${selected.size})") }
                }
            }
        }
        items(content.take(50), key = { it.id }) { item ->
            Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                Checkbox(
                    checked = item.id in selected,
                    onCheckedChange = { checked ->
                        selected = if (checked) selected + item.id else selected - item.id
                    }
                )
                Column {
                    Text(item.title, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                    Text(item.createdAt, style = MaterialTheme.typography.labelSmall)
                }
            }
        }

        item { Text("آخر نشاطات البوتات", fontWeight = FontWeight.Bold) }
        if (activity.isEmpty()) {
            item { EmptyHint("لا يوجد نشاط مسجَّل بعد.") }
        } else {
            items(activity.take(30), key = { it.id }) { entry ->
                Card {
                    Column(Modifier.padding(10.dp)) {
                        Text("${entry.botName}: ${entry.summary}", style = MaterialTheme.typography.bodySmall)
                        Text(entry.createdAt, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}
