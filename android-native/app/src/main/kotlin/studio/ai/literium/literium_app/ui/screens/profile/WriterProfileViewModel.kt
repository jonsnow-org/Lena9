package studio.ai.literium.literium_app.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.FollowRepository
import studio.ai.literium.literium_app.data.repository.MessageRepository
import studio.ai.literium.literium_app.util.CreatorEligibility

enum class WriterProfileTab { ARTICLES, ABOUT }

data class WriterProfileUiState(
    val isLoading: Boolean = true,
    val writer: User? = null,
    val activeTab: WriterProfileTab = WriterProfileTab.ARTICLES,
    val articles: List<Article> = emptyList(),
    val totalViews: Long = 0,
    val avgRating: Double = 0.0,
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val isFollowing: Boolean = false,
    val isFollowingMe: Boolean = false,
    val eligibility: CreatorEligibility.Status? = null,
    val isMessageBusy: Boolean = false,
    val error: String? = null
) {
    val memberStatusLabel: String
        get() = writer?.let { CreatorEligibility.getMemberStatusLabel(it.role, eligibility?.isEligible == true) } ?: ""
}

/** Backs [WriterProfileScreen] — viewing ANOTHER user's profile (spec §4.19b). */
class WriterProfileViewModel(
    private val targetUserId: String,
    private val authRepository: AuthRepository = AuthRepository(),
    private val articleRepository: ArticleRepository = ArticleRepository(),
    private val followRepository: FollowRepository = FollowRepository(),
    private val messageRepository: MessageRepository = MessageRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(WriterProfileUiState())
    val state: StateFlow<WriterProfileUiState> = _state.asStateFlow()

    private val _openConversation = MutableSharedFlow<String>()
    val openConversation: SharedFlow<String> = _openConversation

    private val currentUserId: String? = FirebaseAuth.getInstance().currentUser?.uid
    private var allArticles: List<Article> = emptyList()

    init {
        viewModelScope.launch {
            authRepository.observeUser(targetUserId).collect { user ->
                _state.value = _state.value.copy(writer = user, isLoading = false)
                recomputeEligibility()
            }
        }
        viewModelScope.launch {
            articleRepository.observeArticles().collect { articles ->
                allArticles = articles
                val writerArticles = articles.filter { it.writerId == targetUserId }
                val ratingsCount = writerArticles.sumOf { it.ratingsCount }
                val ratingsSum = writerArticles.sumOf { it.ratingsSum ?: (it.rating * it.ratingsCount) }
                _state.value = _state.value.copy(
                    articles = writerArticles.sortedByDescending { it.publishedAt },
                    totalViews = writerArticles.sumOf { it.viewsCount },
                    avgRating = if (ratingsCount > 0) ratingsSum / ratingsCount else 0.0
                )
                recomputeEligibility()
            }
        }
        viewModelScope.launch {
            followRepository.observeFollows().collect { follows ->
                _state.value = _state.value.copy(
                    followersCount = follows.count { it.followingId == targetUserId },
                    followingCount = follows.count { it.followerId == targetUserId },
                    isFollowing = currentUserId != null && follows.any { it.followerId == currentUserId && it.followingId == targetUserId },
                    isFollowingMe = currentUserId != null && follows.any { it.followerId == targetUserId && it.followingId == currentUserId }
                )
                recomputeEligibility()
            }
        }
    }

    private fun recomputeEligibility() {
        val writer = _state.value.writer ?: return
        _state.value = _state.value.copy(
            eligibility = CreatorEligibility.getCreatorEligibility(
                user = writer,
                articles = allArticles,
                followersCountOverride = _state.value.followersCount
            )
        )
    }

    fun selectTab(tab: WriterProfileTab) {
        _state.value = _state.value.copy(activeTab = tab)
    }

    fun toggleFollow() {
        val myId = currentUserId ?: return
        if (myId == targetUserId) return
        viewModelScope.launch {
            val result = if (_state.value.isFollowing) {
                followRepository.unfollowUser(myId, targetUserId)
            } else {
                followRepository.followUser(myId, targetUserId)
            }
            if (result.isFailure) {
                _state.value = _state.value.copy(error = result.exceptionOrNull()?.message ?: "تعذر تنفيذ العملية.")
            }
        }
    }

    fun openDirectMessage() {
        val myId = currentUserId ?: run {
            _state.value = _state.value.copy(error = "يجب تسجيل الدخول لإرسال رسالة.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isMessageBusy = true)
            val result = messageRepository.ensureConversation(myId, targetUserId)
            _state.value = _state.value.copy(isMessageBusy = false)
            result.fold(
                onSuccess = { conversationId -> _openConversation.emit(conversationId) },
                onFailure = { e -> _state.value = _state.value.copy(error = e.message ?: "تعذر فتح المحادثة.") }
            )
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
