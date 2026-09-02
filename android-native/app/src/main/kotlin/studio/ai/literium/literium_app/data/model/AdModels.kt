package studio.ai.literium.literium_app.data.model

/**
 * Ad campaign document — collection `campaigns` (publicly readable;
 * advertiser-owned writes gated by firestore.rules). Any registered account
 * can create one — there is no separate "advertiser" account type (spec §1.3).
 *
 * Field-for-field port of `src/types.ts`'s `AdCampaign` interface.
 */
data class AdCampaign(
    var id: String = "",
    var advertiserId: String = "",
    var advertiserName: String = "",
    var campaignName: String = "",
    var description: String = "",
    var imageUrl: String = "",
    var destinationUrl: String = "",
    /** One of [CampaignType]'s constants. */
    var type: String = CampaignType.FIXED,
    /** One of [PricingModel]'s constants. */
    var pricingModel: String = PricingModel.FIXED,
    /** One of [AdPlacementType]'s constants. */
    var placementType: String? = null,
    var adText: String = "",
    /** One of [CampaignStatus]'s constants. */
    var status: String = CampaignStatus.PENDING,
    /** 24, 48, 72, or 168 (7 days) hours. */
    var durationHours: Long? = null,
    var startDate: String = "",
    var endDate: String = "",
    var impressionsCount: Long = 0,
    var validImpressionsCount: Long? = null,
    var clicksCount: Long = 0,
    var validClicksCount: Long? = null,
    var conversionsCount: Long = 0,
    var totalSpent: Double = 0.0,
    var totalBudget: Double = 0.0,
    /** Budget requested at creation — becomes [totalBudget] only once approved/funded; 0 until then. */
    var requestedBudget: Double? = null,
    var cpcRate: Double? = null,
    var cpmRate: Double? = null,
    var fixedRate: Double? = null,
    /** 0-100. */
    var fraudShieldScore: Double? = null,
    var blockedFraudClicks: Long? = null,
    var targetCategories: List<String> = emptyList(),
    var targetCountries: List<String> = emptyList(),
    /** One of [AntiFraudLevel]'s constants. */
    var antiFraudLevel: String? = null,
    /** Ad-creative embedded video link (YouTube/Vimeo) — recommended ≤60s. */
    var videoUrl: String? = null,
    /** Directly-uploaded ad-creative video (Cloudinary), alternative to [videoUrl]. */
    var uploadedVideoUrl: String? = null,
    /** One of [PromotionKind]'s constants. Default "website" = a normal campaign. */
    var promotionKind: String? = null,
    /** Count of real verified follow-throughs (Telegram join / YouTube subscribe) rewarded from this campaign's budget. */
    var verifiedActionsCount: Long? = null
)

object CampaignType {
    const val FIXED = "fixed"
    const val CPM = "cpm"
    const val CPC = "cpc"
    const val IMPRESSION = "impression"
}

object PricingModel {
    const val FIXED = "fixed"
    const val CPM = "cpm"
    const val CPC = "cpc"
}

object AdPlacementType {
    const val PLATFORM = "platform"
    const val WRITER = "writer"
    const val CATEGORY_SPONSOR = "category_sponsor"
}

object CampaignStatus {
    const val ACTIVE = "active"
    const val PENDING = "pending"
    const val PAUSED = "paused"
    const val COMPLETED = "completed"
    const val REJECTED = "rejected"
}

object AntiFraudLevel {
    const val BASIC = "basic"
    const val ENHANCED_VIEWABILITY = "enhanced_viewability"
    const val MAXIMUM_CPC_SHIELD = "maximum_cpc_shield"
}

/**
 * `'website'` = a normal ad campaign (the default). Any other value = a
 * social-channel follow-promotion campaign, where [AdCampaign.destinationUrl]
 * becomes the channel/account URL itself instead of a generic landing page
 * (spec §4.11/§4.11a).
 */
object PromotionKind {
    const val WEBSITE = "website"
    const val YOUTUBE = "youtube"
    const val TELEGRAM = "telegram"
    const val INSTAGRAM = "instagram"
    const val TWITTER = "twitter"
    const val FACEBOOK = "facebook"
}

/**
 * Fraud-detection record — collection `fraudFlags`, admin-read-only.
 * Raised by either the client-side [studio.ai.literium.literium_app.util.AntiFraudEngine]
 * or the (also client-side, admin-run) `evaluateAdEventBatch` pass (spec §5.7/§11.9).
 */
