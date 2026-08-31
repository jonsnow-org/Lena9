package studio.ai.literium.literium_app.data.model

import com.google.firebase.firestore.PropertyName

/**
 * A single chat message — collection `messages`. Every document carries a
 * `participants` array (enforced by firestore.rules), which is not part of
 * the public `types.ts` `DirectMessage` shape but is required to actually
 * query/authorize the collection (`array-contains` queries) — included
 * here as it is written on every real message document.
 */
data class DirectMessage(
    var id: String = "",
    var conversationId: String = "",
    var senderId: String = "",
    var senderName: String? = null,
    var senderAvatar: String? = null,
    var recipientId: String? = null,
    /** Both participant uids — required by firestore.rules for read/query authorization. */
    var participants: List<String> = emptyList(),
    /** Kotlin-side name kept as `content` (used throughout the UI layer); the real Firestore field
     *  written/read by the live web app (`firestoreService.ts`'s `sendMessageToFirestore`) is `text`,
     *  not `content` — this mapping is required for real cross-platform message interop, not optional. */
    @get:PropertyName("text") @set:PropertyName("text")
    var content: String = "",
    var mediaUrl: String? = null,
    /** "image" | "video" | "sticker" — see [MessageMediaType]. For stickers, [content] holds the sticker id. */
    var mediaType: String? = null,
    var createdAt: String = "",
    var isRead: Boolean = false
)

object MessageMediaType {
    const val IMAGE = "image"
    const val VIDEO = "video"
    const val STICKER = "sticker"
}

/**
 * Conversation summary document — collection `conversations`, id is the two
 * participant uids sorted and joined with `_`. Field-for-field port of
 * `types.ts`'s `Conversation` interface, plus the extra fields
 * `firestoreService.ts` actually reads/writes on the document
 * ([participants], [typing], [hiddenFor]).
 */
data class Conversation(
    var id: String = "",
    var partnerId: String? = null,
    var partnerName: String? = null,
    var partnerAvatar: String? = null,
    var partnerRole: String? = null,
    var lastMessage: String = "",
    var lastMessageTime: String? = null,
    /** Actual field name written by `sendMessageToFirestore`/`ensureConversation`. */
    var lastMessageAt: String? = null,
    var unreadCount: Long? = null,
    /** ISO timestamp of the other participant's last "typing" signal (fresh = under ~4s old). */
    var partnerTypingAt: String? = null,
    /** Both participant uids — required by firestore.rules (`array-contains` queries/authorization). */
    var participants: List<String> = emptyList(),
    /** Map of uid -> ISO-typing-timestamp-or-null, written by `setTypingState`. */
    var typing: Map<String, String?>? = null,
    /** I hid this conversation from my own inbox (not deleted for the other side); cleared automatically
     *  when the other side sends a new message. */
    var isHiddenForMe: Boolean? = null,
    /** Uids that have hidden this conversation from their own inbox (raw Firestore field backing [isHiddenForMe]). */
    var hiddenFor: List<String>? = null,
    var createdAt: String? = null
)

/** Abuse/harassment report against another user — collection `reports`, admin-read-only. */
data class MessageReport(
    var id: String = "",
    var reporterId: String = "",
    var reportedUserId: String = "",
    var conversationId: String? = null,
    var messageId: String? = null,
    /** One of [ReportReason]'s constants. */
    var reason: String = ReportReason.OTHER,
    var details: String? = null,
    /** One of [ReportStatus]'s constants. */
    var status: String = ReportStatus.PENDING,
    var createdAt: String = ""
)

object ReportReason {
    const val ABUSIVE = "abusive"
    const val HARASSMENT = "harassment"
    const val SPAM = "spam"
    const val OTHER = "other"
}

object ReportStatus {
    const val PENDING = "pending"
    const val REVIEWED = "reviewed"
    const val DISMISSED = "dismissed"
}
