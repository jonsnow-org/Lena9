package studio.ai.literium.literium_app.ui.screens.feed

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
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
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.ui.ads.AdSlot
import studio.ai.literium.literium_app.data.model.ArticleCategory
import studio.ai.literium.literium_app.ui.components.ArticleCard
import studio.ai.literium.literium_app.ui.components.articleCategoryLabelAr
import studio.ai.literium.literium_app.ui.components.TweetCard
import studio.ai.literium.literium_app.ui.components.TweetComposerBar
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/** Matches `App.tsx`'s `categoryFilters` array exactly ("جميع المقالات" + the 15 real categories, in
 *  the same order — [ArticleCategory.GENERAL] is a storage fallback, not a filter option on web
 *  either). Was entirely missing before — a real gap found by comparing directly against web. */
private val CATEGORY_FILTERS: List<Pair<String, String>> =
    listOf("all" to "جميع المقالات") +
        ArticleCategory.ALL.filter { it != ArticleCategory.GENERAL }.map { it to articleCategoryLabelAr(it) }

/**
 * The home feed (spec §4.1/§4.2) — a single screen that switches between Blog (article) and Tweet
 * content via [HomeFeedModeSwitcher], exactly matching the web's single-surface design rather than
 * two separate nav destinations. Blog mode: featured carousel → home_hero ad → trending ranking →
 * main article grid with home_feed_1/home_feed_2 ads interspersed at the same indices the web app
 * uses (idx 2 / idx 8). Tweet mode: composer → tweet list with a tweet_feed ad every 3 tweets.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    onArticleClick: (String) -> Unit,
    onWriterClick: (String) -> Unit,
    onComposeArticle: () -> Unit
) {
    val viewModel: FeedViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()

    // لا يوجد زر عائم خاص بهذه الشاشة — الويب لديه زر قلم واحد فقط عالمي (`MainScaffold`'s FAB،
    // مطابق لـ `btn-floating-write` في `App.tsx`)، تكرار زر هنا كان يسبب ظهور زرين معاً (بلاغ مستخدم).
    Scaffold { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandTeal)
            }
            return@Scaffold
        }

        // سحب-للتحديث + جلب حقيقي مرة واحدة من الخادم (مطابق لـ `handleRefreshFeed` في `App.tsx`):
        // مستمعا observeArticles()/observeTweets() الحيّان قد ينقطعان بصمت (تبديل شبكة، تعليق طويل في
        // الخلفية) بلا إعادة اتصال فورية، فيبقى المحتوى القديم ظاهراً مهما حاول المستخدم — كان هذا
        // بلاغ مستخدم حقيقي (لا سحب للتحديث ولا زر تحديث في نسخة APK).
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                HomeFeedModeSwitcher(mode = state.mode, onModeChange = viewModel::setMode)
            }

            if (state.mode == FeedMode.BLOG) {
                val searching = state.searchQuery.isNotBlank()
                val searchedArticles = state.searchedArticles

                // Search bar + refresh row — matches App.tsx's placement exactly (right below the
                // mode switcher, above the featured carousel), a real gap: this app had no search
                // affordance anywhere before this.
                item {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SearchBar(
                            expanded = state.isSearchExpanded,
                            query = state.searchQuery,
                            onExpandedChange = viewModel::setSearchExpanded,
                            onQueryChange = viewModel::setSearchQuery,
                            modifier = Modifier.weight(1f)
                        )
                        if (!state.isSearchExpanded) {
                            RefreshButton(isRefreshing = state.isRefreshing, onClick = viewModel::refresh, contentDescription = "تحديث قائمة المقالات")
                        }
                    }
                }

                if (searching && state.matchingUsers.isNotEmpty()) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("حسابات مطابقة لبحثك:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(state.matchingUsers, key = { "match_${it.id}" }) { u ->
                                    MatchingUserChip(user = u, onClick = { onWriterClick(u.id) })
                                }
                            }
                        }
                    }
                }

                // Category filter chips — matches App.tsx's categoryFilters.map(...) row, placed right
                // below the search bar. Was entirely missing from the app before this.
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(CATEGORY_FILTERS, key = { it.first }) { (id, label) ->
                            CategoryFilterChip(label = label, active = state.selectedCategory == id) { viewModel.setCategory(id) }
                        }
                    }
                }

                val showAllCategorySections = state.selectedCategory == "all" && !searching
                if (showAllCategorySections) {
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
                } else if (state.selectedCategory != "all") {
                    item { AdSlot(slotId = AdSlotId.CATEGORY_BANNER, category = state.selectedCategory) }
                }

                item {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        val heading = when {
                            state.selectedCategory != "all" -> CATEGORY_FILTERS.find { it.first == state.selectedCategory }?.second ?: "أحدث المقالات المنشورة"
                            searching -> "نتائج البحث"
                            else -> "أحدث المقالات المنشورة"
                        }
                        Text(heading, fontSize = 15.sp, fontWeight = FontWeight.Black)
                        Text("${searchedArticles.size} مقال متاح", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                if (searchedArticles.isEmpty()) {
                    item { EmptyState(if (searching) "لا توجد نتائج مطابقة لبحثك." else "لا توجد مقالات منشورة بعد.") }
                } else {
                    itemsIndexed(searchedArticles, key = { _, a -> a.id }) { idx, article ->
                        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            if (state.selectedCategory == "all" && idx == 2) AdSlot(slotId = AdSlotId.HOME_FEED_1)
                            if (state.selectedCategory == "all" && idx == 8) AdSlot(slotId = AdSlotId.HOME_FEED_2)
                            if (state.selectedCategory != "all" && idx == 2) AdSlot(slotId = AdSlotId.CATEGORY_FEED, category = state.selectedCategory)
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
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        RefreshButton(isRefreshing = state.isRefreshing, onClick = viewModel::refresh, contentDescription = "تحديث التغريدات")
                    }
                }
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
                                onDeleteComment = viewModel::deleteTweetComment,
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
}

/**
 * Matches `App.tsx`'s own refresh button exactly (icon + "تحديث" label, spinning while
 * [isRefreshing]) — the static, unlabeled, non-animated `IconButton` this replaced gave zero visible
 * feedback on a fast connection (the fetch can complete in well under a second), which is exactly
 * why a real user reported "pull-to-refresh does nothing, ever": nothing ever visibly changed, even
 * though the network request genuinely happened every time.
 */
