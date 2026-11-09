package studio.ai.literium.literium_app.ui.screens.feed

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.data.model.ArticleCategory
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.ui.ads.AdSlot
import studio.ai.literium.literium_app.ui.components.ArticleCard
import studio.ai.literium.literium_app.ui.components.TweetCard
import studio.ai.literium.literium_app.ui.components.TweetComposerBar
import studio.ai.literium.literium_app.ui.components.articleCategoryLabelAr
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable

/** نفس `categoryFilters` في App.tsx: «جميع المقالات» + الأقسام الـ15 بالترتيب. */
private val CATEGORY_FILTERS: List<Pair<String, String>> =
    listOf("all" to "جميع المقالات") +
        ArticleCategory.ALL.filter { it != ArticleCategory.GENERAL }.map { it to articleCategoryLabelAr(it) }

/**
 * الصفحة الرئيسية — HomeFeedView.tsx: حاوية px-3 py-4 (pb-28 للشريط السفلي) وتباعد space-y-6 (24dp)
 * مع التعديلات السالبة -mt-4/-mt-3 للصفوف العلوية وهوامش mb-8 للقسمين المميز/الأكثر قراءة.
 * زر الكتابة العائم يسار-أسفل (فيزيائياً) وزر الصعود يمين-أسفل، كلاهما هنا فقط (تبويب الرئيسية).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    onArticleClick: (String) -> Unit,
    onWriterClick: (String) -> Unit,
    onComposeArticle: () -> Unit,
    viewModel: FeedViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val showScrollToTop by remember { derivedStateOf { listState.firstVisibleItemIndex > 3 } }
    var tweetSearchOpen by remember { mutableStateOf(false) }
    var tweetQuery by remember { mutableStateOf("") }
    val dark = isDark

    Box(Modifier.fillMaxSize()) {
        PullToRefreshBox(isRefreshing = state.isRefreshing, onRefresh = viewModel::refresh, modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 48.dp)
            ) {
                item { HomeFeedModeSwitcher(mode = state.mode, onModeChange = viewModel::setMode) }

                if (state.mode == FeedMode.BLOG) {
                    val searching = state.searchQuery.isNotBlank()
                    val shown = state.searchedArticles
                    val allCategory = state.selectedCategory == "all"

                    // صف البحث + التحديث (-mt-4 ⇒ 8dp بعد المبدّل)
                    item {
                        Gap(8.dp) {
                            SearchRefreshRow(
                                expanded = state.isSearchExpanded, query = state.searchQuery,
                                placeholder = "ابحث عن مقال، جملة من محتواه، أو اسم مستخدم...", compact = false,
                                isRefreshing = state.isRefreshing, refreshLabel = true,
                                onExpand = viewModel::setSearchExpanded, onQuery = viewModel::setSearchQuery, onRefresh = viewModel::refresh
                            )
                        }
                    }
                    if (searching && state.matchingUsers.isNotEmpty()) {
                        item { Gap(24.dp) { MatchingUsersRow(state.matchingUsers, onWriterClick) } }
                    }
                    // شرائح التصنيف (-mt-3 ⇒ 12dp)
                    item { Gap(12.dp) { CategoryChips(CATEGORY_FILTERS, state.selectedCategory, viewModel::setCategory) } }

                    if (allCategory && !searching) {
                        item {
                            Gap(24.dp) {
                                FeaturedSection(state.articles, state.bookmarkedArticleIds.toSet(), onArticleClick, viewModel::toggleBookmark)
                            }
                        }
                        // home_hero (mb-8 للقسم المميز ⇒ 32dp)
                        item { Gap(32.dp) { AdSlot(slotId = AdSlotId.HOME_HERO) } }
                        item { Gap(24.dp) { TrendingSection(state.articles, onArticleClick) } }
                    } else if (!allCategory) {
                        item { Gap(24.dp) { AdSlot(slotId = AdSlotId.CATEGORY_BANNER, category = state.selectedCategory) } }
                    }

                    // عنوان القائمة + عدّاد
                    item {
                        Gap(32.dp) {
                            androidx.compose.foundation.layout.Row(
                                Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    if (allCategory) "مقالات مختارة لك" else (CATEGORY_FILTERS.find { it.first == state.selectedCategory }?.second ?: ""),
                                    style = cairo(16, FontWeight.ExtraBold, 24), color = if (dark) Tw.white else Tw.slate900
                                )
                                Text("${shown.size} مقال متاح", style = cairo(12, FontWeight.Medium, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                            }
                        }
                    }

                    if (state.isLoading) {
                        itemsIndexed(List(6) { it }, key = { _, n -> "sk_$n" }) { _, _ -> Gap(24.dp) { ArticleSkeleton() } }
                    } else if (shown.isEmpty()) {
                        item {
                            Gap(24.dp) {
                                NoArticlesCard {
                                    viewModel.setCategory("all"); viewModel.setSearchQuery("")
                                }
                            }
                        }
                    } else {
                        itemsIndexed(shown, key = { _, a -> a.id }) { idx, article ->
                            Column(Modifier.padding(top = 24.dp)) {
                                if (allCategory && idx == 2) Box(Modifier.padding(bottom = 16.dp)) { AdSlot(slotId = AdSlotId.HOME_FEED_1) }
                                if (allCategory && idx == 8) Box(Modifier.padding(bottom = 16.dp)) { AdSlot(slotId = AdSlotId.HOME_FEED_2) }
                                if (!allCategory && idx == 2) Box(Modifier.padding(bottom = 16.dp)) { AdSlot(slotId = AdSlotId.CATEGORY_FEED, category = state.selectedCategory) }
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
                    // وضع التغريد: صف بحث/تحديث مختصر (-mt-4 ⇒ 8dp)
                    item {
                        Gap(8.dp) {
                            SearchRefreshRow(
                                expanded = tweetSearchOpen, query = tweetQuery,
                                placeholder = "ابحث في التغريدات أو عن كاتب...", compact = true,
                                isRefreshing = state.isRefreshing, refreshLabel = false,
                                onExpand = { tweetSearchOpen = it }, onQuery = { tweetQuery = it }, onRefresh = viewModel::refresh
                            )
                        }
                    }
                    val currentUser = state.currentUser
                    if (currentUser != null) {
                        item { Gap(24.dp) { TweetComposerBar(avatarUrl = currentUser.avatarUrl, onSubmit = viewModel::postTweet) } }
                    }
                    val q = tweetQuery.trim().lowercase()
                    val tweets = if (q.isEmpty()) state.tweets else state.tweets.filter {
                        it.content.lowercase().contains(q) || it.authorName.lowercase().contains(q) || it.authorUsername.lowercase().contains(q)
                    }
                    if (tweets.isEmpty()) {
                        item {
                            Gap(16.dp) {
                                val shape = RoundedCornerShape(16.dp)
                                Column(
                                    Modifier.fillMaxWidth().clip(shape).background(if (dark) Tw.slate900 else Tw.white)
                                        .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape).padding(40.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    LuIcon(Lu.MessageSquare, 32.dp, if (dark) Tw.slate700 else Tw.slate300)
                                    Text(
                                        if (tweetQuery.isNotEmpty()) "لا نتائج مطابقة لبحثك." else "لا توجد تغريدات بعد — كن أول من يشارك خاطرة قصيرة.",
                                        Modifier.padding(top = 8.dp), style = cairo(14, FontWeight.Normal, 20).copy(textAlign = TextAlign.Center), color = Tw.slate400
                                    )
                                }
                            }
                        }
                    } else {
                        itemsIndexed(tweets, key = { _, t -> t.id }) { idx, tweet ->
                            Column(Modifier.padding(top = 16.dp)) {
                                if (idx > 0 && idx % 3 == 0) Box(Modifier.padding(bottom = 16.dp)) { AdSlot(slotId = AdSlotId.TWEET_FEED) }
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

        // زر الكتابة: bottom-20 left-4 ⇒ يسار فيزيائي (End في RTL) ويرتفع 16dp فوق الشريط السفلي
        if (!state.isGuestOrSignedOut()) {
            FloatingCircle(
                icon = Lu.PenTool, padding = 14.dp,
                modifier = Modifier.align(Alignment.BottomEnd).padding(start = 16.dp, end = 16.dp, bottom = 16.dp)
            ) { if (state.mode == FeedMode.TWEET) { /* تركيز المُنشئ: يعتمد على أعلى القائمة */ scope.launch { listState.animateScrollToItem(0) } } else onComposeArticle() }
        }
        // زر الصعود: يمين فيزيائي
        AnimatedVisibility(
            visible = showScrollToTop, enter = fadeIn(), exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomStart).padding(16.dp)
        ) {
            FloatingCircle(icon = Lu.ChevronUp, padding = 12.dp) { scope.launch { listState.animateScrollToItem(0) } }
        }
    }
}

private fun FeedUiState.isGuestOrSignedOut(): Boolean = currentUser == null || currentUserId.isNullOrBlank() || currentUserId == "guest"

/** يضيف تباعداً علوياً مكافئاً لـ space-y-N / -mt-N في الويب. */
@Composable
private fun Gap(top: Dp, content: @Composable () -> Unit) {
    Box(Modifier.padding(top = top)) { content() }
}

/** زر عائم دائري: rounded-full bg-teal-600 border white/20 shadow-xl shadow-teal-600/30. */
@Composable
private fun FloatingCircle(
    icon: androidx.compose.ui.graphics.vector.ImageVector, padding: Dp, modifier: Modifier = Modifier, onClick: () -> Unit
) {
    Box(
        modifier
            .shadow(16.dp, CircleShape, ambientColor = Tw.teal600.copy(alpha = 0.30f), spotColor = Tw.teal600.copy(alpha = 0.30f))
            .clip(CircleShape).background(Tw.teal600).border(1.dp, Tw.white.copy(alpha = 0.20f), CircleShape)
            .twClickable(pressScale = 0.95f, onClick = onClick).padding(padding),
        contentAlignment = Alignment.Center
    ) { LuIcon(icon, 20.dp, Tw.white) }
}
