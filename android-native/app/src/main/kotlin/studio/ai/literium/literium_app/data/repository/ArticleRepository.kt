package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleLike
import studio.ai.literium.literium_app.data.model.ArticleRating
import studio.ai.literium.literium_app.data.model.ArticleReaction
import studio.ai.literium.literium_app.data.model.ArticleStatus
import studio.ai.literium.literium_app.data.model.Comment
import studio.ai.literium.literium_app.data.model.CommentReply
import java.time.Instant

/**
 * Articles + everything that hangs directly off an article: likes,
 * emotional reactions, star ratings, purchases (read side — the write side
 * is server-authoritative, see [studio.ai.literium.literium_app.data.remote.LiteriumApiService.unlockArticle]),
 * views, and the article comment thread. Article comments are folded in
 * here rather than a separate repository since `Comment`/`CommentReply`
 * are article-scoped in both `types.ts` and firestore.rules.
 *
 * Ports every relevant function in `firestoreService.ts`'s "Articles",
 * "Article Likes", "انطباعات القارئ العاطفية", "تقييمات المقالات",
 * "مقالات مقفولة اشتراها المستخدم", "المشاهدات" and "التعليقات" sections.
 * Failure convention: see [safeCall]'s file KDoc.
 */
class ArticleRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val articlesCol get() = firestore.collection(FirestoreCollections.ARTICLES)
    private val likesCol get() = firestore.collection(FirestoreCollections.LIKES)
    private val reactionsCol get() = firestore.collection(FirestoreCollections.REACTIONS)
    private val ratingsCol get() = firestore.collection(FirestoreCollections.RATINGS)
    private val purchasesCol get() = firestore.collection(FirestoreCollections.ARTICLE_PURCHASES)
    private val commentsCol get() = firestore.collection(FirestoreCollections.COMMENTS)

    // ---- Articles ----

    /** Live listener over the whole `articles` collection, newest [Article.publishedAt] first
     *  (matches `subscribeToArticles`'s client-side sort). Fine at current content scale; if the
     *  collection grows large enough to need pagination, add a paged variant rather than replacing this. */
    fun observeArticles(): Flow<List<Article>> = callbackFlow {
        val registration = articlesCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.mapNotNull { toArticle(it) }.orEmpty()
                .sortedByDescending { it.publishedAt }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    /** One-shot fetch (not a listener) for an explicit pull-to-refresh — see `fetchArticlesOnce`'s
     *  source comment on why a live listener alone is not sufficient on mobile (silent reconnect gaps). */
    suspend fun fetchArticlesOnce(): Result<List<Article>> = safeCall {
        val snap = articlesCol.get().await()
        snap.documents.mapNotNull { toArticle(it) }.sortedByDescending { it.publishedAt }
    }

    suspend fun fetchArticle(articleId: String): Result<Article?> = safeCall {
        toArticle(articlesCol.document(articleId).get().await())
    }

    /**
     * Create or update an article. Mirrors `saveArticleToFirestore` exactly: an id that is blank, or
     * starts with the source's placeholder prefixes (`art_temp_`/`draft_temp_`/`art_mock_`), or
     * [isNew] = true, is treated as a genuinely new document (default stat fields seeded at 0,
     * `publishedAt` left blank for a draft); otherwise it's a merge-update of the existing document.
     * Returns the resulting document id.
     */
    // Note on the update path: [articleToMap] excludes engagement/revenue counters on purpose — like
    // [AdCampaignRepository.saveCampaign], this mirrors what firestore.rules actually allows a non-admin
    // writer to change via a plain update (revenue/purchase fields are writer-frozen entirely; view/like/
    // comment/rating counters are only updatable through the dedicated methods below, which is exactly
    // what firestore.rules' third `articles` update branch — `hasOnly([...])` — carves out separately).
    suspend fun saveArticle(article: Article, isNew: Boolean = false): Result<String> = safeCall {
        val isExistingDoc = !isNew && article.id.isNotBlank() &&
            !article.id.startsWith("art_temp_") &&
            !article.id.startsWith("draft_temp_") &&
            !article.id.startsWith("art_mock_")

        val nowIso = Instant.now().toString()
        if (isExistingDoc) {
            val payload = articleToMap(article) + mapOf("updatedAt" to nowIso)
            articlesCol.document(article.id).set(payload, SetOptions.merge()).await()
            article.id
        } else {
            val payload = articleToMap(article).toMutableMap()
            payload["viewsCount"] = article.viewsCount
            payload["likesCount"] = article.likesCount
            payload["sharesCount"] = article.sharesCount
            payload["commentsCount"] = article.commentsCount
            payload["purchasesCount"] = article.purchasesCount
            payload["rating"] = if (article.rating != 0.0) article.rating else 5.0
            payload["ratingsCount"] = article.ratingsCount
            payload["revenueFromAds"] = article.revenueFromAds
            payload["revenueFromSales"] = article.revenueFromSales
            payload["totalRevenue"] = article.totalRevenue
            payload["status"] = article.status.ifBlank { ArticleStatus.PUBLISHED }
            payload["publishedAt"] = if (article.status == ArticleStatus.DRAFT) "" else article.publishedAt.ifBlank { nowIso }
            payload["createdAt"] = nowIso
            payload["updatedAt"] = nowIso
            val docRef = articlesCol.add(payload).await()
            // Keep the document's own "id" field in sync with its Firestore doc id, matching source.
            docRef.update("id", docRef.id).await()
            docRef.id
        }
    }

    suspend fun updateArticleStats(articleId: String, stats: Map<String, Any>): Result<Unit> = safeCall {
        if (stats.isNotEmpty()) articlesCol.document(articleId).update(stats).await()
        Unit
    }

    suspend fun deleteArticle(articleId: String): Result<Unit> = safeCall {
        articlesCol.document(articleId).delete().await()
        Unit
    }

    /** Admin (or, per firestore.rules, the owning writer) status change — unpublish/archive/etc. */
    suspend fun setArticleStatus(articleId: String, status: String): Result<Unit> = safeCall {
        articlesCol.document(articleId).update("status", status).await()
        Unit
    }

    /** Atomic `viewsCount += 1` — never a client-computed absolute number (source's own rationale:
     *  two readers hitting the same article near-simultaneously would otherwise silently lose a view). */
    suspend fun incrementArticleView(articleId: String): Result<Unit> = safeCall {
        articlesCol.document(articleId).update("viewsCount", FieldValue.increment(1)).await()
        Unit
    }

    // ---- Likes ----

    fun observeArticleLikes(): Flow<List<ArticleLike>> = callbackFlow {
        val registration = likesCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { runCatching { it.toObject<ArticleLike>() }.getOrNull()?.copy(id = it.id) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    suspend fun likeArticle(articleId: String, userId: String): Result<Unit> = safeCall {
        val like = ArticleLike(articleId = articleId, userId = userId, createdAt = Instant.now().toString())
        likesCol.document("${articleId}_$userId").set(like).await()
        articlesCol.document(articleId).update("likesCount", FieldValue.increment(1)).await()
        Unit
    }

    suspend fun unlikeArticle(articleId: String, userId: String): Result<Unit> = safeCall {
        likesCol.document("${articleId}_$userId").delete().await()
        articlesCol.document(articleId).update("likesCount", FieldValue.increment(-1)).await()
        Unit
    }

    // ---- Reactions ----

    suspend fun setArticleReaction(articleId: String, userId: String, type: String): Result<Unit> = safeCall {
        val reaction = ArticleReaction(articleId = articleId, userId = userId, type = type, createdAt = Instant.now().toString())
        reactionsCol.document("${articleId}_$userId").set(reaction).await()
        Unit
    }

    suspend fun removeArticleReaction(articleId: String, userId: String): Result<Unit> = safeCall {
        reactionsCol.document("${articleId}_$userId").delete().await()
        Unit
    }

    /**
     * One-shot fetch of the current user's reaction, if any. Not a direct port of a named
     * `firestoreService.ts` function (no `subscribeToReactions` exists in source — the collection is
     * only ever read via `getDoc` at point of use), but uses only the read pattern firestore.rules
     * already allows (`reactions` is publicly readable) and is necessary for the UI to know the
     * current user's own reaction state.
     */
    suspend fun fetchUserReaction(articleId: String, userId: String): Result<ArticleReaction?> = safeCall {
        val snap = reactionsCol.document("${articleId}_$userId").get().await()
        if (snap.exists()) runCatching { snap.toObject<ArticleReaction>() }.getOrNull()?.copy(id = snap.id) else null
    }

    // ---- Ratings ----

    fun observeArticleRatings(): Flow<List<ArticleRating>> = callbackFlow {
        val registration = ratingsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { runCatching { it.toObject<ArticleRating>() }.getOrNull()?.copy(id = it.id) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    suspend fun rateArticle(articleId: String, userId: String, stars: Int): Result<Unit> = safeCall {
        require(stars in 1..5) { "التقييم يجب أن يكون بين 1 و5 نجوم." }
        val rating = ArticleRating(articleId = articleId, userId = userId, stars = stars.toLong(), createdAt = Instant.now().toString())
        ratingsCol.document("${articleId}_$userId").set(rating).await()
        Unit
    }

    /** Recomputes [Article.rating] from a precise running sum/count — never a guessed constant. Call
     *  after every rating add/edit with the up-to-date totals (typically derived from [observeArticleRatings]). */
    suspend fun syncArticleRatingSummary(articleId: String, ratingsSum: Double, ratingsCount: Int): Result<Unit> = safeCall {
        val avg = if (ratingsCount > 0) Math.round((ratingsSum / ratingsCount) * 100.0) / 100.0 else 0.0
        articlesCol.document(articleId).update(
            mapOf("ratingsSum" to ratingsSum, "ratingsCount" to ratingsCount, "rating" to avg)
        ).await()
        Unit
    }

    // ---- Purchases (read-only; writes are server-authoritative via /api/articles/unlock) ----

    /** Article ids the given buyer has actually unlocked. */
    fun observeArticlePurchases(buyerId: String): Flow<List<String>> = callbackFlow {
        val registration = purchasesCol.whereEqualTo("buyerId", buyerId).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { it.getString("articleId") }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    // ---- Comments ----

    fun observeComments(): Flow<List<Comment>> = callbackFlow {
        val registration = commentsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.mapNotNull { runCatching { it.toObject<Comment>() }.getOrNull()?.copy(id = it.id) }.orEmpty()
                .sortedByDescending { it.createdAt }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    suspend fun addComment(comment: Comment): Result<Unit> = safeCall {
        commentsCol.document(comment.id).set(comment).await()
        Unit
    }

    suspend fun addReplyToComment(commentId: String, reply: CommentReply): Result<Unit> = safeCall {
        commentsCol.document(commentId).update("replies", FieldValue.arrayUnion(reply)).await()
        Unit
    }

    /** firestore.rules already allows this (own comment or admin) — the actual delete action itself
     *  was never built on any client, web included. */
    suspend fun deleteComment(commentId: String): Result<Unit> = safeCall {
        commentsCol.document(commentId).delete().await()
        Unit
    }

    suspend fun toggleCommentLike(commentId: String, userId: String, isLiking: Boolean): Result<Unit> = safeCall {
        commentsCol.document(commentId).update(
            mapOf(
                "likesCount" to FieldValue.increment(if (isLiking) 1 else -1),
                "likedBy" to if (isLiking) FieldValue.arrayUnion(userId) else FieldValue.arrayRemove(userId)
            )
        ).await()
        Unit
    }

    // ---- internal mapping ----

    private fun toArticle(doc: com.google.firebase.firestore.DocumentSnapshot): Article? {
        val article = runCatching { doc.toObject<Article>() }.getOrNull() ?: return null
        // Defensive: prefer the live document id in case the "id" field write (a second call right
        // after creation, see saveArticle) hasn't landed yet.
        return article.copy(id = doc.id)
    }

    private fun articleToMap(article: Article): Map<String, Any?> = mapOf(
        "id" to article.id,
        "writerId" to article.writerId,
        "writerName" to article.writerName,
        "writerUsername" to article.writerUsername,
        "writerAvatar" to article.writerAvatar,
        "writerIsVerified" to article.writerIsVerified,
        "title" to article.title,
        "slug" to article.slug,
        "description" to article.description,
        "content" to article.content,
        "featuredImage" to article.featuredImage,
        "category" to article.category,
        "subCategory" to article.subCategory,
        "isLocked" to article.isLocked,
        "lockedPrice" to article.lockedPrice,
        "readingTimeMinutes" to article.readingTimeMinutes,
        "status" to article.status,
        "tags" to article.tags,
        "videoUrl" to article.videoUrl,
        "uploadedVideoUrl" to article.uploadedVideoUrl,
        "sourceUrl" to article.sourceUrl
    ).filterValues { it != null }
}
