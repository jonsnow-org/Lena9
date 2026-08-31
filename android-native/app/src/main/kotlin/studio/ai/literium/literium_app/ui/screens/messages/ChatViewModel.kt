package studio.ai.literium.literium_app.ui.screens.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import studio.ai.literium.literium_app.data.model.Conversation
import studio.ai.literium.literium_app.data.model.DirectMessage
import studio.ai.literium.literium_app.data.model.MessageMediaType
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.MessageRepository
import studio.ai.literium.literium_app.util.DateFormatAr
import studio.ai.literium.literium_app.util.PresenceRules

data class ChatUiState(
    val isLoading: Boolean = true,
    val currentUserId: String = "",
    val partnerId: String = "",
    val partnerName: String = "مستخدم ليتيريوم",
    val partnerAvatar: String = "",
    val partnerVerified: Boolean = false,
    val partnerRole: String = UserRole.READER,
    val isPartnerOnline: Boolean = false,
    val isPartnerTyping: Boolean = false,
    val lastSeenLabel: String = "غير متصل",
    val messages: List<DirectMessage> = emptyList(),
    val isBlockedByMe: Boolean = false,
    val isBlockedByThem: Boolean = false,
    val isMutedByMe: Boolean = false,
    val canChat: Boolean = true,
    val isAdmin: Boolean = false,
    val errorMessage: String? = null
)

data class UploadState(val uploading: String? = null, val error: String? = null)

/**
 * Single-thread view. `conversationId` is the same `"{sorted(a,b)}_..."` id
 * [studio.ai.literium.literium_app.data.repository.MessageRepository.ensureConversation] mints — the
 * partner uid is derived by splitting it (never from `Conversation.partnerId`, which — like
 * `partnerName`/`partnerAvatar`/`partnerTypingAt` — is never actually written to the Firestore
 * document; see [MessagesViewModel]'s file KDoc for the full cross-referenced explanation).
 */
