package studio.ai.literium.literium_app.data.model

import com.google.firebase.firestore.PropertyName

/**
 * A notification for [userId] — collection `notifications`. Field-for-field
 * port of `types.ts`'s `AppNotification` interface.
 *
 * firestore.rules constrains `create`: social types (like/comment/follow/
 * share/reply/campaign) require `actorId == request.auth.uid` (you can only
 * notify someone that YOU did something); money/system types (earning/
 * withdrawal/system) require the creator to be an admin. See
 * [NotificationType].
 */
data class AppNotification(
    var id: String = "",
    var userId: String = "",
    /** One of [NotificationType]'s constants. */
    var type: String = NotificationType.SYSTEM,
    var title: String = "",
    var message: String = "",
    /** انظر التعليق المطابق على `DirectMessage.isRead` في `MessageModels.kt` — نفس علّة اشتقاق
     *  Firestore التلقائي لاسم الحقل من الدالة `isRead()` بحذف `is` (يتوقع حقلاً باسم `read` بينما
     *  المكتوب فعلياً هو `isRead`)، فبلا هذا التوصيف تبقى القراءة `false` دائماً بصرف النظر عمّا كُتب. */
    @get:PropertyName("isRead") @set:PropertyName("isRead")
    var isRead: Boolean = false,
    var createdAt: String = "",
    var actionUrl: String? = null,
    /** Article this notification should deep-link to, if any. */
    var articleId: String? = null,
    /** Uid of whoever performed the triggering action (liked/commented/followed/shared). */
    var actorId: String? = null
)

object NotificationType {
    const val LIKE = "like"
    const val COMMENT = "comment"
    const val FOLLOW = "follow"
    const val EARNING = "earning"
    const val WITHDRAWAL = "withdrawal"
    const val CAMPAIGN = "campaign"
    const val SYSTEM = "system"
    const val SHARE = "share"
    const val REPLY = "reply"

    /** Requires `actorId == callingUid` on create (firestore.rules) — any user can raise these about themselves. */
    val ACTOR_GATED = setOf(LIKE, COMMENT, FOLLOW, SHARE, REPLY, CAMPAIGN)

    /** Requires the creator to be an admin (firestore.rules) — never client-creatable by a regular user. */
    val ADMIN_ONLY = setOf(EARNING, WITHDRAWAL, SYSTEM)
}
