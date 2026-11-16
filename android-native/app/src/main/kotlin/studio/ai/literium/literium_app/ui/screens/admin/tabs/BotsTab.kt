package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.AlertDialog
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TextButton
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr

private fun normalizeForDuplicate(text: String): String =
    text.replace(Regex("[\\u064B-\\u065F\\u0670\\u0640]"), "")
        .replace(Regex("[أإآ]"), "ا").replace("ى", "ي").replace("ة", "ه")
        .replace(Regex("[^\\p{L}\\p{N}]+"), "").lowercase()

/** "بوتات النشر والتفاعل" — ترجمة حرفية لـ AdminBotsTab.tsx. */
@Composable
fun BotsTab(viewModel: AdminViewModel, users: List<User>) {
    val bots = users.filter { it.isBot == true }
    val publishingBotsEnabled by viewModel.publishingBotsEnabled.collectAsState()
    val activity by viewModel.botActivity.collectAsState()
    val content by viewModel.botContent.collectAsState()
    var selected by remember { mutableStateOf(setOf<String>()) }
    var confirm by remember { mutableStateOf<Pair<String, () -> Unit>?>(null) }
    val botIds = bots.map { it.id }

    LaunchedEffect(Unit) { viewModel.loadBotActivity() }
    LaunchedEffect(bots.size) { viewModel.loadBotContent(botIds) }

    val botTweets = content.filter { it.type == "tweet" }
    val duplicateTweetIds = remember(content) {
        val sorted = botTweets.sortedBy { it.createdAt }
        val seen = mutableListOf<String>(); val dups = mutableListOf<String>()
        for (t in sorted) {
            val n = normalizeForDuplicate(t.title)
            if (n.isEmpty()) continue
            val isDup = seen.any { k -> k == n || (n.length > 24 && k.length > 24 && k.startsWith(n.take(40))) }
            if (isDup) dups.add(t.id) else seen.add(n)
        }
        dups
    }
    val allSelected = content.isNotEmpty() && selected.size == content.size

    fun deleteItems(items: List<studio.ai.literium.literium_app.data.model.BotPublishedItem>) {
        viewModel.deleteBotContent(items, botIds); selected = emptySet()
    }

    val shape16 = RoundedCornerShape(16.dp)
    @Composable
    fun Panel(content: @Composable () -> Unit) {
        Column(Modifier.fillMaxWidth().clip(shape16).background(Tw.slate900).border(1.dp, Tw.slate800, shape16).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
    @Composable
    fun SmallBtn(icon: ImageVector, onClick: () -> Unit) {
        Box(Modifier.clip(RoundedCornerShape(8.dp)).background(Tw.slate800).twClickable { onClick() }.padding(6.dp)) { LuIcon(icon, 14.dp, Tw.slate300) }
    }
    @Composable
    fun TimeLine(iso: String) = Text(
        if (iso.isNotBlank()) DateFormatAr.timeAgoAr(iso) else "", Modifier.padding(top = 2.dp), style = twText(10, FontWeight.Normal, 14), color = Tw.slate500
    )

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Panel {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(brand.s600.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) { LuIcon(Lu.Bot, 20.dp, brand.s500) }
                Column(Modifier.weight(1f)) {
                    Text("بوتات النشر والتفاعل التلقائي", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                    Text("مقال واحد وتغريدة واحدة يومياً بالتداول بين 8 حسابات كتّاب افتراضيين، مع إعجابات وتعليقات تلقائية فيما بينها. مستبعدة تماماً من الأرباح والإحصاءات الداخلية.",
                        Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
            }
            Row(
                Modifier.clip(RoundedCornerShape(12.dp)).background(if (publishingBotsEnabled) Adm.emerald600 else Tw.slate800)
                    .twClickable { viewModel.setPublishingBotsEnabled(!publishingBotsEnabled) }.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                LuIcon(Lu.Power, 14.dp, if (publishingBotsEnabled) Color.White else Tw.slate400)
                Text(if (publishingBotsEnabled) "مفعّل ✓" else "متوقف", style = twText(12, FontWeight.Black, 16), color = if (publishingBotsEnabled) Color.White else Tw.slate400)
            }
        }

        Panel {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.Users2, 16.dp, brand.s500)
                Text("حسابات الكتّاب الافتراضيين (${bots.size}/8)", style = twText(14, FontWeight.Bold, 20), color = Color.White)
            }
            if (bots.isEmpty()) {
                Text("لا توجد حسابات بعد — اضغط \"تهيئة الحسابات\" لإنشاء الحسابات الثمانية.", Modifier.fillMaxWidth().padding(vertical = 24.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500, textAlign = TextAlign.Center)
            } else {
                bots.forEach { bot ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate800.copy(alpha = 0.6f)).border(1.dp, Tw.slate700.copy(alpha = 0.5f), RoundedCornerShape(12.dp)).padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        AsyncImage(bot.avatarUrl, bot.fullName, Modifier.size(40.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                        Column(Modifier.weight(1f)) {
                            Text(bot.fullName, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(bot.bio ?: "", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }

        Panel {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("المحتوى المنشور (${content.size})", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                SmallBtn(Lu.RefreshCw) { viewModel.loadBotContent(botIds) }
            }
            val delAllEnabled = botTweets.isNotEmpty()
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate900).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp))
                    .twClickable(enabled = delAllEnabled) {
                        confirm = "سيتم حذف كل تغريدات البوتات (${botTweets.size} تغريدة) نهائياً. مقالات البوتات لن تتأثر. هذا الإجراء لا رجعة فيه. هل تريد المتابعة؟" to { deleteItems(botTweets) }
                    }.padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
            ) {
                LuIcon(Lu.Trash2, 16.dp, Color.White.copy(alpha = if (delAllEnabled) 1f else 0.4f))
                Text("  حذف كل تغريدات البوتات (${botTweets.size})", style = twText(12, FontWeight.Bold, 16), color = Color.White.copy(alpha = if (delAllEnabled) 1f else 0.4f))
            }
            val delDupEnabled = duplicateTweetIds.isNotEmpty()
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate900).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp))
                    .twClickable(enabled = delDupEnabled) {
                        confirm = "سيتم حذف ${duplicateTweetIds.size} تغريدة مكررة وإبقاء أقدم نسخة من كل نص. هل تريد المتابعة؟" to
                            { deleteItems(botTweets.filter { it.id in duplicateTweetIds }) }
                    }.padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
            ) {
                LuIcon(Lu.Trash2, 16.dp, Color.White.copy(alpha = if (delDupEnabled) 1f else 0.4f))
                Text("  حذف التغريدات المكررة (${duplicateTweetIds.size})", style = twText(12, FontWeight.Bold, 16), color = Color.White.copy(alpha = if (delDupEnabled) 1f else 0.4f))
            }

            if (content.isEmpty()) {
                Text("لا يوجد محتوى منشور من البوتات بعد.", Modifier.fillMaxWidth().padding(vertical = 24.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500, textAlign = TextAlign.Center)
            } else {
                Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.twClickable { selected = if (allSelected) emptySet() else content.map { it.id }.toSet() }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LuIcon(if (allSelected) Lu.CheckSquare else Lu.Square, 16.dp, if (allSelected) brand.s500 else Tw.slate300)
                        Text(if (allSelected) "إلغاء تحديد الكل" else "تحديد الكل", style = twText(11, FontWeight.Bold, 16), color = Tw.slate300)
                    }
                    val en = selected.isNotEmpty()
                    Row(
                        Modifier.clip(RoundedCornerShape(8.dp)).background(Color(0xFFDC2626).copy(alpha = 0.15f))
                            .twClickable(enabled = en) {
                                confirm = "سيتم حذف ${selected.size} عنصر محدد نهائياً (مقالات و/أو تغريدات البوتات). هذا الإجراء لا رجعة فيه. هل تريد المتابعة؟" to
                                    { deleteItems(content.filter { it.id in selected }) }
                            }.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        LuIcon(Lu.Trash2, 14.dp, Color(0xFFF87171).copy(alpha = if (en) 1f else 0.4f))
                        Text("حذف المحدد (${selected.size})", style = twText(11, FontWeight.Bold, 16), color = Color(0xFFF87171).copy(alpha = if (en) 1f else 0.4f))
                    }
                }
                Column(Modifier.heightIn(max = 384.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    content.forEach { item ->
                        val sel = item.id in selected
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                                .background(if (sel) Color(0xFFDC2626).copy(alpha = 0.10f) else Tw.slate800.copy(alpha = 0.4f))
                                .border(1.dp, if (sel) Color(0xFFDC2626).copy(alpha = 0.4f) else Color.Transparent, RoundedCornerShape(8.dp))
                                .twClickable(pressScale = 1f) { selected = if (sel) selected - item.id else selected + item.id }.padding(10.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top
                        ) {
                            LuIcon(if (sel) Lu.CheckSquare else Lu.Square, 16.dp, if (sel) Color(0xFFF87171) else Tw.slate500, Modifier.padding(top = 2.dp))
                            LuIcon(if (item.type == "article") Lu.FileText else Lu.Rss, 14.dp, brand.s500, Modifier.padding(top = 2.dp))
                            Column(Modifier.weight(1f)) {
                                Text(item.title, style = twText(11, FontWeight.Normal, 16), color = Tw.slate300, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                TimeLine(item.createdAt)
                            }
                        }
                    }
                }
            }
        }

        Panel {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("آخر نشاطات البوتات", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                SmallBtn(Lu.RefreshCw) { viewModel.loadBotActivity() }
            }
            if (activity.isEmpty()) {
                Text("لا يوجد نشاط مسجَّل بعد.", Modifier.fillMaxWidth().padding(vertical = 24.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500, textAlign = TextAlign.Center)
            } else {
                Column(Modifier.heightIn(max = 384.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    activity.forEach { entry ->
                        val icon = when (entry.type) { "tweet" -> Lu.Rss; "like" -> Lu.Heart; "comment" -> Lu.MessageCircle; else -> Lu.FileText }
                        val label = when (entry.type) { "tweet" -> "نشر تغريدة"; "like" -> "أعجب بـ"; "comment" -> "علّق على"; else -> "نشر مقالاً" }
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Tw.slate800.copy(alpha = 0.4f)).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                            LuIcon(icon, 14.dp, brand.s500, Modifier.padding(top = 2.dp))
                            Column(Modifier.weight(1f)) {
                                Text(buildString { append(entry.botName); append(" "); append(label); if (entry.summary.isNotBlank()) { append(": "); append(entry.summary) } },
                                    style = twText(11, FontWeight.Normal, 16), color = Tw.slate300)
                                TimeLine(entry.createdAt)
                            }
                        }
                    }
                }
            }
        }
    }

    confirm?.let { (msg, action) ->
        AlertDialog(
            onDismissRequest = { confirm = null },
            text = { Text(msg) },
            confirmButton = { TextButton(onClick = { confirm = null; action() }) { Text("متابعة") } },
            dismissButton = { TextButton(onClick = { confirm = null }) { Text("إلغاء") } }
        )
    }
}
