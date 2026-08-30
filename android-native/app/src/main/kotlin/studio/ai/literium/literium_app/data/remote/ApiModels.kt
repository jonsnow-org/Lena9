package studio.ai.literium.literium_app.data.remote

import kotlinx.serialization.Serializable

/**
 * Request/response DTOs for every `server.ts` REST endpoint (spec §11),
 * ported field-for-field from the actual `req.body`/`res.json(...)` shapes
 * read directly out of `server.ts`. Grouped in one file since each shape is
 * small and each is used by exactly one [LiteriumApiService] method.
 *
 * Auth model (important, and NOT uniform across endpoints — ported exactly
 * as the source implements it, not idealized): endpoints that call
 * `verifyRequestAuth(req.headers.authorization)` server-side (unlock,
 * campaign review, analytics summary, all `/api/payments/*`,
 * `/api/media/upload`, `/api/kyc/*`, `/api/social/verify-*`,
 * `/api/ai/generate-image`) derive the caller's uid from a real Firebase ID
 * token and take an `Authorization: Bearer <idToken>` header — those
 * methods below take an explicit `authorization` parameter. The AI
 * chat/writing-assistant/SEO endpoints and `/api/analytics/track-visit`, by
 * contrast, trust a plain `userId` field in the JSON body instead of a
 * verified token — this is a genuine (if questionable) property of the
 * live server, faithfully preserved rather than "fixed" here.
 */

// ---- Health ----

@Serializable
data class HealthResponse(
    val status: String = "",
    val app: String = "",
    val version: String = "",
    val timestamp: String = ""
)

// ---- AI: chat ----

@Serializable
data class AiChatRequest(
    val prompt: String,
    val userRole: String? = null,
    val language: String? = null,
    val userId: String? = null,
    val isSubscriber: Boolean? = null,
    val plan: String? = null
)

@Serializable
data class AiChatResponse(
    val reply: String = "",
    val remainingUses: Int = 0
)

// ---- AI: image generation ----

@Serializable
data class AiGenerateImageRequest(
    val prompt: String,
    val style: String? = null,
    /** One of "1:1","3:4","4:3","9:16","16:9". Server defaults to "16:9" if omitted/invalid. */
    val aspectRatio: String = "16:9"
)

@Serializable
data class AiGenerateImageResponse(
    val success: Boolean = false,
    val imageUrl: String? = null,
    /** False when a curated stock-photo fallback was served instead of a real Gemini generation
     *  (Gemini unavailable/failed) — no charge and no quota consumption happened in that case. */
    val isAiGenerated: Boolean = false,
    val charged: Boolean = false,
    val cost: Double = 0.0,
    val remainingFreeUses: Int = 0,
    val newBalance: Double? = null,
    val message: String? = null
)

// ---- AI: writing assistant (article editor's 7 tools) ----

@Serializable
data class AiWritingAssistantRequest(
    /** One of: suggest_titles, generate_paragraph, improve_style, fix_grammar, summarize_article
     *  (or "summarize"), suggest_categories, summarize_tags, generate_outline. */
    val action: String,
    val text: String? = null,
    val title: String? = null,
    val category: String? = null,
    val userId: String? = null,
    val isSubscriber: Boolean? = null,
    val plan: String? = null
)

@Serializable
data class AiWritingAssistantResponse(
    val result: String = "",
    val remainingUses: Int = 0
)

// ---- AI: SEO generator ----

@Serializable
data class AiSeoGeneratorRequest(
    val title: String? = null,
    val content: String? = null,
    val category: String? = null,
    val userId: String? = null,
    val isSubscriber: Boolean? = null,
    val plan: String? = null
)

@Serializable
data class AiSeoGeneratorResponse(
    val tags: List<String> = emptyList(),
    val metaDescription: String = "",
    val suggestedCategory: String = "",
    val remainingUses: Int = 0
)

// ---- Articles: unlock (locked-article purchase) ----

@Serializable
data class UnlockArticleRequest(val articleId: String)

@Serializable
data class UnlockArticleResponse(
    val success: Boolean = false,
    val alreadyUnlocked: Boolean = false,
    val price: Double = 0.0,
    val newBalance: Double? = null
)

// ---- Campaigns: admin review ----

@Serializable
data class CampaignReviewRequest(
    /** "approve" | "reject" */
    val decision: String
)

@Serializable
data class CampaignReviewResponse(
    val success: Boolean = false,
    val decision: String = ""
)

// ---- Analytics ----

@Serializable
data class TrackVisitRequest(
    val sessionId: String,
    val path: String,
    val pageTitle: String? = null,
    /** "mobile" | "tablet" | "desktop" */
    val device: String? = null,
    val browser: String? = null,
    val userId: String? = null
)

@Serializable
data class TrackVisitResponse(val ok: Boolean = false)

