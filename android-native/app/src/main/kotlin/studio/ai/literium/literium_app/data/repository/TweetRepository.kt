package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.CommentReply
import studio.ai.literium.literium_app.data.model.Tweet
import studio.ai.literium.literium_app.data.model.TweetComment
import java.time.Instant

/**
 * Tweets — short posts (spec §8), max 280 characters (enforced by
 * firestore.rules on create; enforce it client-side too before ever
 * calling [addTweet]). Ports `firestoreService.ts`'s entire "التغريدات"
 * section: tweets, `tweetLikes`, `tweetFavorites`, `tweetComments`.
 *
 * Failure convention: see [safeCall]'s file KDoc.
 */
class TweetRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val tweetsCol get() = firestore.collection(FirestoreCollections.TWEETS)
    private val tweetLikesCol get() = firestore.collection(FirestoreCollections.TWEET_LIKES)
    private val tweetFavoritesCol get() = firestore.collection(FirestoreCollections.TWEET_FAVORITES)
    private val tweetCommentsCol get() = firestore.collection(FirestoreCollections.TWEET_COMMENTS)

    fun observeTweets(): Flow<List<Tweet>> = callbackFlow {
        val registration = tweetsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.mapNotNull { it.toObject<Tweet>()?.copy(id = it.id) }.orEmpty()
                .sortedByDescending { it.createdAt }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    /** One-shot fetch for an explicit pull-to-refresh — same rationale as `ArticleRepository.fetchArticlesOnce`. */
    suspend fun fetchTweetsOnce(): Result<List<Tweet>> = safeCall {
        val snap = tweetsCol.get().await()
        snap.documents.mapNotNull { it.toObject<Tweet>()?.copy(id = it.id) }.sortedByDescending { it.createdAt }
    }

    /** [tweet.id] must already be a client-generated id — unlike articles, tweet documents are written
     *  with `setDoc(doc(db, 'tweets', tweet.id), tweet)`, never `addDoc`, so the id always exists up front. */
    suspend fun addTweet(tweet: Tweet): Result<Unit> = safeCall {
        require(tweet.id.isNotBlank()) { "يجب توليد معرّف للتغريدة قبل حفظها." }
        require(tweet.content.length in 1..280) { "نص التغريدة يجب أن يكون بين 1 و280 حرفاً." }
        tweetsCol.document(tweet.id).set(tweet).await()
        Unit
    }

    /** Allowed for the tweet's own author or an admin (firestore.rules). */
    suspend fun deleteTweet(tweetId: String): Result<Unit> = safeCall {
        tweetsCol.document(tweetId).delete().await()
        Unit
    }

    suspend fun incrementTweetShares(tweetId: String): Result<Unit> = safeCall {
        tweetsCol.document(tweetId).update("sharesCount", FieldValue.increment(1)).await()
        Unit
    }

    // ---- Likes ----

    fun observeTweetLikes(): Flow<List<Pair<String, String>>> = callbackFlow {
        val registration = tweetLikesCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.mapNotNull { doc ->
                val tweetId = doc.getString("tweetId") ?: return@mapNotNull null
                val userId = doc.getString("userId") ?: return@mapNotNull null
                tweetId to userId
            }.orEmpty()
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    suspend fun likeTweet(tweetId: String, userId: String): Result<Unit> = safeCall {
        tweetLikesCol.document("${tweetId}_$userId").set(
            mapOf("tweetId" to tweetId, "userId" to userId, "createdAt" to Instant.now().toString())
        ).await()
        tweetsCol.document(tweetId).update("likesCount", FieldValue.increment(1)).await()
        Unit
    }

    suspend fun unlikeTweet(tweetId: String, userId: String): Result<Unit> = safeCall {
        tweetLikesCol.document("${tweetId}_$userId").delete().await()
        tweetsCol.document(tweetId).update("likesCount", FieldValue.increment(-1)).await()
        Unit
    }

    // ---- Favorites (star, distinct from a like) ----

    /** Only readable by its own owner or an admin per firestore.rules (unlike [observeTweetLikes], which is public). */
    fun observeTweetFavorites(userId: String?): Flow<List<String>> = callbackFlow {
        // `callbackFlow` requires `awaitClose` on every path before the block returns, so the
        // "no user" branch routes through a no-op `awaitClose { }` rather than an early return.
        if (userId == null) {
            trySend(emptyList())
            awaitClose { }
        } else {
            val registration = tweetFavoritesCol.whereEqualTo("userId", userId).addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                trySend(snap?.documents?.mapNotNull { it.getString("tweetId") }.orEmpty())
            }
            awaitClose { registration.remove() }
        }
    }

    suspend fun favoriteTweet(tweetId: String, userId: String): Result<Unit> = safeCall {
        tweetFavoritesCol.document("${tweetId}_$userId").set(
            mapOf("tweetId" to tweetId, "userId" to userId, "createdAt" to Instant.now().toString())
        ).await()
        Unit
    }

    suspend fun unfavoriteTweet(tweetId: String, userId: String): Result<Unit> = safeCall {
        tweetFavoritesCol.document("${tweetId}_$userId").delete().await()
        Unit
    }

    // ---- Comments ----

    fun observeTweetComments(): Flow<List<TweetComment>> = callbackFlow {
        val registration = tweetCommentsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.mapNotNull { it.toObject<TweetComment>()?.copy(id = it.id) }.orEmpty()
                .sortedByDescending { it.createdAt }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    suspend fun addTweetComment(comment: TweetComment): Result<Unit> = safeCall {
        tweetCommentsCol.document(comment.id).set(comment).await()
        tweetsCol.document(comment.tweetId).update("commentsCount", FieldValue.increment(1)).await()
        Unit
    }

    suspend fun addReplyToTweetComment(commentId: String, reply: CommentReply): Result<Unit> = safeCall {
        tweetCommentsCol.document(commentId).update("replies", FieldValue.arrayUnion(reply)).await()
        Unit
    }

    suspend fun toggleTweetCommentLike(commentId: String, userId: String, isLiking: Boolean): Result<Unit> = safeCall {
        tweetCommentsCol.document(commentId).update(
            mapOf(
                "likesCount" to FieldValue.increment(if (isLiking) 1 else -1),
                "likedBy" to if (isLiking) FieldValue.arrayUnion(userId) else FieldValue.arrayRemove(userId)
            )
        ).await()
        Unit
    }
}
