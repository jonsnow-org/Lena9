package studio.ai.literium.literium_app.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.FollowRepository
import studio.ai.literium.literium_app.data.repository.TweetRepository
import studio.ai.literium.literium_app.util.CreatorEligibility

/** The 4 tabs of the self-profile screen — spec §4.19. */
enum class ProfileTab { ARTICLES, TWEETS, LIKED, SAVED }

data class ProfileUiState(
    val isLoading: Boolean = true,
    val notSignedIn: Boolean = false,
    val currentUser: User? = null,
    val activeTab: ProfileTab = ProfileTab.ARTICLES,
    val ownArticles: List<Article> = emptyList(),
    val ownTweets: List<Tweet> = emptyList(),
    val likedArticles: List<Article> = emptyList(),
    val savedTweets: List<Tweet> = emptyList(),
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val eligibility: CreatorEligibility.Status? = null,
    val roleSwitchError: String? = null
) {
    /** "member status" label shown next to the name — same shared helper used everywhere else (spec §12.4). */
    val memberStatusLabel: String
        get() = currentUser?.let {
            CreatorEligibility.getMemberStatusLabel(it.role, eligibility?.isEligible == true)
        } ?: ""
}

/**
 * Backs [ProfileScreen] — the SELF profile (§4.19). Sources every derived number
 * (followers/following, eligibility stats) from the same real collections
 * ([FollowRepository]/[ArticleRepository]) that [CreatorEligibility] itself reads,
 * so this screen can never show a different number than [WriterProfileViewModel]
 * would for the same account.
 */
class ProfileViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val articleRepository: ArticleRepository = ArticleRepository(),
    private val tweetRepository: TweetRepository = TweetRepository(),
    private val followRepository: FollowRepository = FollowRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    private val uid: String? = FirebaseAuth.getInstance().currentUser?.uid

    private var allArticles: List<Article> = emptyList()
    private var allTweets: List<Tweet> = emptyList()
    private var likedArticleIds: Set<String> = emptySet()
    private var favoritedTweetIds: Set<String> = emptySet()

    init {
        val id = uid
        if (id == null) {
            _state.value = _state.value.copy(isLoading = false, notSignedIn = true)
        } else {
            viewModelScope.launch {
                authRepository.observeUser(id).collect { user ->
                    _state.value = _state.value.copy(currentUser = user, isLoading = false)
                    recomputeEligibility()
                }
            }
            viewModelScope.launch {
                articleRepository.observeArticles().collect { articles ->
                    allArticles = articles
                    recomputeArticleDerived(id)
                    recomputeEligibility()
                }
            }
            viewModelScope.launch {
                tweetRepository.observeTweets().collect { tweets ->
                    allTweets = tweets
                    recomputeTweetDerived(id)
                }
            }
            viewModelScope.launch {
                articleRepository.observeArticleLikes().collect { likes ->
                    likedArticleIds = likes.filter { it.userId == id }.map { it.articleId }.toSet()
                    recomputeArticleDerived(id)
                }
            }
            viewModelScope.launch {
                tweetRepository.observeTweetFavorites(id).collect { favIds ->
                    favoritedTweetIds = favIds.toSet()
                    recomputeTweetDerived(id)
                }
            }
            viewModelScope.launch {
                followRepository.observeFollows().collect { follows ->
                    val followers = follows.count { it.followingId == id }
                    val following = follows.count { it.followerId == id }
                    _state.value = _state.value.copy(followersCount = followers, followingCount = following)
                    recomputeEligibility()
                }
            }
        }
    }

    private fun recomputeArticleDerived(id: String) {
        _state.value = _state.value.copy(
            ownArticles = allArticles.filter { it.writerId == id }.sortedByDescending { it.publishedAt },
            likedArticles = allArticles.filter { it.id in likedArticleIds }
        )
    }

    private fun recomputeTweetDerived(id: String) {
        _state.value = _state.value.copy(
            ownTweets = allTweets.filter { it.authorId == id }.sortedByDescending { it.createdAt },
            savedTweets = allTweets.filter { it.id in favoritedTweetIds }
        )
    }

    private fun recomputeEligibility() {
        val user = _state.value.currentUser ?: return
        _state.value = _state.value.copy(
            eligibility = CreatorEligibility.getCreatorEligibility(
                user = user,
                articles = allArticles,
                followersCountOverride = _state.value.followersCount
            )
        )
    }

    fun selectTab(tab: ProfileTab) {
        _state.value = _state.value.copy(activeTab = tab)
    }

    /** Active-persona role switch (spec §1.3a) — self-assignable roles only, never admin. */
    fun switchRole(newRole: String) {
        val id = uid ?: return
        if (newRole !in UserRole.SELF_ASSIGNABLE) return
        viewModelScope.launch {
            val result = authRepository.switchActiveRole(id, newRole)
            if (result.isFailure) {
                _state.value = _state.value.copy(roleSwitchError = result.exceptionOrNull()?.message ?: "تعذر تبديل الدور.")
            }
        }
    }

    fun clearRoleSwitchError() {
        _state.value = _state.value.copy(roleSwitchError = null)
    }
}
