package studio.ai.literium.literium_app.ui.screens.article

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AppNotification
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.Comment
import studio.ai.literium.literium_app.data.model.CommentReply
import studio.ai.literium.literium_app.data.model.NotificationType
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.remote.UnlockArticleRequest
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.FollowRepository
import studio.ai.literium.literium_app.data.repository.NotificationRepository
import java.time.Instant
import java.util.UUID

data class ArticleReaderUiState(
    val isLoading: Boolean = true,
    val article: Article? = null,
    val notFound: Boolean = false,
    val currentUser: User? = null,
    val isLiked: Boolean = false,
    val isBookmarked: Boolean = false,
    val isFollowingWriter: Boolean = false,
    val isUnlocked: Boolean = false,
    val isUnlocking: Boolean = false,
    val unlockError: String? = null,
    val comments: List<Comment> = emptyList(),
    val myRating: Int = 0,
    val activeReaction: String? = null,
    val error: String? = null
) {
    val currentUserId: String? get() = currentUser?.id
}

/**
 * Backs [ArticleReaderScreen] — the full article-detail screen (spec §4.4), including the
 * locked-article unlock purchase flow (`POST /api/articles/unlock`, spec §11.9's server-
 * authoritative write path — the only client write here is the request itself, never a direct
 * `walletBalance`/`pendingEarnings` mutation) and the comment thread.
 */
class ArticleReaderViewModel(application: Application) : AndroidViewModel(application) {

    private val articleRepository = ArticleRepository()
    private val followRepository = FollowRepository()
    private val authRepository = AuthRepository()
    private val notificationRepository = NotificationRepository()

    private val prefs by lazy {
        getApplication<Application>().getSharedPreferences("literium_prefs", Context.MODE_PRIVATE)
    }

    private val _uiState = MutableStateFlow(ArticleReaderUiState())
    val uiState: StateFlow<ArticleReaderUiState> = _uiState.asStateFlow()

    private var loadedArticleId: String? = null

    fun load(articleId: String) {
        if (loadedArticleId == articleId) return
        loadedArticleId = articleId
        _uiState.value = ArticleReaderUiState(isBookmarked = articleId in loadBookmarks())

        viewModelScope.launch {
            authRepository.authState()
                .flatMapLatest { fbUser -> if (fbUser == null) flowOf<User?>(null) else authRepository.observeUser(fbUser.uid) }
                .catch { }
                .collect { user ->
                    val wasAnon = _uiState.value.currentUser == null
                    _uiState.value = _uiState.value.copy(currentUser = user)
                    if (wasAnon && user != null) refreshUserScopedState(articleId, user.id)
                }
        }

        viewModelScope.launch {
            articleRepository.fetchArticle(articleId).fold(
                onSuccess = { art ->
                    if (art == null) {
                        _uiState.value = _uiState.value.copy(isLoading = false, notFound = true)
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false, article = art)
                        viewModelScope.launch { articleRepository.incrementArticleView(articleId) }
                    }
                },
                onFailure = { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
            )
        }

        viewModelScope.launch {
            articleRepository.observeComments().catch { }.collect { all ->
                _uiState.value = _uiState.value.copy(comments = all.filter { it.articleId == articleId })
            }
        }

        viewModelScope.launch {
            articleRepository.observeArticleLikes().catch { }.collect { likes ->
                val uid = _uiState.value.currentUserId ?: return@collect
                _uiState.value = _uiState.value.copy(isLiked = likes.any { it.articleId == articleId && it.userId == uid })
            }
        }

        viewModelScope.launch {
            followRepository.observeFollows().catch { }.collect { follows ->
                val uid = _uiState.value.currentUserId
                val writerId = _uiState.value.article?.writerId
                if (uid != null && writerId != null) {
                    _uiState.value = _uiState.value.copy(isFollowingWriter = follows.any { it.followerId == uid && it.followingId == writerId })
                }
            }
        }
    }

    /** Re-runs the parts of [load] that need a signed-in uid, once auth resolves after initial load. */
    private fun refreshUserScopedState(articleId: String, uid: String) {
        viewModelScope.launch {
            articleRepository.observeArticlePurchases(uid).catch { }.collect { purchasedIds ->
                _uiState.value = _uiState.value.copy(isUnlocked = articleId in purchasedIds)
            }
        }
        viewModelScope.launch {
            articleRepository.fetchUserReaction(articleId, uid).getOrNull()?.let {
                _uiState.value = _uiState.value.copy(activeReaction = it.type)
            }
        }
    }

    fun toggleLike() {
        val article = _uiState.value.article ?: return
        val uid = _uiState.value.currentUserId ?: return
        val wasLiked = _uiState.value.isLiked
        // Optimistic update with rollback on failure — the pervasive pattern used across the web app.
        _uiState.value = _uiState.value.copy(isLiked = !wasLiked)
        viewModelScope.launch {
            val result = if (wasLiked) articleRepository.unlikeArticle(article.id, uid) else articleRepository.likeArticle(article.id, uid)
            if (result.isFailure) {
                _uiState.value = _uiState.value.copy(isLiked = wasLiked)
            } else if (!wasLiked) {
                notifyIfNotSelf(
                    article.writerId, uid, NotificationType.LIKE, "إعجاب جديد بمقالك",
                    "أعجب ${actorName()} بمقالك \"${article.title}\"", article.id
                )
            }
        }
    }

    /** Matches `App.tsx`'s self-notification guard applied to every like/comment/reply raised here. */
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