@Composable
private fun RefreshButton(isRefreshing: Boolean, onClick: () -> Unit, contentDescription: String) {
    val transition = rememberInfiniteTransition(label = "refresh_spin")
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(animation = tween(800, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "refresh_spin_angle"
    )
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(enabled = !isRefreshing, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Icon(
            Icons.Filled.Refresh,
            contentDescription = contentDescription,
            tint = BrandTeal,
            modifier = Modifier.size(15.dp).rotate(if (isRefreshing) rotation else 0f)
        )
        Text("تحديث", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
    }
}

/**
 * Matches `App.tsx`'s blog-mode search bar exactly (spec §4.1): a collapsed "بحث..." pill that
 * expands into a real text field with a lens icon + close button. This was entirely missing from
 * the app before — a real user report ("لا يوجد أزرار بحث") — App.tsx's own search filters
 * articles (title/description/writer/tags) and shows a matching-accounts row, both wired via
 * [FeedUiState.searchedArticles]/[FeedUiState.matchingUsers] in [FeedViewModel].
 */
@Composable
private fun SearchBar(
    expanded: Boolean,
    query: String,
    onExpandedChange: (Boolean) -> Unit,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    if (expanded) {
        val focusRequester = remember { FocusRequester() }
        LaunchedEffect(Unit) { focusRequester.requestFocus() }
        Row(
            modifier = modifier
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(Icons.Filled.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            Box(Modifier.weight(1f)) {
                if (query.isEmpty()) {
                    Text("ابحث عن مقال، جملة من محتواه، أو اسم مستخدم...", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
                    modifier = Modifier.fillMaxWidth().focusRequester(focusRequester)
                )
            }
            IconButton(onClick = { onQueryChange(""); onExpandedChange(false) }, modifier = Modifier.size(24.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "إغلاق البحث", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            }
        }
    } else {
        Row(
            modifier = modifier
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surface)
                .clickable { onExpandedChange(true) }
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(Icons.Filled.Search, contentDescription = "بحث", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            Text("بحث...", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun MatchingUserChip(user: User, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        AsyncImage(
            model = user.avatarUrl,
            contentDescription = null,
            modifier = Modifier.size(22.dp).clip(RoundedCornerShape(50)),
            contentScale = ContentScale.Crop
        )
        Text(user.fullName, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("@${user.username}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
private fun CategoryFilterChip(label: String, active: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick),
        color = if (active) BrandTeal else MaterialTheme.colorScheme.surface,
        contentColor = if (active) Color.White else MaterialTheme.colorScheme.onSurface,
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1
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
