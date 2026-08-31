package studio.ai.literium.literium_app.ui.screens.explore

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Compass
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.util.DateFormatAr

/**
 * Discovery surface (spec §4.3) — full-fidelity port of `src/components/ExploreView.tsx`: Arabic-
 * normalized search bar, filter tabs (trending/top-rated/writers/locked), a "recommended writers"
 * horizontal strip with inline follow toggles, a trending-tags cloud extracted live from loaded
 * articles' tags, and a ranked article list. The web version also renders an `AdTickerBar` between
 * the writers strip and the tag cloud — that is a second, distinct ad surface from the 13-slot
 * `AdSlot` system this task was scoped against (its `slotId` is free-text, not one of the 13
 * [studio.ai.literium.literium_app.data.model.AdSlotId] values), so it is intentionally omitted here
 * rather than mis-mapped onto an `AdSlot` call — see final report.
 */
@Composable
fun ExploreScreen(
    onArticleClick: (String) -> Unit,
    onWriterClick: (String) -> Unit
) {
    val viewModel: ExploreViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()

    if (state.isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = BrandTeal)
        }
        return
    }

    val filteredArticles = state.filteredArticles
    val filteredWriters = state.filteredWriters

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        modifier = Modifier.size(40.dp).clip(RoundedCornerShape(14.dp)).background(BrandTeal.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Filled.Compass, contentDescription = null, tint = BrandTeal)
                    }
                    Column {
                        Text("استكشف العالم الأدبي", fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text(
                            "تصفح نخبة الكُتّاب، أكثر المقالات رواجاً والمواضيع الأكثر نقاشاً",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                OutlinedTextField(
                    value = state.query,
                    onValueChange = viewModel::setQuery,
                    placeholder = { Text("ابحث عن كاتب، عنوان مقال، فكرة فلسفية...", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(FILTER_TABS) { (filter, label) ->
                    FilterChip(label, active = state.filter == filter) { viewModel.setFilter(filter) }
                }
            }
        }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(20.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        if (state.query.isNotBlank()) "نتائج البحث عن كُتّاب" else "كُتّاب موصى بمتابعتهم",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text("${filteredWriters.size} كاتب", fontSize = 11.sp, color = BrandTeal, fontWeight = FontWeight.Bold)
                }

                if (filteredWriters.isEmpty()) {
                    Text(
                        if (state.query.isNotBlank()) "لا يوجد كاتب يطابق بحثك." else "لا يوجد كُتّاب متاحون حالياً.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(filteredWriters, key = { it.id }) { writer ->
                            WriterMiniCard(
                                writer = writer,
                                isFollowing = writer.id in state.followedWriterIds,
                                onClick = { onWriterClick(writer.id) },
                                onFollowToggle = { viewModel.toggleFollow(writer.id) }
                            )
                        }
                    }
                }
            }
        }

        val tags = state.trendingTags
        if (tags.isNotEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(BrandTeal.copy(alpha = 0.06f), RoundedCornerShape(20.dp))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Filled.TrendingUp, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(16.dp))
                        Text("الوسوم الأكثر تداولاً", fontSize = 13.sp, fontWeight = FontWeight.Black)
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        tags.forEach { (name, count) ->
                            Surface(
                                color = MaterialTheme.colorScheme.surface,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.clickable { viewModel.setQuery(name.replace('_', ' ')) }
                            ) {
                                Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text("#${name.replace('_', ' ')}", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text("$count مقال", fontSize = 10.sp, color = BrandTeal)
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            Text("المقالات المستكشفة (${filteredArticles.size})", fontSize = 14.sp, fontWeight = FontWeight.Black)
        }

        if (filteredArticles.isEmpty()) {
            item {
                Column(Modifier.fillMaxWidth().padding(vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("لا توجد مقالات مطابقة", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text("جرّب تغيير كلمات البحث أو الفلاتر.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            itemsIndexed(filteredArticles, key = { _, a -> a.id }) { idx, article ->
                ExploreArticleRow(
                    rank = idx + 1,
                    article = article,
                    isSaved = article.id in state.bookmarkedArticleIds,
                    onClick = { onArticleClick(article.id) },
                    onBookmarkToggle = { viewModel.toggleBookmark(article.id) }
                )
            }
        }
    }
}

private val FILTER_TABS = listOf(
    ExploreFilter.TRENDING to "🔥 الأكثر رواجاً",
    ExploreFilter.TOP_RATED to "⭐ الأعلى تقييماً",
    ExploreFilter.WRITERS to "✍️ كبار الكُتّاب",
    ExploreFilter.LOCKED to "💎 مقالات مميزة وحصرية"
)

@Composable
private fun FilterChip(label: String, active: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        color = if (active) BrandTeal else MaterialTheme.colorScheme.surface,
        contentColor = if (active) Color.White else MaterialTheme.colorScheme.onSurface,
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(label, modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp), fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun WriterMiniCard(writer: User, isFollowing: Boolean, onClick: () -> Unit, onFollowToggle: () -> Unit) {
    Column(
        modifier = Modifier
            .width(150.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(modifier = Modifier.clickable(onClick = onClick)) {
            AsyncImage(
                model = writer.avatarUrl,
                contentDescription = writer.fullName,
                modifier = Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)),
                contentScale = ContentScale.Crop
            )
            if (writer.isVerified == true) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = BrandTeal,
                    modifier = Modifier.align(Alignment.BottomEnd).size(16.dp)
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(writer.fullName, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            writer.bio?.takeIf { it.isNotBlank() } ?: "كاتب ومفكر في منصة ليتيريوم",
            fontSize = 10.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(6.dp))
        Surface(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onFollowToggle),
            color = if (isFollowing) MaterialTheme.colorScheme.surfaceVariant else BrandTeal,
            contentColor = if (isFollowing) MaterialTheme.colorScheme.onSurfaceVariant else Color.White,
            shape = RoundedCornerShape(10.dp)
        ) {
            Text(
                if (isFollowing) "مُتابَع" else "+ متابعة",
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

@Composable
private fun ExploreArticleRow(rank: Int, article: Article, isSaved: Boolean, onClick: () -> Unit, onBookmarkToggle: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(26.dp).clip(RoundedCornerShape(8.dp)).background(BrandTeal.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Text("$rank", fontSize = 11.sp, fontWeight = FontWeight.Black, color = BrandTeal)
            }
            Spacer(Modifier.width(10.dp))
            AsyncImage(
                model = article.featuredImage,
                contentDescription = article.title,
                modifier = Modifier.size(60.dp).clip(RoundedCornerShape(12.dp)),
                contentScale = ContentScale.Crop
            )
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(article.writerName, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("•", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(DateFormatAr.formatDateTimeAr(article.publishedAt), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(article.title, fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Icon(Icons.Filled.RemoveRedEye, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(11.dp))
                        Text("${article.viewsCount}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Icon(Icons.Filled.Favorite, contentDescription = null, tint = Color(0xFFE11D48), modifier = Modifier.size(11.dp))
                        Text("${article.likesCount}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (article.isLocked) {
                        Text("💎 ${article.lockedPrice ?: 2.99}$", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                    }
                }
            }
            Icon(
                if (isSaved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                contentDescription = "حفظ",
                tint = if (isSaved) BrandTeal else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp).clickable(onClick = onBookmarkToggle)
            )
        }
    }
}
