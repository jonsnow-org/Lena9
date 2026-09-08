package studio.ai.literium.literium_app.ui.screens.profile

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
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

/** The self-profile's real top-level structure — exact port of `UserProfileView.tsx`'s
 *  writerTab ("مدونة"/"تغريد"/"لوحة التحكم", spec §4.19): every registered member (not just
 *  writers, per the unified-account model) sees the same three tabs. */
enum class ProfileTab { BLOG, TWEET, CONTROL_PANEL }

/** `blogSubView` on web: "مقالاتي" (published) or "المقالات المحفوظة" (local bookmarks). */
enum class BlogSubTab { ARTICLES, BOOKMARKS }

/** `tweetSubView` on web: "تغريداتي" (own) or "المفضلة" (starred). */
enum class TweetSubTab { MINE, FAVORITES }

data class ProfileUiState(
    val isLoading: Boolean = true,
    val notSignedIn: Boolean = false,
    val currentUser: User? = null,
    val activeTab: ProfileTab = ProfileTab.BLOG,
    val blogSubTab: BlogSubTab = BlogSubTab.ARTICLES,
    val tweetSubTab: TweetSubTab = TweetSubTab.MINE,
    val ownArticles: List<Article> = emptyList(),
    val bookmarkedArticles: List<Article> = emptyList(),
    val ownTweets: List<Tweet> = emptyList(),
    val favoritedTweets: List<Tweet> = emptyList(),
    val totalOwnViews: Int = 0,
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
 * would for the same account. Bookmarks are read from the same `literium_bookmarks`
 * SharedPreferences key [studio.ai.literium.literium_app.ui.screens.feed.FeedViewModel]
 * writes to — a purely local, unsynced list on the web too (verified: `App.tsx`'s
 * `bookmarkedArticleIds` round-trips through `localStorage` only, no Firestore backing).
 */
class ProfileViewModel(application: Application) : AndroidViewModel(application) {

    private val authRepository = AuthRepository()
    private val articleRepository = ArticleRepository()
    private val tweetRepository = TweetRepository()
    private val followRepository = FollowRepository()

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    private val uid: String? = FirebaseAuth.getInstance().currentUser?.uid

    private val prefs by lazy { application.getSharedPreferences("literium_prefs", Context.MODE_PRIVATE) }
    private fun loadBookmarkIds(): Set<String> = prefs.getStringSet("literium_bookmarks", emptySet())?.toSet() ?: emptySet()

    private var allArticles: List<Article> = emptyList()
    private var allTweets: List<Tweet> = emptyList()
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
        val bookmarkIds = loadBookmarkIds()
        val own = allArticles.filter { it.writerId == id }.sortedByDescending { it.publishedAt }
        _state.value = _state.value.copy(
            ownArticles = own,
            bookmarkedArticles = allArticles.filter { it.id in bookmarkIds },
            totalOwnViews = own.sumOf { it.viewsCount }
        )
    }

    private fun recomputeTweetDerived(id: String) {
        _state.value = _state.value.copy(
            ownTweets = allTweets.filter { it.authorId == id }.sortedByDescending { it.createdAt },
            favoritedTweets = allTweets.filter { it.id in favoritedTweetIds }
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

    /** Re-read bookmarks from SharedPreferences — call when returning to this screen, since a
     *  bookmark toggled from the feed/reader doesn't otherwise notify this ViewModel. */
    fun refreshBookmarks() {
        val id = uid ?: return
        recomputeArticleDerived(id)
    }

    fun selectTab(tab: ProfileTab) {
        _state.value = _state.value.copy(activeTab = tab)
    }

    fun selectBlogSubTab(tab: BlogSubTab) {
        _state.value = _state.value.copy(blogSubTab = tab)
    }

    fun selectTweetSubTab(tab: TweetSubTab) {
        _state.value = _state.value.copy(tweetSubTab = tab)
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
