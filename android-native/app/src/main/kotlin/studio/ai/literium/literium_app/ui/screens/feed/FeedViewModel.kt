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
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleStatus
import studio.ai.literium.literium_app.data.model.CommentReply
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.TweetComment
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.FollowRepository
import studio.ai.literium.literium_app.data.repository.TweetRepository
import java.time.Instant
import java.util.UUID

/** Home-feed mode toggle — matches `HomeFeedModeSwitcher` (spec §4.1/§4.2): "المدونة" (articles) vs "تغريد" (tweets). */
enum class FeedMode { BLOG, TWEET }

data class FeedUiState(
    val isLoading: Boolean = true,
    val mode: FeedMode = FeedMode.BLOG,
    val currentUser: User? = null,
    val articles: List<Article> = emptyList(),
    val followedWriterIds: Set<String> = emptySet(),
    val bookmarkedArticleIds: Set<String> = emptySet(),
    val tweets: List<Tweet> = emptyList(),
    val tweetComments: List<TweetComment> = emptyList(),
    val likedTweetIds: Set<String> = emptySet(),
    val favoritedTweetIds: Set<String> = emptySet(),
    val error: String? = null
) {
    val currentUserId: String? get() = currentUser?.id
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
    }

    fun setMode(mode: FeedMode) {
        _uiState.value = _uiState.value.copy(mode = mode)
    }

    fun toggleFollow(writerId: String) {
        val uid = _uiState.value.currentUserId ?: return
        val isFollowing = writerId in _uiState.value.followedWriterIds
        viewModelScope.launch {
            if (isFollowing) followRepository.unfollowUser(uid, writerId) else followRepository.followUser(uid, writerId)
        }
    }

    fun toggleBookmark(articleId: String) {
        val current = _uiState.value.bookmarkedArticleIds
        val updated = if (articleId in current) current - articleId else current + articleId
        _uiState.value = _uiState.value.copy(bookmarkedArticleIds = updated)
        prefs.edit().putStringSet("literium_bookmarks", updated).apply()
    }

    private fun loadBookmarks(): Set<String> =
        prefs.getStringSet("literium_bookmarks", emptySet())?.toSet() ?: emptySet()

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            articleRepository.fetchArticlesOnce().fold(
                onSuccess = { list ->
                    _uiState.value = _uiState.value.copy(isLoading = false, articles = list.filter { it.status == ArticleStatus.PUBLISHED })
                },
                onFailure = { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
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
            if (liked) tweetRepository.unlikeTweet(tweetId, uid) else tweetRepository.likeTweet(tweetId, uid)
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
        }
    }
}
