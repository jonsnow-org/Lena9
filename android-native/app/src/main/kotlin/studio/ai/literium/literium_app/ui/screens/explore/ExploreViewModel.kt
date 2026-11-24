package studio.ai.literium.literium_app.ui.screens.explore

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleStatus
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.FollowRepository
import studio.ai.literium.literium_app.data.repository.mapFirestoreUserDocument
import studio.ai.literium.literium_app.util.ArabicSearch

enum class ExploreFilter { TRENDING, TOP_RATED, WRITERS, LOCKED }

data class ExploreUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val query: String = "",
    val filter: ExploreFilter = ExploreFilter.TRENDING,
    val articles: List<Article> = emptyList(),
    val writers: List<User> = emptyList(),
    val currentUserId: String? = null,
    val followedWriterIds: Set<String> = emptySet(),
    val bookmarkedArticleIds: Set<String> = emptySet()
) {
    /** Arabic-normalized search + active filter, matching `ExploreView.tsx`'s `filteredArticles`. */
    val filteredArticles: List<Article>
        get() = articles.filter { art ->
            val matchesSearch = query.isBlank() ||
                ArabicSearch.matches(art.title, query) ||
                ArabicSearch.matches(art.description, query) ||
                ArabicSearch.matches(art.writerName, query) ||
                art.tags.any { ArabicSearch.matches(it, query) }
            if (!matchesSearch) return@filter false
            when (filter) {
                ExploreFilter.TRENDING -> art.viewsCount > 100
                ExploreFilter.TOP_RATED -> art.ratingsCount > 0 && art.rating >= 4.8
                ExploreFilter.WRITERS -> writers.any { it.id == art.writerId }
                ExploreFilter.LOCKED -> art.isLocked
            }
        }

    /** Search results for the writers strip — matches `ExploreView.tsx`'s `filteredWriters`. */
    val filteredWriters: List<User>
        get() = if (query.isBlank()) writers else writers.filter { w ->
            ArabicSearch.matches(w.username, query) ||
                ArabicSearch.matches(w.fullName, query) ||
                ArabicSearch.matches(w.penName ?: "", query) ||
                ArabicSearch.matches(w.companyName ?: "", query)
        }

    /** Trending tags cloud — real tag counts extracted from loaded articles, matches `ExploreView.tsx`. */
    val trendingTags: List<Pair<String, Int>>
        get() {
            val counts = mutableMapOf<String, Int>()
            articles.forEach { art -> art.tags.forEach { t -> val c = t.trim(); if (c.isNotEmpty()) counts[c] = (counts[c] ?: 0) + 1 } }
            return counts.entries.sortedByDescending { it.value }.take(10).map { it.key to it.value }
        }
}

/**
 * Backs [ExploreScreen] (spec §4.3) — discovery surface: search/browse by category, top writers
 * strip, trending tags cloud, and a ranked article list. Search uses [ArabicSearch] exactly as
 * `ExploreView.tsx` does — never a naive substring match, or Arabic spelling variants silently break
 * search (spec §1.4).
 */
class ExploreViewModel(application: Application) : AndroidViewModel(application) {

    private val articleRepository = ArticleRepository()
    private val followRepository = FollowRepository()
    private val authRepository = AuthRepository()
    private val firestore = FirebaseFirestore.getInstance()

    private val prefs by lazy {
        getApplication<Application>().getSharedPreferences("literium_prefs", Context.MODE_PRIVATE)
    }

    private val _uiState = MutableStateFlow(
        ExploreUiState(bookmarkedArticleIds = prefs.getStringSet("literium_bookmarks", emptySet())?.toSet() ?: emptySet())
    )
    val uiState: StateFlow<ExploreUiState> = _uiState.asStateFlow()

    /** All registered accounts — `ExploreView.tsx` genuinely receives the whole `users` collection as
     *  its `writers` prop (`writers={users}` in `App.tsx`), not a role-filtered subset; ported as-is. */
    private fun observeAllUsers() = callbackFlow {
        val registration = firestore.collection(FirestoreCollections.USERS).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.map { mapFirestoreUserDocument(it.id, it.data ?: emptyMap()) }.orEmpty()
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    init {
        viewModelScope.launch {
            authRepository.authState().collect { fbUser ->
                _uiState.value = _uiState.value.copy(currentUserId = fbUser?.uid)
            }
        }
        viewModelScope.launch {
            combine(
                articleRepository.observeArticles(),
                observeAllUsers(),
                followRepository.observeFollows()
            ) { articles, users, follows -> Triple(articles, users, follows) }
                .catch { e -> _uiState.value = _uiState.value.copy(isLoading = false) }
                .collect { (articles, users, follows) ->
                    val uid = _uiState.value.currentUserId
                    val followedIds = if (uid != null) follows.filter { it.followerId == uid }.map { it.followingId }.toSet() else emptySet()
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        articles = articles.filter { it.status == ArticleStatus.PUBLISHED },
                        writers = users,
                        followedWriterIds = followedIds
                    )
                }
        }
    }

    /** Pull-to-refresh / refresh-button entry point — same rationale as `FeedViewModel.refresh`. */
    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            val result = articleRepository.fetchArticlesOnce()
            _uiState.value = _uiState.value.copy(
                isRefreshing = false,
                articles = result.getOrNull()?.filter { it.status == ArticleStatus.PUBLISHED } ?: _uiState.value.articles
            )
        }
    }

    fun setQuery(query: String) {
        _uiState.value = _uiState.value.copy(query = query)
    }

    fun setFilter(filter: ExploreFilter) {
        _uiState.value = _uiState.value.copy(filter = filter)
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
}
