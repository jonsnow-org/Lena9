package studio.ai.literium.literium_app.data.remote

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

/**
 * Retrofit interface for `server.ts`'s custom Express backend (spec §11),
 * base URL `https://literium.ai.studio`. One method per documented
 * endpoint — this is a thin, faithful mirror of the actual routes; no
 * business logic lives here (see [studio.ai.literium.literium_app.data.repository]
 * for how these are actually used).
 *
 * NOT included here, deliberately (see final report for the full
 * reasoning): `/api/admin/reset-test-financial-data`,
 * `/api/analytics/reset`, and `/api/admin/bots/seed` — one-off
 * developer/ops utilities that exist in `server.ts` but are outside the
 * documented product API surface in spec §11, and are destructive enough
 * that they should never be reachable from a shipped mobile client.
 *
 * Auth: see [ApiErrorBody]'s file-level KDoc for which endpoints need an
 * `Authorization: Bearer <Firebase ID token>` header vs. which trust a
 * plain `userId` field in the request body instead (a genuine, faithfully
 * preserved asymmetry in the live server, not a Kotlin-side inconsistency).
 */
interface LiteriumApiService {

    @GET("/api/health")
    suspend fun health(): HealthResponse

    // ---- AI ----

    /** No auth header; server derives everything from [AiChatRequest.userId]. */
    @POST("/api/ai/chat")
    suspend fun aiChat(@Body body: AiChatRequest): AiChatResponse

    /** Requires `Authorization: Bearer <idToken>` — the only AI endpoint that actually verifies the caller. */
    @POST("/api/ai/generate-image")
    suspend fun generateImage(
        @Header("Authorization") authorization: String,
        @Body body: AiGenerateImageRequest
    ): AiGenerateImageResponse

    /** No auth header; server derives everything from [AiWritingAssistantRequest.userId]. */
    @POST("/api/ai/writing-assistant")
    suspend fun writingAssistant(@Body body: AiWritingAssistantRequest): AiWritingAssistantResponse

    /** No auth header; server derives everything from [AiSeoGeneratorRequest.userId]. */
    @POST("/api/ai/seo-generator")
    suspend fun seoGenerator(@Body body: AiSeoGeneratorRequest): AiSeoGeneratorResponse

    // ---- Articles ----

    /** Requires `Authorization: Bearer <idToken>`. Deducts price from the caller's `walletBalance`
     *  and credits the writer's `pendingEarnings` atomically, server-side. */
    @POST("/api/articles/unlock")
    suspend fun unlockArticle(
        @Header("Authorization") authorization: String,
        @Body body: UnlockArticleRequest
    ): UnlockArticleResponse

    // ---- Campaigns ----

    /** Requires `Authorization: Bearer <idToken>`; server independently re-checks the caller is an admin. */
    @POST("/api/campaigns/{campaignId}/review")
    suspend fun reviewCampaign(
        @Header("Authorization") authorization: String,
        @Path("campaignId") campaignId: String,
        @Body body: CampaignReviewRequest
    ): CampaignReviewResponse

    // ---- Analytics ----

    /** No auth header — anonymous visitors must be counted too. */
    @POST("/api/analytics/track-visit")
    suspend fun trackVisit(@Body body: TrackVisitRequest): TrackVisitResponse

    /** Requires `Authorization: Bearer <idToken>`; server independently re-checks the caller is an admin. */
    @GET("/api/analytics/summary")
    suspend fun analyticsSummary(@Header("Authorization") authorization: String): AnalyticsSummaryResponse

    // ---- Payments: status/config (no auth) ----

    @GET("/api/payments/status")
    suspend fun paymentsStatus(): PaymentsStatusResponse

    @GET("/api/payments/nowpayments/status")
    suspend fun nowPaymentsStatus(): NowPaymentsStatusResponse

    // ---- Payments: Stripe ----

    @POST("/api/payments/deposit/create-checkout")
    suspend fun createDepositCheckout(
        @Header("Authorization") authorization: String,
        @Body body: AmountRequest
    ): CheckoutResponse

