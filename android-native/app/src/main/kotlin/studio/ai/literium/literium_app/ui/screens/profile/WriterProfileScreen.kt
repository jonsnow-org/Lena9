package studio.ai.literium.literium_app.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.navigation.Screen

@Composable
fun WriterProfileScreen(navController: NavController, userId: String) {
    val viewModel: WriterProfileViewModel = viewModel(
        key = "writer_profile_$userId",
        factory = viewModelFactory { initializer { WriterProfileViewModel(userId) } }
    )
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.openConversation.collect { conversationId ->
            navController.navigate(Screen.Chat.of(conversationId))
        }
    }
    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.writer?.let { it.penName ?: it.fullName } ?: "الملف الشخصي") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "عودة")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) { Snackbar(it) } }
    ) { padding ->
        when {
            state.isLoading -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            state.writer == null -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("لم يُعثر على هذا المستخدم.") }
            else -> {
                val writer = state.writer!!
                LazyColumn(Modifier.fillMaxSize().padding(padding)) {
                    item {
                        Column(Modifier.fillMaxWidth()) {
                            AsyncImage(
                                model = writer.coverUrl,
                                contentDescription = null,
                                modifier = Modifier.fillMaxWidth().height(140.dp).background(MaterialTheme.colorScheme.surfaceVariant)
                            )
                            Column(Modifier.padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box {
                                        AsyncImage(
                                            model = writer.avatarUrl,
                                            contentDescription = writer.fullName,
                                            modifier = Modifier.size(84.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant)
                                        )
                                        if (writer.isVerified == true) {
                                            Icon(
                                                Icons.Filled.Verified,
                                                contentDescription = "موثق",
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.align(Alignment.BottomEnd).size(20.dp)
                                            )
                                        }
                                    }
                                    Spacer(Modifier.width(12.dp))
                                    Column {
                                        Text(writer.penName ?: writer.fullName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                                        Text("@${writer.username}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.secondaryContainer) {
                                                Text(state.memberStatusLabel, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall)
                                            }
                                            if (writer.isKycVerified == true) {
                                                Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.tertiaryContainer) {
                                                    Text("KYC موثق", modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall)
                                                }
                                            }
                                        }
                                        if (state.isFollowingMe) {
                                            Text("يتابعك", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                                        }
                                    }
                                }

                                if (!writer.bio.isNullOrBlank()) {
                                    Spacer(Modifier.height(8.dp))
                                    Text(writer.bio!!, style = MaterialTheme.typography.bodyMedium)
                                }

                                Spacer(Modifier.height(12.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Button(onClick = viewModel::openDirectMessage, enabled = !state.isMessageBusy, modifier = Modifier.weight(1f)) {
                                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("رسالة مباشرة")
                                    }
                                    OutlinedButton(onClick = viewModel::toggleFollow, modifier = Modifier.weight(1f)) {
                                        Text(if (state.isFollowing) "إلغاء المتابعة" else "متابعة")
                                    }
                                }

                                Spacer(Modifier.height(14.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    StatItem("${state.followersCount}", "متابع") { navController.navigate(Screen.FollowList.of(userId, followers = true)) }
                                    StatItem("${state.followingCount}", "متابَع") { navController.navigate(Screen.FollowList.of(userId, followers = false)) }
                                    StatItem("${state.articles.size}", "مقال", null)
                                    StatItem("${state.totalViews}", "مشاهدة", null)
                                    StatItem(String.format("%.1f", state.avgRating), "تقييم", null)
                                }
                            }
                        }
                        HorizontalDivider()
                    }

                    item {
                        TabRow(selectedTabIndex = if (state.activeTab == WriterProfileTab.ARTICLES) 0 else 1) {
                            Tab(selected = state.activeTab == WriterProfileTab.ARTICLES, onClick = { viewModel.selectTab(WriterProfileTab.ARTICLES) }, text = { Text("المقالات المنشورة") })
                            Tab(selected = state.activeTab == WriterProfileTab.ABOUT, onClick = { viewModel.selectTab(WriterProfileTab.ABOUT) }, text = { Text("عن الكاتب والروابط") })
                        }
                    }

                    if (state.activeTab == WriterProfileTab.ARTICLES) {
                        if (state.articles.isEmpty()) {
                            item { Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text("لا توجد مقالات منشورة بعد.") } }
                        } else {
                            items(state.articles, key = { it.id }) { article: Article ->
                                Row(
                                    modifier = Modifier.fillMaxWidth()
                                        .clickable { navController.navigate(Screen.ArticleReader.of(article.id)) }
                                        .padding(horizontal = 16.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    AsyncImage(
                                        model = article.featuredImage,
                                        contentDescription = null,
                                        modifier = Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
                                    )
                                    Spacer(Modifier.width(12.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(article.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Filled.Star, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.tertiary)
                                            Text("${article.rating}  •  ${article.viewsCount} مشاهدة", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        item {
                            Column(Modifier.padding(16.dp)) {
                                if (!writer.specialties.isNullOrEmpty()) {
                                    Text("التخصصات", fontWeight = FontWeight.Bold)
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        writer.specialties!!.forEach { spec ->
                                            Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.surfaceVariant) {
                                                Text(spec, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall)
                                            }
                                        }
                                    }
                                    Spacer(Modifier.height(16.dp))
                                }
                                Text("الروابط الاجتماعية", fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(6.dp))
                                val links = writer.socialLinks
                                val entries = listOfNotNull(
                                    links?.website?.let { "الموقع" to it },
                                    links?.youtube?.let { "يوتيوب" to it },
                                    links?.twitter?.let { "X (تويتر)" to it },
                                    links?.instagram?.let { "انستغرام" to it },
                                    links?.facebook?.let { "فيسبوك" to it },
                                    links?.linkedin?.let { "لينكدإن" to it },
                                    links?.telegram?.let { "تيليجرام" to it },
                                    links?.whatsapp?.let { "واتساب" to it }
                                )
                                if (entries.isEmpty()) {
                                    Text("لا توجد روابط اجتماعية مضافة بعد.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                } else {
                                    entries.forEach { (label, _) ->
                                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                                            Icon(Icons.Filled.Language, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(6.dp))
                                            Text(label, style = MaterialTheme.typography.bodyMedium)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }
}

@Composable
private fun StatItem(value: String, label: String, onClick: (() -> Unit)?) {
    Column(
        modifier = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