    /** Matches `App.tsx`'s `handleShareArticle` — real share-count increment + a notification to the
     *  writer, called when the user actually triggers the native share sheet (not merely opening it
     *  and cancelling — [ArticleReaderScreen] only calls this once the chooser Intent is actually
     *  launched, same "counted the moment the share sheet opens" behavior as the web's button click). */
    fun shareArticle() {
        val article = _uiState.value.article ?: return
        val uid = _uiState.value.currentUserId
        viewModelScope.launch {
            articleRepository.updateArticleStats(article.id, mapOf("sharesCount" to FieldValue.increment(1)))
            if (uid != null) {
                notifyIfNotSelf(article.writerId, uid, NotificationType.SHARE, "تمت مشاركة مقالك", "شارك ${actorName()} مقالك \"${article.title}\"", article.id)
            }
        }
    }

    fun toggleBookmark() {
        val article = _uiState.value.article ?: return
        val current = _uiState.value.isBookmarked
        _uiState.value = _uiState.value.copy(isBookmarked = !current)
        val bookmarks = loadBookmarks().toMutableSet()
        if (current) bookmarks.remove(article.id) else bookmarks.add(article.id)
        prefs.edit().putStringSet("literium_bookmarks", bookmarks).apply()
    }

    fun toggleFollowWriter() {
        val article = _uiState.value.article ?: return
        val uid = _uiState.value.currentUserId ?: return
        val isFollowing = _uiState.value.isFollowingWriter
        viewModelScope.launch {
            if (isFollowing) followRepository.unfollowUser(uid, article.writerId) else followRepository.followUser(uid, article.writerId)
        }
    }

    fun setReaction(type: String) {
        val article = _uiState.value.article ?: return
        val uid = _uiState.value.currentUserId ?: return
        val next = if (_uiState.value.activeReaction == type) null else type
        _uiState.value = _uiState.value.copy(activeReaction = next)
        viewModelScope.launch {
            if (next == null) articleRepository.removeArticleReaction(article.id, uid)
            else articleRepository.setArticleReaction(article.id, uid, next)
        }
    }

    fun rate(stars: Int) {
        val article = _uiState.value.article ?: return
        val uid = _uiState.value.currentUserId ?: return
        _uiState.value = _uiState.value.copy(myRating = stars)
        viewModelScope.launch {
            articleRepository.rateArticle(article.id, uid, stars)
            // Recompute the article's aggregate rating from this single confirmed change — a fuller
            // implementation would sum every rater's stars via observeArticleRatings(); this uses the
            // article's own last-known sum/count as a reasonable running approximation.
            val newCount = article.ratingsCount + 1
            val newSum = (article.ratingsSum ?: (article.rating * article.ratingsCount)) + stars
            articleRepository.syncArticleRatingSummary(article.id, newSum, newCount.toInt())
        }
    }

    fun addComment(content: String) {
        val article = _uiState.value.article ?: return
        val user = _uiState.value.currentUser ?: return
        if (content.isBlank()) return
        viewModelScope.launch {
            articleRepository.addComment(
                Comment(
                    id = "cm_${UUID.randomUUID()}",
                    articleId = article.id,
                    userId = user.id,
                    userName = user.fullName,
                    userAvatar = user.avatarUrl,
                    userRole = user.role,
                    isWriter = user.id == article.writerId,
                    content = content.trim(),
                    createdAt = Instant.now().toString()
                )
            )
            articleRepository.updateArticleStats(article.id, mapOf("commentsCount" to FieldValue.increment(1)))
            notifyIfNotSelf(
                article.writerId, user.id, NotificationType.COMMENT, "تعليق جديد على مقالك",
                "علّق ${actorName()} على مقالك \"${article.title}\": \"${content.trim().take(60)}\"", article.id
            )
        }
    }

    fun replyToComment(commentId: String, content: String) {
        val user = _uiState.value.currentUser ?: return
        if (content.isBlank()) return
        viewModelScope.launch {
            articleRepository.addReplyToComment(
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
            val parentUserId = _uiState.value.comments.find { it.id == commentId }?.userId
            notifyIfNotSelf(
                parentUserId, user.id, NotificationType.REPLY, "رد جديد على تعليقك",
                "ردّ ${actorName()} على تعليقك: \"${content.trim().take(60)}\"", _uiState.value.article?.id
            )
        }
    }

    fun likeComment(commentId: String) {
        val uid = _uiState.value.currentUserId ?: return
        val comment = _uiState.value.comments.find { it.id == commentId } ?: return
        val isLiking = comment.likedBy?.contains(uid) != true
        viewModelScope.launch {
            articleRepository.toggleCommentLike(commentId, uid, isLiking)
            if (isLiking) {
                notifyIfNotSelf(comment.userId, uid, NotificationType.LIKE, "إعجاب بتعليقك", "أعجب ${actorName()} بتعليقك", comment.articleId)
            }
        }
    }

    fun unlockArticle() {
        val article = _uiState.value.article ?: return
        if (_uiState.value.isUnlocking) return
        _uiState.value = _uiState.value.copy(isUnlocking = true, unlockError = null)
        viewModelScope.launch {
            try {
                val header = NetworkModule.authorizationHeader()
                val response = NetworkModule.api.unlockArticle(header, UnlockArticleRequest(article.id))
                if (response.success || response.alreadyUnlocked) {
                    _uiState.value = _uiState.value.copy(isUnlocking = false, isUnlocked = true)
                } else {
                    _uiState.value = _uiState.value.copy(isUnlocking = false, unlockError = "تعذر إتمام عملية الفتح.")
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isUnlocking = false,
                    unlockError = e.message ?: "تعذر إتمام عملية الشراء. تحقق من رصيد محفظتك واتصالك بالإنترنت."
                )
            }
        }
    }

    private fun loadBookmarks(): Set<String> = prefs.getStringSet("literium_bookmarks", emptySet())?.toSet() ?: emptySet()
}
