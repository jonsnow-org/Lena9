package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.Follow
import java.time.Instant

/**
 * The follow graph — collection `follows`, id always
 * `"{followerId}_{followingId}"`. This is the REAL source of truth for
 * follower/following counts: per spec §12.4 / `creatorEligibility.ts`, the
 * eligibility gate recomputes from this collection rather than trusting
 * [studio.ai.literium.literium_app.data.model.User.followersCount] (which
 * no code path in the source app actually keeps in sync). Callers computing
 * eligibility should always pass a real count derived from [observeFollows]
 * into [studio.ai.literium.literium_app.util.CreatorEligibility], not the
 * denormalized field.
 *
 * Ports `firestoreService.ts`'s "المتابعة (follows)" section exactly.
 * Failure convention: see [safeCall]'s file KDoc.
 */
class FollowRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val followsCol get() = firestore.collection(FirestoreCollections.FOLLOWS)

    suspend fun followUser(followerId: String, followingId: String): Result<Unit> = safeCall {
        require(followerId != followingId) { "لا يمكنك متابعة نفسك." }
        val followId = "${followerId}_$followingId"
        followsCol.document(followId).set(
            mapOf("followerId" to followerId, "followingId" to followingId, "createdAt" to Instant.now().toString())
        ).await()
        Unit
    }

    suspend fun unfollowUser(followerId: String, followingId: String): Result<Unit> = safeCall {
        followsCol.document("${followerId}_$followingId").delete().await()
        Unit
    }

    /** Publicly readable (firestore.rules) — the whole graph, for computing followers/following counts and lists. */
    fun observeFollows(): Flow<List<Follow>> = callbackFlow {
        val registration = followsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { runCatching { it.toObject<Follow>() }.getOrNull()?.copy(id = it.id) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }
}
