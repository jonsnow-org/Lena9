package studio.ai.literium.literium_app.ui.screens.follow

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.FollowRepository
import studio.ai.literium.literium_app.data.repository.mapFirestoreUserDocument

data class FollowListUiState(
    val isLoading: Boolean = true,
    val users: List<User> = emptyList(),
    /** Ids the SIGNED-IN viewer (not [targetUserId]) already follows — drives each row's follow/unfollow button. */
    val followedByMeIds: Set<String> = emptySet(),
    /** The signed-in viewer's own uid, so the screen can hide the follow button on its own row. */
    val currentUserId: String = "",
    val errorMessage: String? = null
)

/**
 * Real followers/following list for [targetUserId] — spec §4.19a / `FollowListModal.tsx`. Backed by
 * [FollowRepository.observeFollows] (the real `follows` collection, the source of truth per that
 * repository's own file KDoc), not the denormalized `User.followersCount`/`followingCount` counters.
 */
class FollowListViewModel(
    private val targetUserId: String,
    private val showFollowers: Boolean,
    private val followRepository: FollowRepository = FollowRepository(),
    private val authRepository: AuthRepository = AuthRepository(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) : ViewModel() {

    val currentUserId: String = authRepository.currentFirebaseUser?.uid.orEmpty()

    /** [showFollowers] true -> everyone following [targetUserId]; false -> everyone [targetUserId] follows. */
    private val relevantIdsFlow = followRepository.observeFollows()
        .map { all ->
            if (showFollowers) all.filter { it.followingId == targetUserId }.map { it.followerId }
            else all.filter { it.followerId == targetUserId }.map { it.followingId }
        }
        .distinctUntilChanged()

    private val myFollowingIdsFlow = followRepository.observeFollows()
        .map { all -> all.filter { it.followerId == currentUserId }.map { it.followingId }.toSet() }

    @OptIn(ExperimentalCoroutinesApi::class)
    private val usersFlow = relevantIdsFlow.flatMapLatest { ids -> flow { emit(fetchUsersByIds(ids)) } }

    val uiState: StateFlow<FollowListUiState> = combine(usersFlow, myFollowingIdsFlow) { users, followedIds ->
        FollowListUiState(isLoading = false, users = users, followedByMeIds = followedIds, currentUserId = currentUserId)
    }
        .catch { e -> emit(FollowListUiState(isLoading = false, errorMessage = e.message ?: "تعذر تحميل القائمة.")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), FollowListUiState())

    private suspend fun fetchUsersByIds(ids: List<String>): List<User> {
        if (ids.isEmpty()) return emptyList()
        val usersCol = firestore.collection(FirestoreCollections.USERS)
        val byId = mutableMapOf<String, User>()
        ids.chunked(10).forEach { chunk ->
            try {
                val snap = usersCol.whereIn(FieldPath.documentId(), chunk).get().await()
                snap.documents.forEach { doc -> byId[doc.id] = mapFirestoreUserDocument(doc.id, doc.data ?: emptyMap()) }
            } catch (e: Exception) {
                // Best-effort, matches MessagesViewModel.fetchUsersByIds — a failed chunk just drops
                // those rows rather than blanking the whole list.
            }
        }
        // Preserve the follow-relationship order ([followers.tsx]'s own `follows` query has no
        // meaningful order either — this just keeps rows stable across recompositions).
        return ids.mapNotNull { byId[it] }
    }

    /** No-op for [targetUserId] == self or a signed-out viewer, matching `FollowListModal.tsx`'s own
     *  `!isSelf && currentUserId` guard on rendering the button at all. */
    fun toggleFollow(otherUserId: String) {
        if (currentUserId.isBlank() || otherUserId == currentUserId) return
        viewModelScope.launch {
            if (uiState.value.followedByMeIds.contains(otherUserId)) {
                followRepository.unfollowUser(currentUserId, otherUserId)
            } else {
                followRepository.followUser(currentUserId, otherUserId)
            }
        }
    }
}
