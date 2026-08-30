package studio.ai.literium.literium_app.data.model

/**
 * Article document — collection `articles` (publicly readable; writer-owned
 * writes, see firestore.rules `match /articles/{articleId}`).
 *
 * Field-for-field port of `src/types.ts`'s `Article` interface. Note the
 * source field is `content` (rich HTML from the in-house editor), not
 * `body` — §10.4 of the spec paraphrases it as "body" but `types.ts` (the
 * ultimate ground truth per task instructions) uses `content`.
 */
data class Article(
    var id: String = "",
    var writerId: String = "",
    var writerName: String = "",
    var writerUsername: String = "",
    var writerAvatar: String = "",
    var writerIsVerified: Boolean = false,
    var title: String = "",
    var slug: String = "",
    var description: String = "",
    /** Rich HTML content from the in-house editor (not Markdown). */
    var content: String = "",
    var featuredImage: String = "",
    /** One of [ArticleCategory]'s constants. */
    var category: String = ArticleCategory.GENERAL,
    var subCategory: String? = null,
    var isLocked: Boolean = false,
    /** USD. Only meaningful when [isLocked]. */
    var lockedPrice: Double? = null,
    /** Client-computed convenience flag (from articlePurchases), never stored as-is server-side. */
    var isUnlockedByCurrentUser: Boolean? = null,
    var readingTimeMinutes: Long = 0,
    /** One of [ArticleStatus]'s constants. */
    var status: String = ArticleStatus.DRAFT,
    var viewsCount: Long = 0,
    var likesCount: Long = 0,
    var sharesCount: Long = 0,
    var commentsCount: Long = 0,
    var purchasesCount: Long = 0,
    var rating: Double = 0.0,
    var ratingsCount: Long = 0,
    /** Raw sum of all star ratings (not the average) — used to recompute [rating] precisely. */
    var ratingsSum: Double? = null,
    var revenueFromAds: Double = 0.0,
    var revenueFromSales: Double = 0.0,
    var totalRevenue: Double = 0.0,
    var publishedAt: String = "",
    var tags: List<String> = emptyList(),
    /** Embedded video link (YouTube/Vimeo) — never a direct file for article video. */
    var videoUrl: String? = null,
    /** Directly-uploaded video (hosted on Cloudinary), alternative to [videoUrl]. No duration cap
     *  (unlike ad-creative video, which is capped at 60s). */
    var uploadedVideoUrl: String? = null,
    /** Reference/source link shown as a citation inside the article (not an embed medium). */
    var sourceUrl: String? = null
)

/** The 15 supported categories + the generic fallback (spec §4.1). */
object ArticleCategory {
    const val LITERATURE = "literature"
    const val TECHNOLOGY = "technology"
    const val HISTORY = "history"
    const val PHILOSOPHY = "philosophy"
    const val BUSINESS = "business"
    const val SCIENCE = "science"
    const val HEALTH = "health"
    const val ARTS = "arts"
    const val POLITICS = "politics"
    const val EDUCATION = "education"
    const val BEAUTY_FASHION = "beauty_fashion"
    const val SPORTS = "sports"
    const val FOOD = "food"
    const val TRAVEL = "travel"
    const val FAMILY = "family"
    const val GENERAL = "general"

    val ALL = listOf(
        LITERATURE, TECHNOLOGY, HISTORY, PHILOSOPHY, BUSINESS, SCIENCE, HEALTH, ARTS,
        POLITICS, EDUCATION, BEAUTY_FASHION, SPORTS, FOOD, TRAVEL, FAMILY, GENERAL
    )
}

object ArticleStatus {
    const val DRAFT = "draft"
    const val PENDING = "pending"
    const val PUBLISHED = "published"
    const val REJECTED = "rejected"
    const val ARCHIVED = "archived"
}

/**
 * Independent per-(article, user) "did I like this" marker document —
 * collection `likes`, id `"{articleId}_{userId}"`. Exists because
 * [Article.likesCount] alone cannot answer "did the current user like this
 * specific article" — see `firestoreService.ts`'s `likes` section.
 */
data class ArticleLike(
    var id: String = "",
    var articleId: String = "",
    var userId: String = "",
    var createdAt: String = ""
)

/**
 * Reader emotional reaction (❤️ loved it / 💡 insightful / 😂 funny / ...) —
 * collection `reactions`, id `"{articleId}_{userId}"`.
 */
data class ArticleReaction(
    var id: String = "",
    var articleId: String = "",
    var userId: String = "",
    /** One of [ReactionType]'s constants. */
    var type: String = ReactionType.INSIGHTFUL,
    var createdAt: String = ""
)

object ReactionType {
    const val LOVE = "love"
    const val FUNNY = "funny"
    const val SURPRISED = "surprised"
    const val SAD = "sad"
    const val INSIGHTFUL = "insightful"
}

/**
 * 1-5 star rating — collection `ratings`, id `"{articleId}_{userId}"`.
 * [Article.rating]/[Article.ratingsCount]/[Article.ratingsSum] are kept in
 * sync separately (see `ArticleRepository.syncArticleRatingSummary`).
 */
data class ArticleRating(
    var id: String = "",
    var articleId: String = "",
    var userId: String = "",
    var stars: Long = 5,
    var createdAt: String = ""
)

/** A confirmed unlock of a locked article — collection `articlePurchases`, id `"{buyerId}_{articleId}"`,
 *  server-written only (via `POST /api/articles/unlock`), never a client write. */
data class ArticlePurchase(
    var id: String = "",
    var buyerId: String = "",
    var articleId: String = "",
    var writerId: String = "",
    var price: Double = 0.0,
    var purchasedAt: String = ""
)
