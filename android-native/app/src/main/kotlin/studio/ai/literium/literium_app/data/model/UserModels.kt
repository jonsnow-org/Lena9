package studio.ai.literium.literium_app.data.model

/**
 * Literium user document — collection `users` (readable by anyone, see
 * firestore.rules `match /users/{userId}`).
 *
 * Field-for-field port of `src/types.ts`'s `User` interface (verified against
 * `src/types.ts`, `src/firebase.ts` and `src/services/firestoreService.ts`).
 *
 * ⚠️ Deliberately named/typed to avoid the exact mistakes flagged in the
 * spec: this is `fullName` (NOT `displayName`), `avatarUrl` (NOT `avatar`),
 * and there is NO `kycStatus` field — KYC state lives only in
 * [isKycVerified] + [kycDetails.status] (see spec §10.3). Both signals must
 * be OR'd together when checking verification, exactly like
 * `creatorEligibility.ts:58` does — see [studio.ai.literium.literium_app.util.CreatorEligibility].
 *
 * Design note: union-typed string fields on the TS side (`role`, article
 * `status`/`category`, campaign `status`, etc.) are modeled here as plain
 * [String] rather than a Kotlin `enum class`. This is a deliberate judgment
 * call: Firestore's POJO reflection mapping will throw/drop the whole
 * document if an enum field holds a value with no matching constant (e.g. a
 * legacy or future value), whereas a plain String degrades gracefully — and
 * the web app itself treats these as loose string unions, not a closed set
 * enforced by the datastore. Constants for every known value are provided
 * in the companion objects alongside each field (e.g. [UserRole]) so call
 * sites still get compile-time-checked constants without the crash risk.
 *
 * The four wallet fields ([walletBalance], [pendingEarnings],
 * [availableBalance], [lifetimeEarnings]) are intentionally nullable, per
 * spec §10.3 / `types.ts:88-94` — they are optional on the TS type even
 * though a fresh registration always populates them with 0. Do not treat a
 * null here as an error; treat it as "unknown / not yet populated."
 */
data class User(
    var id: String = "",
    var email: String = "",
    var phone: String? = null,
    var fullName: String = "",
    var username: String = "",
    var avatarUrl: String = "",
    var coverUrl: String? = null,
    /** One of [UserRole]'s constants. Does NOT gate capabilities — see spec §1.3. */
    var role: String = UserRole.READER,
    var bio: String? = null,
    /** Blue-checkmark style verification — distinct from KYC identity verification. */
    var isVerified: Boolean? = null,
    var isKycVerified: Boolean? = null,
    var isBanned: Boolean? = null,
    var kycDetails: KycDetails? = null,
    var aiQuota: AiQuota? = null,
    var socialLinks: SocialLinks? = null,
    var specialties: List<String>? = null,
    var badges: List<UserBadge>? = null,
    var rating: Double? = null,
    var followersCount: Long = 0,
    var followingCount: Long = 0,
    var articlesCount: Long? = null,
    var totalViews: Long? = null,
    var totalEarnings: Double? = null,
    var monthlyEarnings: Double? = null,
    /** Spendable, deposit-funded balance. Optional — see class doc. */
    var walletBalance: Double? = null,
    /** Earnings that cleared the 30-day hold; withdrawable. Optional — see class doc. */
    var availableBalance: Double? = null,
    /** Earnings still inside the 30-day hold; not withdrawable. Optional — see class doc. */
    var pendingEarnings: Double? = null,
    /** Cumulative all-time earnings stat; monotonically increasing, never spendable. Optional — see class doc. */
    var lifetimeEarnings: Double? = null,
    /** Lifetime (not daily) free AI image count consumed — server-authoritative only. */
    var freeImagesUsedTotal: Long? = null,
    /** Human-formatted join date for display only (e.g. "مارس 2024") — never for date math. */
    var joinedDate: String? = null,
    /** Raw ISO account-creation timestamp — use this (not [joinedDate]) for account-age math. */
    var createdAt: String? = null,
    var twoFactorEnabled: Boolean? = null,
    var notificationsEnabled: Boolean? = null,
    var penName: String? = null,
    var companyName: String? = null,
    var companyIndustry: String? = null,
    var companyWebsite: String? = null,
    var advertisingGoal: String? = null,
    var presence: Presence? = null,
    /** Users who have blocked THIS user — prevents them from messaging this account. */
    var blockedUserIds: List<String>? = null,
    /** Users THIS user has muted — does not block receipt, only silences badges/alerts locally. */
    var mutedUserIds: List<String>? = null,
    /** True only for the 8 fixed publishing-bot personas. Always excluded from monetization. */
    var isBot: Boolean? = null,
    /** Stripe Connect Express account id for automated payouts — server-written only. */
    var stripeConnectedAccountId: String? = null
)

