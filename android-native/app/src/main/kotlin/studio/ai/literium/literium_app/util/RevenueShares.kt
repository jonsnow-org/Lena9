package studio.ai.literium.literium_app.util

/**
 * Single source of truth for platform-vs-writer revenue splits. Ported
 * verbatim from `src/constants/revenueShares.ts`. Referenced live (not
 * hardcoded separately) from `PoliciesModal`, `LegalPages`,
 * `SmartAiGuidanceCard`, and `AdvertiserDashboard` in the web app — the
 * Kotlin app must likewise treat this object as the only place these
 * numbers live (spec §5.6/§12.2).
 */
object RevenueShares {

    data class Split(val writer: Double, val platform: Double, val writerPercent: Int, val platformPercent: Int, val label: String)

    /** Ads embedded inside a writer's own article: 55% writer / 45% platform. */
    val IN_ARTICLE_ADS = Split(0.55, 0.45, 55, 45, "55% للكاتب / 45% للمنصة")

    /** Ads shown on a writer's own profile page: 50% writer / 50% platform. */
    val WRITER_PROFILE_ADS = Split(0.50, 0.50, 50, 50, "50% للكاتب / 50% للمنصة")

    /** Locked/exclusive article direct-purchase sales: 85% writer / 15% platform. */
    val LOCKED_ARTICLES = Split(0.85, 0.15, 85, 15, "85% للكاتب / 15% للمنصة")

    /** Platform-wide ads (homepage, category pages, other platform-owned surfaces): 100% platform / 0% writer. */
    val PLATFORM_ADS = Split(0.00, 1.00, 0, 100, "100% للمنصة")

    /** Blended default AdSense writer/platform split used for in-article estimates. */
    val DEFAULT_WRITER_ADSENSE_SHARE = IN_ARTICLE_ADS.writer
    val DEFAULT_PLATFORM_ADSENSE_SHARE = IN_ARTICLE_ADS.platform
    val DEFAULT_WRITER_SALES_SHARE = LOCKED_ARTICLES.writer
    val DEFAULT_PLATFORM_SALES_SHARE = LOCKED_ARTICLES.platform

    /** Looks up the [Split] for a given [studio.ai.literium.literium_app.data.model.AdSlotId] by its beneficiary/share pair,
     *  matching `AdSlot.tsx`'s `SLOT_CONFIG` (writer slots pay 55% except the two writer-profile slots, which pay 50%). */
    fun splitForWriterSlot(writerShare: Double): Split = when (writerShare) {
        0.55 -> IN_ARTICLE_ADS
        0.50 -> WRITER_PROFILE_ADS
        else -> PLATFORM_ADS
    }
}
