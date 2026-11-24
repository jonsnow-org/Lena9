package studio.ai.literium.literium_app.ui.screens.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.MessageRepository
import studio.ai.literium.literium_app.data.repository.mapFirestoreUserDocument
import studio.ai.literium.literium_app.util.ArabicSearch

/** One row in the "start a new conversation" user picker. */
data class NewConversationUserRow(
    val user: User,
    val isBlockedByMe: Boolean,
    val isBlockedByThem: Boolean
) {
    /** Mirrors [ChatUiState.canChat] — a blocked pair (either direction) must never be able to open a
     *  fresh thread, matching `firestore.rules`' own enforcement on the write path. */
    val canMessage: Boolean get() = !isBlockedByMe && !isBlockedByThem
}

data class NewConversationUiState(
    val isLoading: Boolean = true,
    val query: String = "",
    val results: List<NewConversationUserRow> = emptyList(),
    val errorMessage: String? = null
)

/**
 * Native-only addition: the web app never has a dedicated "start a new DM" screen — every real
 * conversation there starts from a writer/user profile's own message button
 * (`activeChatPartner` in `App.tsx`). A touch-first mobile client needs an explicit entry point for
 * this, so this screen (and this ViewModel) has no direct 1:1 web source to port — its behavior
 * (respecting block state, same fallback name chain) is still built to match how the rest of the app
 * already treats these concerns elsewhere (see [ChatViewModel]/[MessagesViewModel]).
 */
class NewConversationViewModel(
    private val messageRepository: MessageRepository = MessageRepository(),
    private val authRepository: AuthRepository = AuthRepository(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) : ViewModel() {

    private val currentUserId: String = authRepository.currentFirebaseUser?.uid.orEmpty()

    private val _query = MutableStateFlow("")

    /** The whole `users` collection is publicly readable (firestore.rules) — same client-side-filtered
     *  listing approach [studio.ai.literium.literium_app.data.repository.AdminRepository] already uses,
     *  since there is no server-side text-search index to query against instead. */
    private val usersFlow: Flow<List<User>> = callbackFlow {
        val registration = firestore.collection(FirestoreCollections.USERS)
            .addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                trySend(snap?.documents?.map { mapFirestoreUserDocument(it.id, it.data ?: emptyMap()) }.orEmpty())
            }
        awaitClose { registration.remove() }
    }

    private val meFlow = authRepository.observeUser(currentUserId)

    val uiState: StateFlow<NewConversationUiState> = combine(usersFlow, meFlow, _query) { users, me, query ->
        val filtered = users
            .asSequence()
            .filter { it.id != currentUserId && it.id.isNotBlank() }
            .filter { u ->
                if (query.isBlank()) return@filter true
                ArabicSearch.matches(u.fullName, query) ||
                    ArabicSearch.matches(u.username, query) ||
                    (u.penName?.let { ArabicSearch.matches(it, query) } == true) ||
                    (u.companyName?.let { ArabicSearch.matches(it, query) } == true)
            }
            .map { u ->
                NewConversationUserRow(
                    user = u,
                    isBlockedByMe = me?.blockedUserIds?.contains(u.id) == true,
                    isBlockedByThem = u.blockedUserIds?.contains(currentUserId) == true
                )
            }
            .sortedByDescending { it.canMessage }
            .toList()
        NewConversationUiState(isLoading = false, query = query, results = filtered)
    }
        .catch { e -> emit(NewConversationUiState(isLoading = false, errorMessage = e.message ?: "تعذر تحميل المستخدمين.")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), NewConversationUiState())

    fun updateQuery(value: String) {
        _query.update { value }
    }

    /** Creates (or reuses) the conversation and returns its id — the Screen navigates on success. */
    suspend fun startConversation(targetUserId: String): Result<String> =
        messageRepository.ensureConversation(currentUserId, targetUserId)
}
