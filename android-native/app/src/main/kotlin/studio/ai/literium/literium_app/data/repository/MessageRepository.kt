package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.Conversation
import studio.ai.literium.literium_app.data.model.DirectMessage
import studio.ai.literium.literium_app.data.model.MessageReport
import studio.ai.literium.literium_app.data.model.PresenceState
import java.time.Instant

/**
 * Direct messaging: conversations, messages, typing/presence signals,
 * block/mute, reporting, and the admin oversight/broadcast paths. Ports
 * `firestoreService.ts`'s "المحادثات والرسائل" section in full (spec §7).
 *
 * Failure convention: see [safeCall]'s file KDoc. [setTypingState] and
 * [updateMyPresence] are the documented exceptions — like source, both are
 * best-effort side channels that must never surface an error to the
 * sending user (a missed typing/heartbeat update is invisible and
 * harmless; interrupting message-sending over it would not be).
 */
class MessageRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val conversationsCol get() = firestore.collection(FirestoreCollections.CONVERSATIONS)
    private val messagesCol get() = firestore.collection(FirestoreCollections.MESSAGES)
    private val reportsCol get() = firestore.collection(FirestoreCollections.REPORTS)
    private val usersCol get() = firestore.collection(FirestoreCollections.USERS)

    private fun conversationIdFor(userA: String, userB: String): String =
        listOf(userA, userB).sorted().joinToString("_")

    /** Creates the conversation document if it doesn't exist yet; always returns the (possibly
     *  pre-existing) conversation id, which is always `"{sorted(a,b)}_joined_by__"`-shaped per [conversationIdFor]. */
    suspend fun ensureConversation(currentUserId: String, otherUserId: String): Result<String> = safeCall {
        require(currentUserId != otherUserId) { "لا يمكنك مراسلة نفسك." }
        val convId = conversationIdFor(currentUserId, otherUserId)
        val ref = conversationsCol.document(convId)
        val snap = ref.get().await()
        if (!snap.exists()) {
            val nowIso = Instant.now().toString()
            ref.set(
                mapOf(
                    "participants" to listOf(currentUserId, otherUserId),
                    "lastMessage" to "",
                    "lastMessageAt" to nowIso,
                    "createdAt" to nowIso
                )
            ).await()
        }
        convId
    }

    /**
     * Sends a message and updates the conversation summary in the same call — including clearing the
     * sender's own typing indicator and un-hiding the conversation for the recipient if they had
     * previously closed it (matches `sendMessageToFirestore` exactly, including the sticker/media
     * preview text used for `lastMessage`).
     */
    suspend fun sendMessage(
        conversationId: String,
        senderId: String,
        participants: List<String>,
        text: String,
        mediaUrl: String? = null,
        mediaType: String? = null
    ): Result<Unit> = safeCall {
        val recipientId = participants.firstOrNull { it != senderId } ?: ""
        val nowIso = Instant.now().toString()
        val messagePayload = mutableMapOf<String, Any?>(
            "conversationId" to conversationId,
            "senderId" to senderId,
            "participants" to participants,
            "text" to text,
            "isRead" to false,
            "createdAt" to nowIso
        )
        mediaUrl?.let { messagePayload["mediaUrl"] = it }
        mediaType?.let { messagePayload["mediaType"] = it }
        messagesCol.add(messagePayload).await()

        val lastMessagePreview = when (mediaType) {
            "sticker" -> "📎 ملصق"
            null -> text.take(120)
            else -> "📎 وسائط"
        }
        val summaryUpdate = mutableMapOf<String, Any?>(
            "participants" to participants,
            "lastMessage" to lastMessagePreview,
            "lastMessageAt" to nowIso,
            "typing" to mapOf(senderId to null)
        )
        if (recipientId.isNotEmpty()) summaryUpdate["hiddenFor"] = FieldValue.arrayRemove(recipientId)
        conversationsCol.document(conversationId).set(summaryUpdate, SetOptions.merge()).await()
        Unit
    }

    /** Best-effort — a missed typing update is invisible and never surfaced as an error, matching source. */
    suspend fun setTypingState(conversationId: String, userId: String, isTyping: Boolean): Result<Unit> {
        return try {
            conversationsCol.document(conversationId).set(
                mapOf("typing" to mapOf(userId to (if (isTyping) Instant.now().toString() else null))),
                SetOptions.merge()
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.success(Unit)
        }
    }

    /** Hides the conversation from MY inbox only — not deleted for the other participant; automatically
     *  un-hides the next time they send me a message (see [sendMessage]). */
    suspend fun hideConversationForMe(conversationId: String, myUserId: String): Result<Unit> = safeCall {
        conversationsCol.document(conversationId).set(
            mapOf("hiddenFor" to FieldValue.arrayUnion(myUserId)),
            SetOptions.merge()
        ).await()
        Unit
    }

    /** Blocking prevents the blocked user from sending further messages (enforced in firestore.rules too, not just UI). */
    suspend fun toggleBlockUser(currentUserId: String, targetUserId: String, block: Boolean): Result<Unit> = safeCall {
        usersCol.document(currentUserId).update(
            "blockedUserIds",
            if (block) FieldValue.arrayUnion(targetUserId) else FieldValue.arrayRemove(targetUserId)
        ).await()
        Unit
    }

    /** Muting does not block receipt — only silences unread badges/alerts locally. */
    suspend fun toggleMuteUser(currentUserId: String, targetUserId: String, mute: Boolean): Result<Unit> = safeCall {
        usersCol.document(currentUserId).update(
            "mutedUserIds",
            if (mute) FieldValue.arrayUnion(targetUserId) else FieldValue.arrayRemove(targetUserId)
        ).await()
        Unit
    }

    /** Best-effort — a missed heartbeat is covered by the 60s staleness window ([PresenceRules]), never surfaced as an error. */
    suspend fun updateMyPresence(userId: String, state: String): Result<Unit> {
        return try {
            val nowIso = Instant.now().toString()
            val presence = if (state == PresenceState.ONLINE) {
                mapOf("state" to state, "lastHeartbeatAt" to nowIso)
            } else {
                mapOf("state" to state, "lastSeenAt" to nowIso)
            }
            usersCol.document(userId).update("presence", presence).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.success(Unit)
        }
    }

    suspend fun submitUserReport(
        reporterId: String,
        reportedUserId: String,
        conversationId: String?,
        reason: String,
        details: String?
    ): Result<Unit> = safeCall {
        val payload = mutableMapOf<String, Any?>(
            "reporterId" to reporterId,
            "reportedUserId" to reportedUserId,
            "reason" to reason,
            "status" to "pending",
            "createdAt" to Instant.now().toString()
        )
        conversationId?.let { payload["conversationId"] = it }
        details?.let { payload["details"] = it }
        reportsCol.add(payload).await()
        Unit
    }

    // ---- Admin oversight ----

    /** Every conversation on the platform, newest activity first — `isAdmin()` bypasses the normal
     *  `participants`-membership read restriction (spec §4.27). */
    fun observeAllConversationsForAdmin(): Flow<List<Conversation>> = callbackFlow {
        val registration = conversationsCol.orderBy("lastMessageAt", Query.Direction.DESCENDING)
            .addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                trySend(snap?.documents?.mapNotNull { it.toObject<Conversation>()?.copy(id = it.id) }.orEmpty())
            }
        awaitClose { registration.remove() }
    }

    /** Read-only for admin oversight — never writes `isRead`/`typing`, so neither party can tell the admin has opened the thread. */
    fun observeConversationMessagesForAdmin(conversationId: String): Flow<List<DirectMessage>> = callbackFlow {
        val registration = messagesCol.whereEqualTo("conversationId", conversationId)
            .addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { it.toObject<DirectMessage>()?.copy(id = it.id) }.orEmpty()
                    .sortedBy { it.createdAt }
                trySend(list)
            }
        awaitClose { registration.remove() }
    }

    /**
     * Sends an admin broadcast message to every id in [recipientIds] (self-excluded), via the same
     * conversations/messages path as a normal 1:1 message. Batched at 200 recipients per Firestore
     * `WriteBatch` (400 writes per batch — comfortably under Firestore's 500-write batch limit).
     * Returns (sentCount, failedCount).
     */
    suspend fun broadcastMessageToAllUsers(adminId: String, recipientIds: List<String>, text: String): Result<Pair<Int, Int>> = safeCall {
        val targets = recipientIds.filter { it.isNotBlank() && it != adminId }
        var sent = 0
        var failed = 0
        val nowIso = Instant.now().toString()
        val chunkSize = 200
        targets.chunked(chunkSize).forEach { chunk ->
            val batch = firestore.batch()
            chunk.forEach { recipientId ->
                val convId = conversationIdFor(adminId, recipientId)
                batch.set(
                    conversationsCol.document(convId),
                    mapOf(
                        "participants" to listOf(adminId, recipientId),
                        "lastMessage" to text.take(120),
                        "lastMessageAt" to nowIso
                    ),
                    SetOptions.merge()
                )
                batch.set(
                    messagesCol.document(),
                    mapOf(
                        "conversationId" to convId,
                        "senderId" to adminId,
                        "participants" to listOf(adminId, recipientId),
                        "text" to text,
                        "isRead" to false,
                        "createdAt" to nowIso
                    )
                )
            }
            try {
                batch.commit().await()
                sent += chunk.size
            } catch (e: Exception) {
                failed += chunk.size
            }
        }
        sent to failed
    }

    // ---- Own inbox ----

    fun observeConversations(userId: String): Flow<List<Conversation>> = callbackFlow {
        val registration = conversationsCol.whereArrayContains("participants", userId)
            .addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { it.toObject<Conversation>()?.copy(id = it.id) }.orEmpty()
                    .sortedByDescending { it.lastMessageAt }
                trySend(list)
            }
        awaitClose { registration.remove() }
    }

    fun observeMessages(userId: String): Flow<List<DirectMessage>> = callbackFlow {
        val registration = messagesCol.whereArrayContains("participants", userId)
            .addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { it.toObject<DirectMessage>()?.copy(id = it.id) }.orEmpty()
                    .sortedBy { it.createdAt }
                trySend(list)
            }
        awaitClose { registration.remove() }
    }

    /**
     * Marks each message id read by updating its own document directly — deliberately NOT a `where`
     * query (see source's own extensive comment on why: a query without a `participants`-membership
     * clause is silently rejected by firestore.rules for non-admin callers, since the rule's condition
     * cannot be proven from the query's own `where` clauses alone). [messageIds] should come from an
     * already-subscribed [observeMessages] list.
     */
    suspend fun markMessagesReadByIds(messageIds: List<String>): Result<Unit> = safeCall {
        val ids = messageIds.filter { it.isNotBlank() }
        if (ids.isEmpty()) return@safeCall Unit
        ids.forEach { id -> messagesCol.document(id).update("isRead", true).await() }
        Unit
    }

    /** Allowed for the message's own sender, or an admin (firestore.rules). */
    suspend fun deleteMessage(messageId: String): Result<Unit> = safeCall {
        messagesCol.document(messageId).delete().await()
        Unit
    }

    /** Admin-only (firestore.rules restricts deleting the `conversations` document itself to `isAdmin()`,
     *  unlike single-message deletion). [messageIds] should come from already-loaded state to avoid an extra query. */
    suspend fun deleteConversation(conversationId: String, messageIds: List<String>): Result<Unit> = safeCall {
        messageIds.chunked(400).forEach { chunk ->
            val batch = firestore.batch()
            chunk.forEach { id -> batch.delete(messagesCol.document(id)) }
            batch.commit().await()
        }
        conversationsCol.document(conversationId).delete().await()
        Unit
    }
}