/** Known values for [User.role]. Does not gate capabilities — spec §1.3/§1.3a. */
object UserRole {
    const val READER = "reader"
    const val WRITER = "writer"
    const val ADVERTISER = "advertiser"
    const val ADMIN = "admin"

    /** Roles a user may self-assign via the role-switch UI (spec §1.3a). Never ADMIN. */
    val SELF_ASSIGNABLE = setOf(READER, WRITER, ADVERTISER)
}

/**
 * KYC identity-verification sub-document on [User.kycDetails].
 * Note the not-yet-started value is literally `"none"`, not `"not_started"`.
 */
data class KycDetails(
    var idType: String = "",
    var idNumber: String = "",
    var selfieUrl: String? = null,
    var status: String = KycStatus.NONE,
    var submittedAt: String? = null
)

object KycStatus {
    const val NONE = "none"
    const val PENDING = "pending"
    const val VERIFIED = "verified"
    const val REJECTED = "rejected"
}

/**
 * AI feature usage quota. See spec §10.12/§12.5 — the daily chat quota and
 * subscriber daily image bonus are server-side, in-memory only (reset on
 * server restart); only the *lifetime* free-image count
 * ([User.freeImagesUsedTotal]) is persisted in Firestore.
 */
data class AiQuota(
    /** Default 10. */
    var freeDailyLimit: Long = 10,
    var usedToday: Long = 0,
    /** ISO string. */
    var lastResetTime: String = "",
    var isSubscriber: Boolean = false,
    var plan: String = AiPlanType.NONE,
    /** -1 for unlimited, or a custom number. */
    var planLimit: Long? = null,
    var planExpiresAt: String? = null
)

object AiPlanType {
    const val NONE = "none"
    const val MONTHLY = "monthly"
    const val ANNUAL = "annual"
}

data class SocialLinks(
    var website: String? = null,
    var twitter: String? = null,
    var instagram: String? = null,
    var linkedin: String? = null,
    var facebook: String? = null,
    var youtube: String? = null,
    var whatsapp: String? = null,
    var telegram: String? = null
)

data class UserBadge(
    var id: String = "",
    var name: String = "",
    var icon: String = "",
    var color: String = "",
    var description: String = ""
)

/**
 * Presence sub-document. Written only from the owning session itself (a
 * periodic heartbeat, spec §12.7): "online now" is derived client-side by
 * checking whether [lastHeartbeatAt] is fresher than the 60s staleness
 * window — see [studio.ai.literium.literium_app.util.PresenceRules].
 */
data class Presence(
    var state: String = PresenceState.OFFLINE,
    var lastHeartbeatAt: String? = null,
    var lastSeenAt: String? = null
)

object PresenceState {
    const val ONLINE = "online"
    const val OFFLINE = "offline"
}

/** Not a Firestore document — a static catalog rendered by `SubscriptionModal` (spec §4.13). */
data class SubscriptionPlan(
    /** "monthly" | "annual" */
    val id: String,
    val name: String,
    val nameEn: String,
    /** USD. */
    val price: Double,
    val periodLabel: String,
    val badge: String? = null,
    val aiLimitLabel: String,
    val features: List<String>,
    val popular: Boolean = false
)
