package studio.ai.literium.literium_app.ui.screens.tweet

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.CommentReply
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.TweetComment
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.TweetRepository
import java.time.Instant
import java.util.UUID

data class TweetDetailUiState(
    val isLoading: Boolean = true,
    val notFound: Boolean = false,
    val tweet: Tweet? = null,
    val currentUser: User? = null,
    val isLiked: Boolean = false,
    val isFavorited: Boolean = false,
    val isAdmin: Boolean = false,
    val comments: List<TweetComment> = emptyList(),
    val deleted: Boolean = false,
    val error: String? = null
) {
    val currentUserId: String? get() = currentUser?.id
}

data class TweetComposerUiState(
    val currentUser: User? = null,
    val isPosting: Boolean = false,
    val posted: Boolean = false,
    val error: String? = null
)

/**
 * Backs both [TweetDetailScreen] (a single tweet + its full comment thread, reached via
 * `Screen.TweetDetail`) and [TweetComposerScreen] (the standalone full-page composer, spec §4.18/§8).
 * Uses [TweetRepository] directly — tweets are a first-class feature per spec §8, not an afterthought.
 */
class TweetViewModel(application: Application) : AndroidViewModel(application) {

    private val tweetRepository = TweetRepository()
    private val authRepository = AuthRepository()

    private val _detailState = MutableStateFlow(TweetDetailUiState())
    val detailState: StateFlow<TweetDetailUiState> = _detailState.asStateFlow()

    private val _composerState = MutableStateFlow(TweetComposerUiState())
    val composerState: StateFlow<TweetComposerUiState> = _composerState.asStateFlow()

    private var loadedTweetId: String? = "__unset__"

    init {
        viewModelScope.launch {
            authRepository.authState()
                .flatMapLatest { fbUser -> if (fbUser == null) flowOf<User?>(null) else authRepository.observeUser(fbUser.uid) }
                .catch { }
                .collect { user ->
                    _detailState.value = _detailState.value.copy(currentUser = user, isAdmin = user?.role == "admin")
                    _composerState.value = _composerState.value.copy(currentUser = user)
                }
        }
    }

    // ---- Detail screen ----

    fun loadTweet(tweetId: String) {
        if (loadedTweetId == tweetId) return
        loadedTweetId = tweetId
        _detailState.value = TweetDetailUiState(currentUser = _detailState.value.currentUser, isAdmin = _detailState.value.isAdmin)

        viewModelScope.launch {
            tweetRepository.observeTweets().catch { }.collect { tweets ->
                val found = tweets.find { it.id == tweetId }
                _detailState.value = _detailState.value.copy(isLoading = false, tweet = found, notFound = found == null)
            }
        }
        viewModelScope.launch {
            tweetRepository.observeTweetComments().catch { }.collect { comments ->
                _detailState.value = _detailState.value.copy(comments = comments.filter { it.tweetId == tweetId })
            }
        }
        viewModelScope.launch {
            tweetRepository.observeTweetLikes().catch { }.collect { pairs ->
                val uid = _detailState.value.currentUserId ?: return@collect
                _detailState.value = _detailState.value.copy(isLiked = pairs.any { it.first == tweetId && it.second == uid })
            }
        }
        viewModelScope.launch {
            authRepository.authState()
                .flatMapLatest { fbUser -> tweetRepository.observeTweetFavorites(fbUser?.uid) }
                .catch { }
                .collect { favIds -> _detailState.value = _detailState.value.copy(isFavorited = tweetId in favIds) }
        }
    }

    fun toggleLike() {
        val tweetId = _detailState.value.tweet?.id ?: return
        val uid = _detailState.value.currentUserId ?: return
        val liked = _detailState.value.isLiked
        viewModelScope.launch {
            if (liked) tweetRepository.unlikeTweet(tweetId, uid) else tweetRepository.likeTweet(tweetId, uid)
        }
    }

    fun toggleFavorite() {
        val tweetId = _detailState.value.tweet?.id ?: return
        val uid = _detailState.value.currentUserId ?: return
        val fav = _detailState.value.isFavorited
        viewModelScope.launch {
            if (fav) tweetRepository.unfavoriteTweet(tweetId, uid) else tweetRepository.favoriteTweet(tweetId, uid)
        }
    }

    fun share() {
        val tweetId = _detailState.value.tweet?.id ?: return
        viewModelScope.launch { tweetRepository.incrementTweetShares(tweetId) }
    }

    fun deleteTweet() {
        val tweetId = _detailState.value.tweet?.id ?: return
        viewModelScope.launch {
            tweetRepository.deleteTweet(tweetId).onSuccess {
                _detailState.value = _detailState.value.copy(deleted = true)
            }
        }
    }

    fun addComment(content: String) {
        val tweetId = _detailState.value.tweet?.id ?: return
        val user = _detailState.value.currentUser ?: return
        if (content.isBlank()) return
        viewModelScope.launch {
            tweetRepository.addTweetComment(
                TweetComment(
                    id = "twc_${UUID.randomUUID()}",
                    tweetId = tweetId,
                    userId = user.id,
                    userName = user.fullName,
                    userAvatar = user.avatarUrl,
                    userRole = user.role,
                    content = content.trim(),
                    createdAt = Instant.now().toString()
                )
            )
        }
    }

    fun likeComment(commentId: String, isLiking: Boolean) {
        val uid = _detailState.value.currentUserId ?: return
        viewModelScope.launch { tweetRepository.toggleTweetCommentLike(commentId, uid, isLiking) }
    }

    /** Own comment or admin only — matches firestore.rules' delete gate on tweetComments exactly. */
    fun deleteComment(commentId: String) {
        val uid = _detailState.value.currentUserId ?: return
        val state = _detailState.value
        val comment = state.comments.find { it.id == commentId } ?: return
        if (comment.userId != uid && !state.isAdmin) return
        viewModelScope.launch { tweetRepository.deleteTweetComment(commentId, comment.tweetId) }
    }

    fun replyToComment(commentId: String, content: String) {
        val user = _detailState.value.currentUser ?: return
        viewModelScope.launch {
            tweetRepository.addReplyToTweetComment(
                commentId,
                CommentReply(
                    id = "rep_${UUID.randomUUID()}",
                    userId = user.id,
                    userName = user.fullName,
                    userAvatar = user.avatarUrl,
                    userRole = user.role,
                    content = content.trim(),
                    createdAt = Instant.now().toString()
                )
            )
        }
    }

    // ---- Composer screen ----

    fun postTweet(content: String) {
        val user = _composerState.value.currentUser ?: return
        val trimmed = content.trim()
        if (trimmed.isEmpty() || trimmed.length > 280) {
            _composerState.value = _composerState.value.copy(error = "نص التغريدة يجب أن يكون بين 1 و280 حرفاً.")
            return
        }
        _composerState.value = _composerState.value.copy(isPosting = true, error = null)
        viewModelScope.launch {
            tweetRepository.addTweet(
                Tweet(
                    id = "tw_${UUID.randomUUID()}",
                    authorId = user.id,
                    authorName = user.fullName,
                    authorUsername = user.username,
                    authorAvatar = user.avatarUrl,
                    authorRole = user.role,
                    content = trimmed,
                    createdAt = Instant.now().toString()
                )
            ).fold(
                onSuccess = { _composerState.value = _composerState.value.copy(isPosting = false, posted = true) },
                onFailure = { e -> _composerState.value = _composerState.value.copy(isPosting = false, error = e.message ?: "تعذّر نشر التغريدة.") }
            )
        }
    }
}
