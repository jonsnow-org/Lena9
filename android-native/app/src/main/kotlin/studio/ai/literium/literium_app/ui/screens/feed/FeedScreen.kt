package studio.ai.literium.literium_app.ui.screens.feed

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.ui.ads.AdSlot
import studio.ai.literium.literium_app.ui.components.ArticleCard
import studio.ai.literium.literium_app.ui.components.TweetCard
import studio.ai.literium.literium_app.ui.components.TweetComposerBar
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * The home feed (spec §4.1/§4.2) — a single screen that switches between Blog (article) and Tweet
 * content via [HomeFeedModeSwitcher], exactly matching the web's single-surface design rather than
 * two separate nav destinations. Blog mode: featured carousel → home_hero ad → trending ranking →
 * main article grid with home_feed_1/home_feed_2 ads interspersed at the same indices the web app
 * uses (idx 2 / idx 8). Tweet mode: composer → tweet list with a tweet_feed ad every 3 tweets.
 */
@Composable
fun FeedScreen(
    onArticleClick: (String) -> Unit,
    onWriterClick: (String) -> Unit,
    onComposeArticle: () -> Unit
) {
    val viewModel: FeedViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        floatingActionButton = {
            if (state.mode == FeedMode.BLOG && state.currentUserId != null) {
                ExtendedFloatingActionButton(onClick = onComposeArticle, containerColor = BrandTeal, contentColor = Color.White) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("ابدأ الكتابة")
                }
            }
        }
    ) { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandTeal)
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                HomeFeedModeSwitcher(mode = state.mode, onModeChange = viewModel::setMode)
            }

            if (state.mode == FeedMode.BLOG) {
                val featured = state.articles.take(4)
                if (featured.isNotEmpty()) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            SectionHeader("مقالات مختارة للتحرير")
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                items(featured, key = { "featured_${it.id}" }) { article ->
                                    FeaturedArticleCard(article, onClick = { onArticleClick(article.id) })
                                }
                            }
                        }
                    }
                }

                item { AdSlot(slotId = AdSlotId.HOME_HERO) }

                val trending = state.articles.sortedByDescending { it.viewsCount }.take(4)
                if (trending.isNotEmpty()) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            SectionHeader("الأكثر رواجاً")
                            trending.forEachIndexed { idx, article ->
                                TrendingRow(rank = idx + 1, article = article, onClick = { onArticleClick(article.id) })
                            }
                        }
                    }
                }

                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("أحدث المقالات المنشورة", fontSize = 15.sp, fontWeight = FontWeight.Black)
                        Text("${state.articles.size} مقال متاح", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                if (state.articles.isEmpty()) {
                    item { EmptyState("لا توجد مقالات منشورة بعد.") }
                } else {
                    itemsIndexed(state.articles, key = { _, a -> a.id }) { idx, article ->
                        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            if (idx == 2) AdSlot(slotId = AdSlotId.HOME_FEED_1)
                            if (idx == 8) AdSlot(slotId = AdSlotId.HOME_FEED_2)
                            ArticleCard(
                                article = article,
                                onClick = { onArticleClick(article.id) },
                                isFollowingAuthor = article.writerId in state.followedWriterIds,
                                onFollowAuthor = viewModel::toggleFollow,
                                isSaved = article.id in state.bookmarkedArticleIds,
                                onSaveBookmark = viewModel::toggleBookmark,
                                onWriterProfileClick = onWriterClick
                            )
                        }
                    }
                }
            } else {
                val currentUser = state.currentUser
                if (currentUser != null) {
                    item {
                        TweetComposerBar(avatarUrl = currentUser.avatarUrl, onSubmit = viewModel::postTweet)
                    }
                }

                if (state.tweets.isEmpty()) {
                    item { EmptyState("لا توجد تغريدات بعد — كن أول من يشارك خاطرة قصيرة.") }
                } else {
                    itemsIndexed(state.tweets, key = { _, t -> t.id }) { idx, tweet ->
                        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            if (idx > 0 && idx % 3 == 0) AdSlot(slotId = AdSlotId.TWEET_FEED)
                            TweetCard(
                                tweet = tweet,
                                currentUserId = state.currentUserId ?: "",
                                isLiked = tweet.id in state.likedTweetIds,
                                isFavorited = tweet.id in state.favoritedTweetIds,
                                isAdmin = state.currentUser?.role == UserRole.ADMIN,
                                comments = state.tweetComments.filter { it.tweetId == tweet.id },
                                onToggleLike = viewModel::toggleTweetLike,
                                onToggleFavorite = viewModel::toggleTweetFavorite,
                                onShare = { viewModel.shareTweet(it.id) },
                                onDelete = viewModel::deleteTweet,
                                onAddComment = viewModel::addTweetComment,
                                onLikeComment = viewModel::likeTweetComment,
                                onReplyToComment = viewModel::replyToTweetComment,
                                onSelectAuthor = onWriterClick
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeFeedModeSwitcher(mode: FeedMode, onModeChange: (FeedMode) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        ModePill("المدونة", mode == FeedMode.BLOG, Modifier.weight(1f)) { onModeChange(FeedMode.BLOG) }
        ModePill("تغريد", mode == FeedMode.TWEET, Modifier.weight(1f)) { onModeChange(FeedMode.TWEET) }
    }
}

@Composable
private fun ModePill(label: String, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = if (active) BrandTeal else Color.Transparent,
        contentColor = if (active) Color.White else BrandTeal,
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            label,
            modifier = Modifier.padding(vertical = 10.dp).fillMaxWidth(),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(title, fontSize = 15.sp, fontWeight = FontWeight.Black)
}

@Composable
private fun FeaturedArticleCard(article: Article, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .width(260.dp)
            .height(160.dp)
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
    ) {
        AsyncImage(
            model = article.featuredImage,
            contentDescription = article.title,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(colors = listOf(Color.Transparent, Color(0xCC000000))))
        )
        Surface(
            modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
            color = BrandAmber,
            contentColor = Color(0xFF0F172A),
            shape = RoundedCornerShape(50)
        ) {
            Text("مختار للتحرير", modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp), fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
        Text(
            article.title,
            modifier = Modifier.align(Alignment.BottomStart).padding(10.dp),
            color = Color.White,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun TrendingRow(rank: Int, article: Article, onClick: () -> Unit) {
    val rankColor = when (rank) {
        1 -> Color(0xFFFACC15)
        2 -> Color(0xFFCBD5E1)
        3 -> Color(0xFFB45309)
        else -> BrandTeal
    }
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(26.dp).clip(RoundedCornerShape(8.dp)).background(rankColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Text("$rank", fontSize = 11.sp, fontWeight = FontWeight.Black, color = rankColor)
            }
            Spacer(Modifier.width(10.dp))
            AsyncImage(
                model = article.featuredImage,
                contentDescription = article.title,
                modifier = Modifier.size(52.dp).clip(RoundedCornerShape(12.dp)),
                contentScale = ContentScale.Crop
            )
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(article.writerName, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                }
            }
        }
    }
}

@Composable
private fun EmptyState(message: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Filled.Article, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(36.dp))
        Spacer(Modifier.height(8.dp))
        Text(message, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