data class FraudFlag(
    var id: String = "",
    var campaignId: String? = null,
    var campaignName: String? = null,
    var articleId: String? = null,
    var articleTitle: String? = null,
    var writerId: String? = null,
    var writerName: String? = null,
    var userId: String? = null,
    var userIp: String = "",
    /** One of [PricingModel]'s constants. */
    var pricingModel: String = PricingModel.CPC,
    /** One of [FraudTriggerType]'s constants. */
    var triggerType: String = FraudTriggerType.SELF_CLICK,
    /** One of [FraudSeverity]'s constants. */
    var severity: String = FraudSeverity.LOW,
    /** One of [FraudFlagStatus]'s constants. */
    var status: String = FraudFlagStatus.FLAGGED,
    var detectedAt: String = "",
    var details: String = "",
    var mitigationAction: String = "",
    var revenueBlocked: Double = 0.0
)

object FraudTriggerType {
    const val SELF_CLICK = "self_click"
    const val RAPID_REFRESH = "rapid_refresh"
    const val INSUFFICIENT_DWELL = "insufficient_dwell"
    const val BOT_PATTERN = "bot_pattern"
    const val CLICK_THROTTLE = "click_throttle"
    const val ABNORMAL_CTR = "abnormal_ctr"
}

object FraudSeverity {
    const val LOW = "low"
    const val MEDIUM = "medium"
    const val HIGH = "high"
    const val CRITICAL = "critical"
}

object FraudFlagStatus {
    const val FLAGGED = "flagged"
    const val AUTO_BLOCKED = "auto_blocked"
    const val REVIEWED = "reviewed"
    const val DISMISSED = "dismissed"
}

/**
 * Raw impression/click log entry — collection `adEvents`. Logged
 * unconditionally with `processed = false`; actual revenue crediting only
 * happens later via the admin Finance tab's batch-processing pass (spec
 * §4.22/§11.9), never automatically at log time.
 */
data class AdEvent(
    var id: String = "",
    var campaignId: String? = null,
    var promotionId: String? = null,
    /** One of the 13 [AdSlotId] constants, or a free-text ticker-bar tag (spec §5.1a). */
    var slotId: String = "",
    var articleId: String? = null,
    var writerId: String? = null,
    var viewerId: String? = null,
    /** "impression" | "click" */
    var eventType: String = AdEventType.IMPRESSION,
    var processed: Boolean = false,
    /** انظر تعليق `DirectMessage.isRead` في `MessageModels.kt` — بلا هذا التوصيف تُقرأ القيمة `null`
     *  دائماً (بصرف النظر عمّا كتبه `processAdEvent`) لأن Firestore يشتق اسم الحقل المتوقَّع من
     *  `isValid()` بحذف `is` (=> `valid`)، بينما الحقل الحقيقي المكتوب حرفياً هو `"isValid"` — علّة كانت
     *  ستُبطل منطق كشف الاحتيال/احتساب الأرباح كاملاً كلما أُعيدت قراءة السجل بعد معالجته. */
    @get:PropertyName("isValid") @set:PropertyName("isValid")
    var isValid: Boolean? = null,
    /** True = a viewability-qualified impression on an *external* ad-network fill in a writer slot. */
    @get:PropertyName("isExternalAdView") @set:PropertyName("isExternalAdView")
    var isExternalAdView: Boolean? = null,
    var createdAt: String = ""
)

object AdEventType {
    const val IMPRESSION = "impression"
    const val CLICK = "click"
}

/**
 * The 13 named ad-slot positions (spec §5.1), verified directly against
 * `src/components/AdSlot.tsx`'s `AdSlotId` union + `SLOT_CONFIG` table
 * (the spec itself only names 2 of the 13 explicitly, so this list and the
 * beneficiary/share data in [AdSlotConfig.BY_SLOT] were pulled from source,
 * not inferred).
 */