@Serializable
data class AnalyticsDeviceBreakdown(
    val mobile: Int = 0,
    val desktop: Int = 0,
    val tablet: Int = 0
)

@Serializable
data class AnalyticsHourlyBucket(
    val hour: String = "",
    val views: Int = 0,
    val visitors: Int = 0
)

@Serializable
data class AnalyticsRecentVisit(
    val id: String = "",
    val path: String? = null,
    val pageTitle: String? = null,
    val isRegistered: Boolean? = null,
    val device: String? = null,
    val browser: String? = null,
    val timestamp: String? = null
)

@Serializable
data class AnalyticsSummaryResponse(
    val totalVisitors: Int = 0,
    val visitorsToday: Int = 0,
    val visitorsLast24h: Int = 0,
    val totalPageViews: Int = 0,
    val pageViewsToday: Int = 0,
    val pageViewsLast24h: Int = 0,
    val deviceBreakdown: AnalyticsDeviceBreakdown = AnalyticsDeviceBreakdown(),
    val hourlyTraffic: List<AnalyticsHourlyBucket> = emptyList(),
    val recentVisits: List<AnalyticsRecentVisit> = emptyList()
)

// ---- Payments: status ----

@Serializable
data class PaymentsStatusResponse(
    val automated: Boolean = false,
    val provider: String? = null,
    val adminConfigured: Boolean = false,
    val reason: String? = null
)

@Serializable
data class AmountRequest(val amount: Double)

@Serializable
data class CheckoutResponse(
    val checkoutUrl: String = "",
    val providerRef: String = ""
)

@Serializable
data class NowPaymentsStatusResponse(
    val automated: Boolean = false,
    val configured: Boolean = false
)

@Serializable
data class NowPaymentsInvoiceResponse(val checkoutUrl: String? = null)

@Serializable
data class NowPaymentsDirectPaymentResponse(
    val payAddress: String = "",
    val payCurrency: String = "",
    val payAmount: Double = 0.0
)

@Serializable
data class ConnectedAccountStatus(
    val connected: Boolean = false,
    val payoutsEnabled: Boolean = false,
    val onboardingUrl: String? = null
)

/** Response of `GET /api/payments/payout/status` — matches [ConnectedAccountStatus] exactly (server
 *  returns `{connected:false, payoutsEnabled:false}` directly when no account is connected yet). */
typealias PayoutAccountStatusResponse = ConnectedAccountStatus

@Serializable
data class PayoutConnectLinkResponse(
    val accountId: String = "",
    val status: ConnectedAccountStatus = ConnectedAccountStatus()
)

@Serializable
data class CreatePayoutResponse(
    val ok: Boolean = false,
    val providerRef: String? = null
)

// ---- Media upload ----

@Serializable
data class MediaStatusResponse(val configured: Boolean = false)

@Serializable
data class MediaUploadResponse(
    val url: String = "",
    val publicId: String? = null,
    val resourceType: String? = null
)

// ---- KYC ----

@Serializable
data class KycSubmitResponse(
    val success: Boolean = false,
    /** "verified" | "pending" */
    val status: String = "",
    val message: String = ""
)

@Serializable
data class KycDocumentResponse(
    val imageUrl: String? = null,
    val idType: String? = null,
    val idNumber: String? = null,
    val extractedName: String? = null,
    /** "high" | "medium" | "low" | "none" */
    val matchConfidence: String? = null,
    val aiReasoning: String? = null,
    /** "auto_verified" | "pending_review" */
    val decision: String? = null,
    val submittedAt: String? = null
)

// ---- Social verification ----

@Serializable
data class SocialStatusResponse(
    val telegram: Boolean = false,
    val youtube: Boolean = false
)

/** Raw payload from the mounted Telegram Login Widget — shape verified against `server/socialVerify.ts`'s
 *  `TelegramWidgetData` (server-side HMAC-SHA256 signature check over these exact fields). */
@Serializable
data class TelegramWidgetData(
    val id: Long,
    val first_name: String? = null,
    val username: String? = null,
    val auth_date: Long,
    val hash: String
)

@Serializable
data class VerifyTelegramRequest(
    val campaignId: String,
    val widgetData: TelegramWidgetData
)

@Serializable
data class VerifyYoutubeRequest(
    val campaignId: String,
    /** Read-only YouTube OAuth access token. */
    val accessToken: String
)

@Serializable
data class VerifyResponse(
    val verified: Boolean = false,
    val rewarded: Boolean = false
)

// ---- Publishing bots (GitHub Actions cron only — see method-level KDoc) ----

@Serializable
data class BotsDailyCycleResponse(
    val success: Boolean = false,
    val skipped: Boolean = false,
    val reason: String? = null
)

/** Generic shape of a `server.ts` error response — `{ error: "<code>", message?: "<arabic text>" }`. */
@Serializable
data class ApiErrorBody(
    val error: String? = null,
    val message: String? = null
)
