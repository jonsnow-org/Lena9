package studio.ai.literium.literium_app.ui.screens.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.firebase.PlatformConstants
import studio.ai.literium.literium_app.data.model.Conversation
import studio.ai.literium.literium_app.data.model.DirectMessage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.MessageRepository
import studio.ai.literium.literium_app.data.repository.mapFirestoreUserDocument
import studio.ai.literium.literium_app.util.PresenceRules

/**
 * One conversation-list row, fully display-ready.
 *
 * ⚠️ Deliberately NOT read off [Conversation.partnerId]/[Conversation.partnerName]/
 * [Conversation.partnerAvatar]/[Conversation.partnerRole]/[Conversation.partnerTypingAt]/
 * [Conversation.unreadCount] — cross-checked against `App.tsx` (the real source of truth for how the
 * web app actually builds its `conversations` array) and confirmed those fields are NEVER written to
 * the `conversations` Firestore document at all (`ensureConversation`/`sendMessageToFirestore` only
 * ever write `participants`/`lastMessage`/`lastMessageAt`/`createdAt`/`typing`/`hiddenFor`). Source's
 * own code comment on this is explicit: reading `partnerName`/`partnerAvatar` straight off the
 * document "كان يجعل قائمة المحادثات تظهر فارغة/بلا اسم لكل من يفتحها" (made the conversation list show
 * up empty/nameless for everyone). The fix there — and here — is deriving all of these client-side by
 * joining `participants` against the live `users` collection. See [MessagesViewModel] for the join.
 */
data class ConversationDisplay(
    val id: String,
    val partnerId: String,
    val partnerName: String,
    val partnerAvatar: String,
    val partnerRole: String,
    val partnerVerified: Boolean,
    val lastMessage: String,
    val lastMessageTime: String?,
    val isPartnerTypingNow: Boolean,
    val isPartnerOnline: Boolean,
    val isMutedByMe: Boolean,
    val unreadCount: Int
)

data class MessagesUiState(
    val isLoading: Boolean = true,
    val conversations: List<ConversationDisplay> = emptyList(),
    val errorMessage: String? = null
) {
    val totalUnread: Int get() = conversations.sumOf { it.unreadCount }
}

class MessagesViewModel(
    private val messageRepository: MessageRepository = MessageRepository(),
    private val authRepository: AuthRepository = AuthRepository(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) : ViewModel() {

    val currentUserId: String = authRepository.currentFirebaseUser?.uid.orEmpty()

    private val conversationsFlow = messageRepository.observeConversations(currentUserId)
    private val messagesFlow = messageRepository.observeMessages(currentUserId)
    private val currentUserFlow = authRepository.observeUser(currentUserId)

    /** Re-emits once a second so "متصل الآن"/"يكتب الآن" freshness windows (see [PresenceRules]) age out live. */
    private val tickerFlow = flow {
        while (true) {
            emit(System.currentTimeMillis())
            delay(1000)
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private val partnerUsersFlow = conversationsFlow
        .map { convs -> convs.mapNotNull { c -> c.participants.firstOrNull { it != currentUserId } }.distinct() }
        .distinctUntilChanged()
        .flatMapLatest { ids -> flow { emit(fetchUsersByIds(ids)) } }

    val uiState: StateFlow<MessagesUiState> = combine(
        conversationsFlow,
        messagesFlow,
        currentUserFlow,
        partnerUsersFlow,
        tickerFlow
    ) { conversations, messages, me, partnerUsers, now ->
        buildUiState(conversations, messages, me, partnerUsers, now)
    }
        .catch { e -> emit(MessagesUiState(isLoading = false, errorMessage = e.message ?: "تعذر تحميل المحادثات.")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MessagesUiState())

    private suspend fun fetchUsersByIds(ids: List<String>): Map<String, User> {
        if (ids.isEmpty()) return emptyMap()
        val usersCol = firestore.collection(FirestoreCollections.USERS)
        val result = mutableMapOf<String, User>()
        ids.chunked(10).forEach { chunk ->
            try {
                val snap = usersCol.whereIn(FieldPath.documentId(), chunk).get().await()
                snap.documents.forEach { doc -> result[doc.id] = mapFirestoreUserDocument(doc.id, doc.data ?: emptyMap()) }
            } catch (e: Exception) {
                // Best-effort: a failed partner-profile lookup must not blank out the whole list —
                // those rows just fall back to the "مستخدم ليتيريوم" placeholder below.
            }
        }
        return result
    }

    private fun buildUiState(
        conversations: List<Conversation>,
        messages: List<DirectMessage>,
        me: User?,
        partnerUsers: Map<String, User>,
        nowMillis: Long
    ): MessagesUiState {
        if (currentUserId.isEmpty()) {
            return MessagesUiState(isLoading = false, errorMessage = "الرجاء تسجيل الدخول لعرض رسائلك.")
        }

        // ⚠️ Deliberately NOT `m.recipientId == currentUserId` (what DirectMessagesModal.tsx literally
        // does): read MessageRepository.sendMessage's source — it never writes `recipientId` on the
        // message document at all (matches the real web write path too, `sendMessageToFirestore` never
        // sets it either). Filtering on it would make every unread badge permanently show zero. Since
        // `participants` IS always written correctly, `senderId != me` is the reliable equivalent.
        val unreadBySender = messages
            .asSequence()
            .filter { !it.isRead && it.senderId.isNotBlank() && it.senderId != currentUserId }
            .groupingBy { it.senderId }
            .eachCount()

        val visible = conversations.filter { it.hiddenFor?.contains(currentUserId) != true }

        val display = visible.mapNotNull { c ->
            val partnerId = c.participants.firstOrNull { it != currentUserId } ?: return@mapNotNull null
            val partner = partnerUsers[partnerId]
            val partnerName = partner?.penName?.takeIf { it.isNotBlank() }
                ?: partner?.companyName?.takeIf { it.isNotBlank() }
                ?: partner?.fullName?.takeIf { it.isNotBlank() }
                ?: "مستخدم ليتيريوم"
            val typingAt = c.typing?.get(partnerId)
            ConversationDisplay(
                id = c.id,
                partnerId = partnerId,
                partnerName = partnerName,
                partnerAvatar = partner?.avatarUrl?.takeIf { it.isNotBlank() } ?: PlatformConstants.DEFAULT_AVATAR_URL,
                partnerRole = partner?.role ?: UserRole.READER,
                partnerVerified = partner?.isVerified == true,
                lastMessage = c.lastMessage,
                lastMessageTime = c.lastMessageAt,
                isPartnerTypingNow = PresenceRules.isTypingFresh(typingAt, nowMillis),
                isPartnerOnline = PresenceRules.isOnlineNow(partner?.presence, nowMillis),
                isMutedByMe = me?.mutedUserIds?.contains(partnerId) == true,
                unreadCount = unreadBySender[partnerId] ?: 0
            )
        }.sortedByDescending { it.lastMessageTime ?: "" }

        return MessagesUiState(isLoading = false, conversations = display)
    }

    /** Hides the conversation from MY inbox only (spec-accurate — not a delete for the other side). */
    fun hideConversation(conversationId: String) {
        viewModelScope.launch { messageRepository.hideConversationForMe(conversationId, currentUserId) }
    }
}
