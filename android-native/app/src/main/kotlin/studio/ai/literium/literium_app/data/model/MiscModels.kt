package studio.ai.literium.literium_app.data.model

/**
 * Follow relationship — collection `follows`, id is always
 * `"{followerId}_{followingId}"` (enforced by firestore.rules on create).
 * This is the real source of truth for follower/following counts — the
 * eligibility gate recomputes from this collection rather than trusting
 * [User.followersCount], per spec §12.4 / `creatorEligibility.ts`.
 */
data class Follow(
    var id: String = "",
    var followerId: String = "",
    var followingId: String = "",
    var createdAt: String = ""
)

/**
 * A writer's self-service request to boost visibility of one already-
 * published article — collection `promotions`. Distinct from [studio.ai.literium.literium_app.data.model.AdCampaign]
 * (spec §4.12/§10.10). Financial deduction happens only via admin approval,
 * never a client-side balance write.
 */
data class ArticlePromotion(
    var id: String = "",
    var articleId: String = "",
    var articleTitle: String? = null,
    var writerId: String = "",
    var writerName: String? = null,
    var durationHours: Long = 0,
    /** One of [PromotionPricingModel]'s constants. */
    var pricingModel: String = PromotionPricingModel.FIXED,
    var cost: Double = 0.0,
    /** One of [PromotionStatus]'s constants. */
    var status: String = PromotionStatus.PENDING,
    var adminNote: String? = null,
    var createdAt: String = "",
    var reviewedAt: String? = null,
    var impressionsCount: Long = 0,
    var clicksCount: Long = 0
)

object PromotionPricingModel {
    const val FIXED = "fixed"
    const val CPC = "cpc"
}

object PromotionStatus {
    const val PENDING = "pending"
    const val APPROVED = "approved"
    const val REJECTED = "rejected"
    const val EXPIRED = "expired"
}

/**
 * Platform-wide KPI snapshot shape from `types.ts`'s `PlatformStats`
 * interface. Not backed by one single Firestore document in
 * `firestoreService.ts` — `AdminOverviewTab` instead computes these figures
 * live from the loaded collections (users/articles/campaigns/requests), so
 * this type is primarily useful as a target shape for that client-side
 * aggregation rather than something read directly off a document.
 */
data class PlatformStats(
    var totalUsers: Long = 0,
    var activeReaders: Long = 0,
    var activeWriters: Long = 0,
    var activeAdvertisers: Long = 0,
    var totalArticles: Long = 0,
    var totalViews: Long = 0,
    var totalPlatformRevenue: Double = 0.0,
    var adsenseCpmBase: Double = 0.0,
    var admobCpmBase: Double? = null,
    var dynamicAdInflationFactor: Double = 1.0
)

/** The single global theme document — `settings/theme`. Public read, admin-only write. */
data class ThemeSettingsData(
    var preset: String? = null,
    var backgroundPreset: String? = null
)

/** Publishing-bot activity log entry — collection `botActivityLog`, admin-read-only, server-written only. */
data class BotActivityLogEntry(
    var id: String = "",
    /** "article" | "tweet" | "like" | "comment" */
    var type: String = "article",
    var botId: String = "",
    var botName: String = "",
    var targetId: String = "",
    /** "article" | "tweet" */
    var targetType: String = "article",
    var summary: String = "",
    var createdAt: String = ""
)

/** A piece of content published by a bot account — surfaced for the admin Bots tab (spec §4.28). */
data class BotPublishedItem(
    var id: String = "",
    /** "article" | "tweet" */
    var type: String = "article",
    var title: String = "",
    var createdAt: String = ""
)
