package studio.ai.literium.literium_app.ui.screens.feed

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AppNotification
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleStatus
import studio.ai.literium.literium_app.data.model.CommentReply
import studio.ai.literium.literium_app.data.model.NotificationType
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.TweetComment
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.repository.AdminRepository
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.FollowRepository
import studio.ai.literium.literium_app.data.repository.NotificationRepository
import studio.ai.literium.literium_app.data.repository.TweetRepository
import studio.ai.literium.literium_app.util.ArabicSearch
import java.time.Instant
import java.util.UUID

/** Home-feed mode toggle — matches `HomeFeedModeSwitcher` (spec §4.1/§4.2): "المدونة" (articles) vs "تغريد" (tweets). */
enum class FeedMode { BLOG, TWEET }

data class FeedUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val mode: FeedMode = FeedMode.BLOG,
    val currentUser: User? = null,
    val articles: List<Article> = emptyList(),
    val followedWriterIds: Set<String> = emptySet(),
    val bookmarkedArticleIds: Set<String> = emptySet(),
    val tweets: List<Tweet> = emptyList(),
    val tweetComments: List<TweetComment> = emptyList(),
    val likedTweetIds: Set<String> = emptySet(),
    val favoritedTweetIds: Set<String> = emptySet(),
    val allUsers: List<User> = emptyList(),
    val searchQuery: String = "",
    val isSearchExpanded: Boolean = false,
    val error: String? = null
) {
    val currentUserId: String? get() = currentUser?.id

    /** Matches `App.tsx`'s article-search `useMemo`: title/description/writer name/username/tags,
     *  all through [ArabicSearch] so common Arabic spelling variants (alef forms, ta-marbuta, etc.)
     *  don't silently break search. */
    val searchedArticles: List<Article>
        get() {
            if (searchQuery.isBlank()) return articles
            return articles.filter { art ->
                val writer = allUsers.firstOrNull { it.id == art.writerId }
                ArabicSearch.matches(art.title, searchQuery) ||
                    ArabicSearch.matches(art.description, searchQuery) ||
                    ArabicSearch.matches(art.writerName, searchQuery) ||
                    ArabicSearch.matches(writer?.username ?: "", searchQuery) ||
                    art.tags.any { ArabicSearch.matches(it, searchQuery) }
            }
        }

    /** Matches `App.tsx`'s `matchingUsers` — accounts shown as chips under the search bar. */
    val matchingUsers: List<User>
        get() {
            if (searchQuery.isBlank()) return emptyList()
            return allUsers.filter { u ->
                ArabicSearch.matches(u.username, searchQuery) ||
                    ArabicSearch.matches(u.fullName, searchQuery) ||
                    ArabicSearch.matches(u.penName ?: "", searchQuery) ||
                    ArabicSearch.matches(u.companyName ?: "", searchQuery)
            }.take(10)
        }
}

/**
 * Backs [FeedScreen] — the single home-feed surface that switches between Blog (article) and Tweet
 * modes via [FeedMode] (spec §4.1/§4.2), matching `App.tsx`'s single `HomeFeedModeSwitcher`-driven
 * view rather than two separate destinations. Bookmarks are a purely client-side/local feature on
 * the web too (verified: no Firestore collection backs them — `App.tsx`'s `bookmarkedArticleIds`
 * state round-trips through `localStorage['literium_bookmarks']` only), so they are persisted the
 * same way here via [android.content.SharedPreferences] rather than invented as a fake repository.
 */
class FeedViewModel(application: Application) : AndroidViewModel(application) {

    private val articleRepository = ArticleRepository()
    private val tweetRepository = TweetRepository()
    private val followRepository = FollowRepository()
    private val authRepository = AuthRepository()
    private val notificationRepository = NotificationRepository()
    private val adminRepository = AdminRepository()

    private val prefs by lazy {
        getApplication<Application>().getSharedPreferences("literium_prefs", Context.MODE_PRIVATE)
    }

