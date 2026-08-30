package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.AppNotification
import java.time.Instant

/**
 * `AppNotification` CRUD (spec §9). Ports `firestoreService.ts`'s
 * "الإشعارات" section. Note per [AppNotification.ACTOR_GATED]/
 * [AppNotification.ADMIN_ONLY], firestore.rules restricts WHO may create a
 * given [AppNotification.type] — a social type requires
 * `actorId == callingUid`, a money/system type requires the caller to be an
 * admin; [createNotification] does not itself enforce this (Firestore does,
 * server-side), but callers should construct [AppNotification] accordingly
 * or the write will simply be rejected.
 *
 * Failure convention: see [safeCall]'s file KDoc. [createNotification] is
 * the documented exception — like source, a failed notification write must
 * never fail the underlying action that triggered it (a like/comment/
 * follow must still succeed even if its notification didn't).
 */
class NotificationRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val notificationsCol get() = firestore.collection(FirestoreCollections.NOTIFICATIONS)

    /** Always resolves successfully — see class KDoc. */
    suspend fun createNotification(notification: AppNotification): Result<Unit> {
        return try {
            val payload = mutableMapOf<String, Any?>(
                "userId" to notification.userId,
                "type" to notification.type,
                "title" to notification.title,
                "message" to notification.message,
                "isRead" to false,
                "createdAt" to Instant.now().toString()
            )
            notification.actionUrl?.let { payload["actionUrl"] = it }
            notification.articleId?.let { payload["articleId"] = it }
            notification.actorId?.let { payload["actorId"] = it }
            notificationsCol.add(payload).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.success(Unit)
        }
    }

    fun observeNotifications(userId: String): Flow<List<AppNotification>> = callbackFlow {
        val registration = notificationsCol.whereEqualTo("userId", userId).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.mapNotNull { it.toObject<AppNotification>()?.copy(id = it.id) }.orEmpty()
                .sortedByDescending { it.createdAt }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    suspend fun markNotificationRead(notificationId: String): Result<Unit> = safeCall {
        notificationsCol.document(notificationId).update("isRead", true).await()
        Unit
    }

    suspend fun markAllNotificationsRead(notifications: List<AppNotification>): Result<Unit> = safeCall {
        notifications.filter { !it.isRead }.forEach { n ->
            notificationsCol.document(n.id).update("isRead", true).await()
        }
        Unit
    }

    /** firestore.rules restricts this to the notification's own recipient. */
    suspend fun deleteNotification(notificationId: String): Result<Unit> = safeCall {
        notificationsCol.document(notificationId).delete().await()
        Unit
    }

    suspend fun clearAllNotifications(notifications: List<AppNotification>): Result<Unit> = safeCall {
        notifications.forEach { n -> notificationsCol.document(n.id).delete().await() }
        Unit
    }
}