class ChatViewModel(
    private val conversationId: String,
    private val messageRepository: MessageRepository = MessageRepository(),
    private val authRepository: AuthRepository = AuthRepository()
) : ViewModel() {

    private val currentUserId: String = authRepository.currentFirebaseUser?.uid.orEmpty()

    /** Derived, not read from any document field — see class KDoc. */
    private val partnerId: String = conversationId
        .split("_")
        .firstOrNull { it.isNotBlank() && it != currentUserId }
        ?: conversationId.split("_").lastOrNull().orEmpty()

    private val conversationFlow = messageRepository.observeConversations(currentUserId)
        .map { list -> list.firstOrNull { it.id == conversationId } }

    private val messagesFlow = messageRepository.observeMessages(currentUserId)
        .map { all -> all.filter { it.conversationId == conversationId }.sortedBy { it.createdAt } }

    private val meFlow = authRepository.observeUser(currentUserId)
    private val partnerFlow = authRepository.observeUser(partnerId)

    private val tickerFlow = flow {
        while (true) {
            emit(System.currentTimeMillis())
            delay(1000)
        }
    }

    val uiState: StateFlow<ChatUiState> = combine(
        conversationFlow, messagesFlow, meFlow, partnerFlow, tickerFlow
    ) { conversation, messages, me, partner, now ->
        buildUiState(conversation, messages, me, partner, now)
    }
        .catch { e -> emit(ChatUiState(isLoading = false, errorMessage = e.message ?: "تعذر تحميل المحادثة.")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ChatUiState(currentUserId = currentUserId, partnerId = partnerId))

    private val _uploadState = MutableStateFlow(UploadState())
    val uploadState: StateFlow<UploadState> = _uploadState.asStateFlow()

    private var lastTypingWriteAtMs = 0L

    init {
        // Marks incoming unread messages read the whole time this thread is open — not just once on
        // entry (source's own fix: onOpenConversation alone missed messages arriving while already
        // open). Keyed on senderId, not the never-populated DirectMessage.recipientId — see
        // MessagesViewModel's file KDoc for why.
        messagesFlow
            .map { msgs -> msgs.filter { it.senderId == partnerId && it.senderId != currentUserId && !it.isRead }.map { it.id } }
            .distinctUntilChanged()
            .onEach { unreadIds -> if (unreadIds.isNotEmpty()) messageRepository.markMessagesReadByIds(unreadIds) }
            .launchIn(viewModelScope)
    }

    private fun buildUiState(
        conversation: Conversation?,
        messages: List<DirectMessage>,
        me: User?,
        partner: User?,
        nowMillis: Long
    ): ChatUiState {
        if (currentUserId.isEmpty() || partnerId.isEmpty()) {
            return ChatUiState(isLoading = false, errorMessage = "تعذر تحديد أطراف هذه المحادثة.")
        }
        val isBlockedByMe = me?.blockedUserIds?.contains(partnerId) == true
        val isBlockedByThem = partner?.blockedUserIds?.contains(currentUserId) == true
        val typingAt = conversation?.typing?.get(partnerId)
        return ChatUiState(
            isLoading = false,
            currentUserId = currentUserId,
            partnerId = partnerId,
            partnerName = partner?.penName?.takeIf { it.isNotBlank() }
                ?: partner?.companyName?.takeIf { it.isNotBlank() }
                ?: partner?.fullName?.takeIf { it.isNotBlank() }
                ?: "مستخدم ليتيريوم",
            partnerAvatar = partner?.avatarUrl.orEmpty(),
            partnerVerified = partner?.isVerified == true,
            partnerRole = partner?.role ?: UserRole.READER,
            isPartnerOnline = PresenceRules.isOnlineNow(partner?.presence, nowMillis),
            isPartnerTyping = PresenceRules.isTypingFresh(typingAt, nowMillis),
            lastSeenLabel = partner?.presence?.lastSeenAt?.let { "آخر ظهور ${DateFormatAr.timeAgoAr(it)}" } ?: "غير متصل",
            messages = messages,
            isBlockedByMe = isBlockedByMe,
            isBlockedByThem = isBlockedByThem,
            isMutedByMe = me?.mutedUserIds?.contains(partnerId) == true,
            canChat = !isBlockedByMe && !isBlockedByThem,
            isAdmin = me?.role == UserRole.ADMIN
        )
    }

    /** Throttled to at most once every 2s, matching source's `lastTypingWriteRef` debounce. */
    fun onTyping() {
        val now = System.currentTimeMillis()
        if (now - lastTypingWriteAtMs < 2000) return
        lastTypingWriteAtMs = now
        viewModelScope.launch { messageRepository.setTypingState(conversationId, currentUserId, isTyping = true) }
    }

    fun sendText(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || !uiState.value.canChat) return
        viewModelScope.launch {
            messageRepository.sendMessage(
                conversationId = conversationId,
                senderId = currentUserId,
                participants = listOf(currentUserId, partnerId),
                text = trimmed
            )
        }
    }

    fun sendSticker(stickerId: String) {
        if (!uiState.value.canChat) return
        viewModelScope.launch {
            messageRepository.sendMessage(
                conversationId = conversationId,
                senderId = currentUserId,
                participants = listOf(currentUserId, partnerId),
                text = stickerId,
                mediaType = MessageMediaType.STICKER
            )
        }
    }

    /** [kind] is [MessageMediaType.IMAGE] or [MessageMediaType.VIDEO]. Caller (the Screen) reads the
     *  picked file's bytes via ContentResolver — the ViewModel deliberately stays Context-free. */
    fun sendMedia(bytes: ByteArray, fileName: String, mimeType: String, kind: String) {
        if (!uiState.value.canChat) return
        val maxBytes = if (kind == MessageMediaType.VIDEO) 50 * 1024 * 1024 else 8 * 1024 * 1024
        if (bytes.size > maxBytes) {
            _uploadState.value = UploadState(
                error = if (kind == MessageMediaType.VIDEO) "حجم الفيديو يتجاوز 50 ميغابايت." else "حجم الصورة يتجاوز 8 ميغابايت."
            )
            return
        }
        viewModelScope.launch {
            _uploadState.value = UploadState(uploading = kind)
            try {
                val authHeader = NetworkModule.authorizationHeader()
                val body = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
                val part = MultipartBody.Part.createFormData("file", fileName, body)
                val purposeBody = "message".toRequestBody("text/plain".toMediaTypeOrNull())
                val response = NetworkModule.api.uploadMedia(authHeader, part, purposeBody)
                messageRepository.sendMessage(
                    conversationId = conversationId,
                    senderId = currentUserId,
                    participants = listOf(currentUserId, partnerId),
                    text = "",
                    mediaUrl = response.url,
                    mediaType = kind
                )
                _uploadState.value = UploadState()
            } catch (e: Exception) {
                _uploadState.value = UploadState(error = e.message ?: "تعذر رفع الملف.")
            }
        }
    }

    fun clearUploadError() {
        _uploadState.value = _uploadState.value.copy(error = null)
    }

    fun deleteMessage(messageId: String) {
        viewModelScope.launch { messageRepository.deleteMessage(messageId) }
    }

    /** Removes the thread from MY inbox only — see [MessagesViewModel.hideConversation]. */
    fun hideConversation() {
        viewModelScope.launch { messageRepository.hideConversationForMe(conversationId, currentUserId) }
    }

    fun toggleBlock(block: Boolean) {
        viewModelScope.launch { messageRepository.toggleBlockUser(currentUserId, partnerId, block) }
    }

    fun toggleMute(mute: Boolean) {
        viewModelScope.launch { messageRepository.toggleMuteUser(currentUserId, partnerId, mute) }
    }

    fun submitReport(reason: String, details: String) {
        viewModelScope.launch {
            messageRepository.submitUserReport(
                reporterId = currentUserId,
                reportedUserId = partnerId,
                conversationId = conversationId,
                reason = reason,
                details = details.trim().ifBlank { null }
            )
        }
    }
}