    private val _uiState = MutableStateFlow(FeedUiState(bookmarkedArticleIds = loadBookmarks()))
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            authRepository.authState()
                .flatMapLatest { fbUser -> if (fbUser == null) flowOf<User?>(null) else authRepository.observeUser(fbUser.uid) }
                .catch { }
                .collect { user -> _uiState.value = _uiState.value.copy(currentUser = user) }
        }
        viewModelScope.launch {
            combine(articleRepository.observeArticles(), followRepository.observeFollows()) { articles, follows ->
                articles to follows
            }.catch { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
                .collect { (articles, follows) ->
                    val uid = _uiState.value.currentUserId
                    val followedIds = if (uid != null) follows.filter { it.followerId == uid }.map { it.followingId }.toSet() else emptySet()
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        articles = articles.filter { it.status == ArticleStatus.PUBLISHED },
                        followedWriterIds = followedIds,
                        error = null
                    )
                }
        }
        viewModelScope.launch {
            tweetRepository.observeTweets().catch { }.collect { tweets ->
                _uiState.value = _uiState.value.copy(tweets = tweets)
            }
        }
        viewModelScope.launch {
            tweetRepository.observeTweetComments().catch { }.collect { comments ->
                _uiState.value = _uiState.value.copy(tweetComments = comments)
            }
        }
        viewModelScope.launch {
            tweetRepository.observeTweetLikes().catch { }.collect { pairs ->
                val uid = _uiState.value.currentUserId
                val liked = if (uid != null) pairs.filter { it.second == uid }.map { it.first }.toSet() else emptySet()
                _uiState.value = _uiState.value.copy(likedTweetIds = liked)
            }
        }
        viewModelScope.launch {
            authRepository.authState()
                .flatMapLatest { fbUser -> tweetRepository.observeTweetFavorites(fbUser?.uid) }
                .catch { }
                .collect { favIds -> _uiState.value = _uiState.value.copy(favoritedTweetIds = favIds.toSet()) }
        }
        // Backs the search bar's "matching accounts" row (App.tsx's matchingUsers). Despite the
        // repository's name, `observeAllUsers()` is a plain, unrestricted Firestore read — firestore.rules
        // has `allow read: if true` on /users/{userId} for exactly this (public account search on the
        // web too), not an admin-gated operation.
        viewModelScope.launch {
            adminRepository.observeAllUsers().catch { }.collect { list ->
                _uiState.value = _uiState.value.copy(allUsers = list)
            }
        }
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun setSearchExpanded(expanded: Boolean) {
        _uiState.value = _uiState.value.copy(
            isSearchExpanded = expanded,
            searchQuery = if (!expanded) "" else _uiState.value.searchQuery
        )
    }

    fun setMode(mode: FeedMode) {
        _uiState.value = _uiState.value.copy(mode = mode)
    }

    fun toggleFollow(writerId: String) {
        val uid = _uiState.value.currentUserId ?: return
        val isFollowing = writerId in _uiState.value.followedWriterIds
        viewModelScope.launch {
            if (isFollowing) {
                followRepository.unfollowUser(uid, writerId)
            } else {
                followRepository.followUser(uid, writerId)
                notifyIfNotSelf(writerId, uid, NotificationType.FOLLOW, "متابع جديد", "بدأ ${actorName()} بمتابعتك")
            }
        }
    }

    /** Matches `App.tsx`'s "إلا إذا كان هو من فعل الفعل على محتواه نفسه" self-notification guard,
     *  applied consistently everywhere a like/comment/follow/share notification is raised. */
    private fun notifyIfNotSelf(
        recipientId: String?,
        actorId: String,
        type: String,
        title: String,
        message: String,
        articleId: String? = null
    ) {
        if (recipientId.isNullOrBlank() || recipientId == actorId) return
        viewModelScope.launch {
            notificationRepository.createNotification(
                AppNotification(userId = recipientId, type = type, title = title, message = message, actorId = actorId, articleId = articleId)
            )
        }
    }

    private fun actorName(): String = _uiState.value.currentUser?.fullName ?: "مستخدم ليتيريوم"

    fun toggleBookmark(articleId: String) {
        val current = _uiState.value.bookmarkedArticleIds
        val updated = if (articleId in current) current - articleId else current + articleId
        _uiState.value = _uiState.value.copy(bookmarkedArticleIds = updated)
        prefs.edit().putStringSet("literium_bookmarks", updated).apply()
    }

    private fun loadBookmarks(): Set<String> =
        prefs.getStringSet("literium_bookmarks", emptySet())?.toSet() ?: emptySet()

    /**
     * Explicit pull-to-refresh / refresh-button entry point — matches `App.tsx`'s `handleRefreshFeed`:
     * a real one-shot server fetch, not just a visual spinner, since the live `observeArticles()`/
     * `observeTweets()` listeners can go silently stale (network switch, long background) without
     * reconnecting immediately. Uses [FeedUiState.isRefreshing] rather than [FeedUiState.isLoading] so
     * [FeedScreen] shows the small pull-to-refresh indicator instead of swapping to the full-screen
     * spinner and losing scroll position.
     */
    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            val articlesResult = articleRepository.fetchArticlesOnce()
            val tweetsResult = tweetRepository.fetchTweetsOnce()
            _uiState.value = _uiState.value.copy(
                isRefreshing = false,
                articles = articlesResult.getOrNull()?.filter { it.status == ArticleStatus.PUBLISHED } ?: _uiState.value.articles,
                tweets = tweetsResult.getOrNull() ?: _uiState.value.tweets,
                error = articlesResult.exceptionOrNull()?.message ?: tweetsResult.exceptionOrNull()?.message
            )
        }
    }

    // ---- Tweet mode actions (spec §8 — TweetFeed embedded directly in the home feed) ----

    fun postTweet(content: String) {
        val user = _uiState.value.currentUser ?: return
        if (content.isBlank() || content.length > 280) return
        viewModelScope.launch {
            tweetRepository.addTweet(
                Tweet(
                    id = "tw_${UUID.randomUUID()}",
                    authorId = user.id,
                    authorName = user.fullName,
                    authorUsername = user.username,
                    authorAvatar = user.avatarUrl,
                    authorRole = user.role,
                    content = content,
                    createdAt = Instant.now().toString()
                )
            )
        }
    }

    fun toggleTweetLike(tweetId: String) {
        val uid = _uiState.value.currentUserId ?: return
        val liked = tweetId in _uiState.value.likedTweetIds
        viewModelScope.launch {
            if (liked) {
                tweetRepository.unlikeTweet(tweetId, uid)
            } else {
                tweetRepository.likeTweet(tweetId, uid)
                val authorId = _uiState.value.tweets.firstOrNull { it.id == tweetId }?.authorId
                notifyIfNotSelf(authorId, uid, NotificationType.LIKE, "إعجاب جديد بتغريدتك", "أعجب ${actorName()} بتغريدتك")
            }
        }
    }

    fun toggleTweetFavorite(tweetId: String) {
        val uid = _uiState.value.currentUserId ?: return
        val fav = tweetId in _uiState.value.favoritedTweetIds
        viewModelScope.launch {
            if (fav) tweetRepository.unfavoriteTweet(tweetId, uid) else tweetRepository.favoriteTweet(tweetId, uid)
        }
    }

    fun shareTweet(tweetId: String) {
        viewModelScope.launch { tweetRepository.incrementTweetShares(tweetId) }
    }

    fun deleteTweet(tweetId: String) {
        viewModelScope.launch { tweetRepository.deleteTweet(tweetId) }
    }

    fun addTweetComment(tweetId: String, content: String) {
        val user = _uiState.value.currentUser ?: return
        viewModelScope.launch {
            tweetRepository.addTweetComment(
                TweetComment(
                    id = "twc_${UUID.randomUUID()}",
                    tweetId = tweetId,
                    userId = user.id,
                    userName = user.fullName,
                    userAvatar = user.avatarUrl,
                    userRole = user.role,
                    content = content,
                    createdAt = Instant.now().toString()
                )
            )
            val authorId = _uiState.value.tweets.firstOrNull { it.id == tweetId }?.authorId
            notifyIfNotSelf(authorId, user.id, NotificationType.COMMENT, "تعليق جديد على تغريدتك", "علّق ${actorName()} على تغريدتك")
        }
    }

    fun likeTweetComment(commentId: String, isLiking: Boolean) {
        val uid = _uiState.value.currentUserId ?: return
        viewModelScope.launch { tweetRepository.toggleTweetCommentLike(commentId, uid, isLiking) }
    }

    fun replyToTweetComment(commentId: String, content: String) {
        val user = _uiState.value.currentUser ?: return
        viewModelScope.launch {
            tweetRepository.addReplyToTweetComment(
                commentId,
                CommentReply(
                    id = "rep_${UUID.randomUUID()}",
                    userId = user.id,
                    userName = user.fullName,
                    userAvatar = user.avatarUrl,
                    userRole = user.role,
                    content = content,
                    createdAt = Instant.now().toString()
                )
            )
            val recipientId = _uiState.value.tweetComments.firstOrNull { it.id == commentId }?.userId
            notifyIfNotSelf(recipientId, user.id, NotificationType.COMMENT, "رد جديد على تعليقك", "رد ${actorName()} على تعليقك على تغريدة")
        }
    }
}