    @GET("/api/payments/payout/status")
    suspend fun payoutAccountStatus(@Header("Authorization") authorization: String): PayoutAccountStatusResponse

    @POST("/api/payments/payout/connect-link")
    suspend fun createPayoutConnectLink(@Header("Authorization") authorization: String): PayoutConnectLinkResponse

    /** Min $50 enforced server-side too — see [studio.ai.literium.literium_app.util.PayoutRules.MIN_PAYOUT_USD]. */
    @POST("/api/payments/payout/create")
    suspend fun createPayout(
        @Header("Authorization") authorization: String,
        @Body body: AmountRequest
    ): CreatePayoutResponse

    // ---- Payments: NOWPayments (crypto) ----

    @POST("/api/payments/nowpayments/create-invoice")
    suspend fun createNowPaymentsInvoice(
        @Header("Authorization") authorization: String,
        @Body body: AmountRequest
    ): NowPaymentsInvoiceResponse

    /** Also backs the Guardarian card-bridge deposit flow (spec §6.5) — same USDT-TRC20 address minting. */
    @POST("/api/payments/nowpayments/create-direct-payment")
    suspend fun createNowPaymentsDirectPayment(
        @Header("Authorization") authorization: String,
        @Body body: AmountRequest
    ): NowPaymentsDirectPaymentResponse

    // ---- Media upload ----

    @GET("/api/media/status")
    suspend fun mediaStatus(): MediaStatusResponse

    /**
     * Requires `Authorization: Bearer <idToken>`. [purpose] is one of "article" | "message" | "ad"
     * (anything else defaults server-side to "ad", the strictest — 1-minute video cap).
     * Image ≤8MB, video ≤50MB, enforced both client-side (best-effort) and authoritatively server-side.
     */
    @Multipart
    @POST("/api/media/upload")
    suspend fun uploadMedia(
        @Header("Authorization") authorization: String,
        @Part file: MultipartBody.Part,
        @Part("purpose") purpose: RequestBody
    ): MediaUploadResponse

    // ---- KYC ----

    /** Requires `Authorization: Bearer <idToken>`. [document] must be an image (JPG/PNG), ≤8MB. */
    @Multipart
    @POST("/api/kyc/submit")
    suspend fun submitKyc(
        @Header("Authorization") authorization: String,
        @Part document: MultipartBody.Part,
        @Part("idType") idType: RequestBody,
        @Part("idNumber") idNumber: RequestBody
    ): KycSubmitResponse

    /** Admin-only; requires `Authorization: Bearer <idToken>`. Mints a short-lived signed image URL —
     *  never call this speculatively, only on an explicit admin "view document" action. */
    @GET("/api/kyc/document/{userId}")
    suspend fun fetchKycDocument(
        @Header("Authorization") authorization: String,
        @Path("userId") userId: String
    ): KycDocumentResponse

    // ---- Social verification (Telegram/YouTube follow-promotion rewards) ----

    @GET("/api/social/status")
    suspend fun socialVerificationStatus(): SocialStatusResponse

    /** Requires `Authorization: Bearer <idToken>`; rejected for anonymous/guest sessions (403). */
    @POST("/api/social/verify-telegram")
    suspend fun verifyTelegram(
        @Header("Authorization") authorization: String,
        @Body body: VerifyTelegramRequest
    ): VerifyResponse

    /** Requires `Authorization: Bearer <idToken>`; rejected for anonymous/guest sessions (403). */
    @POST("/api/social/verify-youtube")
    suspend fun verifyYoutube(
        @Header("Authorization") authorization: String,
        @Body body: VerifyYoutubeRequest
    ): VerifyResponse

    // ---- Publishing bots ----

    /**
     * Cron-only (spec §11.8/§12.6): protected by a shared-secret header the mobile app has no
     * legitimate reason to hold, checked by the server BEFORE normal auth — invoked exclusively by
     * the GitHub Actions daily workflow. Included here only for API-surface completeness; the Android
     * app should never call this.
     */
    @POST("/api/bots/run-daily-cycle")
    suspend fun runBotsDailyCycle(@Header("x-bots-cron-secret") cronSecret: String): BotsDailyCycleResponse
}