object AdSlotId {
    const val HOME_HERO = "home_hero"
    const val HOME_FEED_1 = "home_feed_1"
    const val HOME_FEED_2 = "home_feed_2"
    const val CATEGORY_BANNER = "category_banner"
    const val CATEGORY_FEED = "category_feed"
    const val ARTICLE_TOP = "article_top"
    const val ARTICLE_MID = "article_mid"
    const val ARTICLE_BOTTOM = "article_bottom"
    const val WRITER_PROFILE_TOP = "writer_profile_top"
    const val WRITER_PROFILE_FEED = "writer_profile_feed"
    const val READER_PROFILE = "reader_profile"
    const val COMMENTS_FEED = "comments_feed"
    const val TWEET_FEED = "tweet_feed"

    /** The 13 formal placements from `AdSlot.tsx`'s `SLOT_CONFIG` — deliberately does NOT include
     *  [MESSAGES_LIST] (see its own doc) since that one is never a `<AdSlot>` placement in source. */
    val ALL = listOf(
        HOME_HERO, HOME_FEED_1, HOME_FEED_2, CATEGORY_BANNER, CATEGORY_FEED,
        ARTICLE_TOP, ARTICLE_MID, ARTICLE_BOTTOM, WRITER_PROFILE_TOP, WRITER_PROFILE_FEED,
        READER_PROFILE, COMMENTS_FEED, TWEET_FEED
    )

    /**
     * NOT one of the 13 formal [AdSlot.tsx] placements above — this is the free-text tag
     * `AdTickerBar.tsx` (a separate, lighter rotating-ticker component, not `<AdSlot>`) is given at
     * `DirectMessagesModal.tsx:519` (`<AdTickerBar slotId="messages_list" .../>`), shown ONLY above the
     * conversation list, NEVER inside an open chat thread. Kept here (not in [ALL]) purely so call
     * sites never hand-type the raw string; the [studio.ai.literium.literium_app.data.model.AdEvent.slotId]
     * doc already anticipates this ("or a free-text ticker-bar tag").
     */
    const val MESSAGES_LIST = "messages_list"
}

/** Who financially benefits from a fill in a given slot. */
object AdSlotBeneficiary {
    const val PLATFORM = "platform"
    const val WRITER = "writer"
}

/** Static per-slot configuration, ported verbatim from `AdSlot.tsx`'s `SLOT_CONFIG`. */
data class AdSlotConfig(
    val beneficiary: String,
    val writerShare: Double,
    /** True: slot only accepts internally-sold Literium campaigns paired with `category_sponsor` placement. */
    val sponsorOnly: Boolean = false,
    /** True (writer slots only): an internal campaign is shown first, external network is fallback only. */
    val internalPriority: Boolean = false
) {
    companion object {
        val BY_SLOT: Map<String, AdSlotConfig> = mapOf(
            AdSlotId.HOME_HERO to AdSlotConfig(AdSlotBeneficiary.PLATFORM, 0.0),
            AdSlotId.HOME_FEED_1 to AdSlotConfig(AdSlotBeneficiary.PLATFORM, 0.0),
            AdSlotId.HOME_FEED_2 to AdSlotConfig(AdSlotBeneficiary.PLATFORM, 0.0),
            AdSlotId.CATEGORY_BANNER to AdSlotConfig(AdSlotBeneficiary.PLATFORM, 0.0, sponsorOnly = true),
            AdSlotId.CATEGORY_FEED to AdSlotConfig(AdSlotBeneficiary.PLATFORM, 0.0),
            AdSlotId.ARTICLE_TOP to AdSlotConfig(AdSlotBeneficiary.WRITER, 0.55, internalPriority = true),
            AdSlotId.ARTICLE_MID to AdSlotConfig(AdSlotBeneficiary.WRITER, 0.55, internalPriority = true),
            AdSlotId.ARTICLE_BOTTOM to AdSlotConfig(AdSlotBeneficiary.WRITER, 0.55, internalPriority = true),
            AdSlotId.WRITER_PROFILE_TOP to AdSlotConfig(AdSlotBeneficiary.WRITER, 0.5, internalPriority = true),
            AdSlotId.WRITER_PROFILE_FEED to AdSlotConfig(AdSlotBeneficiary.WRITER, 0.5, internalPriority = true),
            AdSlotId.READER_PROFILE to AdSlotConfig(AdSlotBeneficiary.PLATFORM, 0.0),
            AdSlotId.COMMENTS_FEED to AdSlotConfig(AdSlotBeneficiary.WRITER, 0.55, internalPriority = true),
            AdSlotId.TWEET_FEED to AdSlotConfig(AdSlotBeneficiary.PLATFORM, 0.0)
        )
    }
}
