package studio.ai.literium.literium_app.util

import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticleStatus
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import java.time.Instant
import java.time.format.DateTimeParseException

/**
 * Creator/monetization eligibility gate. Exact port of
 * `src/utils/creatorEligibility.ts` — every threshold, the KYC OR-check,
 * and the bot/admin exceptions are ported verbatim (spec §12.4).
 *
 * Writing, publishing, and every other capability remain available to
 * every account regardless of this gate (spec §1.3) — this only controls
 * whether ad/locked-article revenue is actually *credited*.
 */
object CreatorEligibility {

    /** `CREATOR_ELIGIBILITY_THRESHOLDS` from `creatorEligibility.ts`. */
    const val MIN_FOLLOWERS = 100
    const val MIN_VALID_VIEWS = 1000
    const val MIN_ACCOUNT_AGE_DAYS = 14
    const val MIN_PUBLISHED_ARTICLES = 3

    data class Status(
        val isEligible: Boolean,
        val isKycVerified: Boolean,
        val accountAgeDays: Int,
        val publishedArticlesCount: Int,
        val validViewsCount: Long,
        val followersCount: Int,
        val meetsFollowers: Boolean,
        val meetsViews: Boolean,
        val meetsAge: Boolean,
        val meetsArticles: Boolean,
        val meetsAllActivityThresholds: Boolean
    )

    /** Account age in whole days from an ISO-8601 `createdAt` string. Returns 0 for null/unparseable input. */
    fun getAccountAgeDays(createdAt: String?): Int {
        if (createdAt.isNullOrBlank()) return 0
        val createdMillis = try {
            Instant.parse(createdAt).toEpochMilli()
        } catch (e: DateTimeParseException) {
            return 0
        }
        val days = (System.currentTimeMillis() - createdMillis) / (1000L * 60 * 60 * 24)
        return days.coerceAtLeast(0).toInt()
    }

    /**
     * Computes the full eligibility status for [user].
     *
     * @param articles ALL articles visible to the caller (or at least all of [user]'s own) — filtered
     *   internally to this user's own [ArticleStatus.PUBLISHED] articles, matching source exactly.
     * @param followersCountOverride the REAL follower count computed from the `follows` collection.
     *   Pass this whenever real follow data is available — [User.followersCount] is a denormalized
     *   counter that is never actually updated by any code path in the source app and so is unusable
     *   alone for this check; it is only a last-resort fallback when the override is unavailable.
     */
    fun getCreatorEligibility(
        user: User,
        articles: List<Article>,
        followersCountOverride: Int? = null
    ): Status {
        val followersCount = followersCountOverride ?: user.followersCount.toInt()
        val ownPublished = articles.filter { it.writerId == user.id && it.status == ArticleStatus.PUBLISHED }
        val validViewsCount = ownPublished.sumOf { it.viewsCount }
        val accountAgeDays = getAccountAgeDays(user.createdAt)
        val isKycVerified = (user.isKycVerified == true) || (user.kycDetails?.status == "verified")

        val meetsFollowers = followersCount >= MIN_FOLLOWERS
        val meetsViews = validViewsCount >= MIN_VALID_VIEWS
        val meetsAge = accountAgeDays >= MIN_ACCOUNT_AGE_DAYS
        val meetsArticles = ownPublished.size >= MIN_PUBLISHED_ARTICLES
        val meetsAllActivityThresholds = meetsFollowers && meetsViews && meetsAge && meetsArticles

        return Status(
            // KYC is a mandatory final gate — meeting the 4 activity thresholds alone is not enough.
            isEligible = meetsAllActivityThresholds && isKycVerified,
            isKycVerified = isKycVerified,
            accountAgeDays = accountAgeDays,
            publishedArticlesCount = ownPublished.size,
            validViewsCount = validViewsCount,
            followersCount = followersCount,
            meetsFollowers = meetsFollowers,
            meetsViews = meetsViews,
            meetsAge = meetsAge,
            meetsArticles = meetsArticles,
            meetsAllActivityThresholds = meetsAllActivityThresholds
        )
    }

    /**
     * Used at the actual revenue-crediting points (ad events, locked-article sales) before adding any
     * amount to a writer's pending balance.
     */
    fun isEligibleForMonetization(
        user: User?,
        articles: List<Article>,
        followersCountOverride: Int? = null
    ): Boolean {
        if (user == null) return false
        // Bot accounts are permanently excluded from any revenue, regardless of how their stats look —
        // this check deliberately precedes even the admin bypass below.
        if (user.isBot == true) return false
        if (user.role == UserRole.ADMIN) return true
        return getCreatorEligibility(user, articles, followersCountOverride).isEligible
    }

    /**
     * The single canonical "member status" label shown next to a username everywhere (profile, drawer,
     * another writer's profile page). Only two labels exist for non-admin accounts — "reader" by
     * default, auto-upgrading to "writer" only once full monetization eligibility (stats + KYC) is
     * met. Deliberately ignores the stored `role`/persona value — see `getMemberStatusLabel` in source.
     */
    fun getMemberStatusLabel(role: String, isMonetizationEligible: Boolean): String {
        if (role == UserRole.ADMIN) return "مالك المنصة"
        return if (isMonetizationEligible) "كاتب" else "قارئ مسجل"
    }
}
