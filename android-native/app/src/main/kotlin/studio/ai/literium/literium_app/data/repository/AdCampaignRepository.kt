package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.AdEvent
import studio.ai.literium.literium_app.data.model.ArticlePromotion
import studio.ai.literium.literium_app.data.model.CampaignStatus
import studio.ai.literium.literium_app.data.model.FraudFlag
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/**
 * Ad campaigns, the raw ad-event log, fraud flags, and article-promotion
 * requests. Ports `firestoreService.ts`'s "Campaigns Collection", "Ads
 * Collection", "أحداث الإعلانات (adEvents)", "Fraud Flags Collection" and
 * "طلبات ترويج المقالات" sections.
 *
 * ⚠️ Deliberately NOT included: a Kotlin port of `evaluateAdEventBatch`
 * (`src/utils/fraudFilters.ts`) — the second anti-fraud pass the admin
 * Finance tab's "process ad events" button runs (spec §5.7/§11.9). That
 * source file was outside this pass's required reading set, so rather than
 * guess at its exact filtering rules, it is left out entirely; only the
 * primitives it would need ([observeAdEvents], [markAdEventProcessed]) are
 * provided. See the final report for this gap.
 *
 * Failure convention: see [safeCall]'s file KDoc. [logAdEvent] is the one
 * documented exception — it always resolves successfully because the
 * source deliberately never lets a failed event-log write surface as a
 * user-facing error (`console.warn` only); see its own KDoc.
 */
class AdCampaignRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val campaignsCol get() = firestore.collection(FirestoreCollections.CAMPAIGNS)
    private val adsCol get() = firestore.collection(FirestoreCollections.ADS)
    private val adEventsCol get() = firestore.collection(FirestoreCollections.AD_EVENTS)
    private val fraudFlagsCol get() = firestore.collection(FirestoreCollections.FRAUD_FLAGS)
    private val promotionsCol get() = firestore.collection(FirestoreCollections.PROMOTIONS)

    // ---- Campaigns ----

    fun observeCampaigns(): Flow<List<AdCampaign>> = callbackFlow {
        val registration = campaignsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { it.toObject<AdCampaign>()?.copy(id = it.id) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    /**
     * Create or update a campaign — mirrors `saveCampaignToFirestore`: an id that is blank or starts
     * with the placeholder prefix `camp_temp_` is treated as new (default counters seeded at 0,
     * `fraudShieldScore` defaults to 100). Returns the resulting document id.
     *
     * Note: firestore.rules requires a brand-new campaign to be created with `status == "pending"` and
     * zeroed budget/counter fields — the caller is responsible for constructing [campaign] that way;
     * this method does not silently override [campaign.status].
     */
    // Note on [saveCampaign]'s update path: unlike source's generic `saveCampaignToFirestore` (which
    // merges whatever subset of `Partial<AdCampaign>` fields the caller happens to pass), [campaignToMap]
    // deliberately excludes every counter/spend field. This is not a capability loss for a real caller:
    // firestore.rules already forbids a non-admin advertiser from touching those fields via a plain
    // update (`noChangeTo([...'totalBudget','totalSpent','impressionsCount',...])`) — they can only be
    // moved through [updateCampaignStats] (admin) or [incrementCampaignSpend]/event processing, which is
    // exactly the boundary this method now enforces in Kotlin too.
    suspend fun saveCampaign(campaign: AdCampaign): Result<String> = safeCall {
        val isExistingDoc = campaign.id.isNotBlank() && !campaign.id.startsWith("camp_temp_")
        if (isExistingDoc) {
            campaignsCol.document(campaign.id).set(campaignToMap(campaign), SetOptions.merge()).await()
            campaign.id
        } else {
            val payload = campaignToMap(campaign).toMutableMap()
            payload["impressionsCount"] = campaign.impressionsCount
            payload["validImpressionsCount"] = campaign.validImpressionsCount ?: 0
            payload["clicksCount"] = campaign.clicksCount
            payload["validClicksCount"] = campaign.validClicksCount ?: 0
            payload["conversionsCount"] = campaign.conversionsCount
            payload["totalSpent"] = campaign.totalSpent
            payload["fraudShieldScore"] = campaign.fraudShieldScore ?: 100.0
            payload["blockedFraudClicks"] = campaign.blockedFraudClicks ?: 0
            payload["createdAt"] = Instant.now().toString()
            campaignsCol.add(payload).await().id
        }
    }

    suspend fun updateCampaignStats(campaignId: String, stats: Map<String, Any>): Result<Unit> = safeCall {
        if (stats.isNotEmpty()) campaignsCol.document(campaignId).update(stats).await()
        Unit
    }

    /**
     * Atomically increments `totalSpent` (never an absolute-number write) — required because
     * `recordVerificationAndReward` on the server can increment the same field concurrently for
     * social-follow-verification rewards; an absolute write here could clobber that (spec §5.9/§11.6).
     */
    suspend fun incrementCampaignSpend(campaignId: String, spendDelta: Double, markCompleted: Boolean): Result<Unit> = safeCall {
        val updates = mutableMapOf<String, Any>("totalSpent" to FieldValue.increment(spendDelta))
        if (markCompleted) updates["status"] = CampaignStatus.COMPLETED
        campaignsCol.document(campaignId).update(updates).await()
        Unit
    }

    suspend fun setCampaignStatus(campaignId: String, status: String): Result<Unit> = safeCall {
        campaignsCol.document(campaignId).update("status", status).await()
        Unit
    }

    /** firestore.rules restricts this to the campaign's own `advertiserId` or an admin. */
    suspend fun deleteCampaign(campaignId: String): Result<Unit> = safeCall {
        campaignsCol.document(campaignId).delete().await()
        Unit
    }

    /** Raw ad-unit/creative-placement documents — `ads` collection has no dedicated model in
     *  `types.ts`/`firestoreService.ts` beyond `{id, ...data}`, so this surfaces the raw field map. */
    fun observeAds(): Flow<List<Map<String, Any?>>> = callbackFlow {
        val registration = adsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.map { it.data.orEmpty() + ("id" to it.id) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    // ---- Ad events ----

    /**
     * Logs a raw impression/click event with `processed = false`. Always resolves as success — the
     * source deliberately treats a failed event log as non-critical to the viewer's experience
     * (`console.warn` only, never surfaced as an error), so this method swallows failures the same way
     * rather than making every ad-render call site handle a `Result` for a best-effort side channel.
     */
    suspend fun logAdEvent(event: AdEvent): Result<Unit> {
        return try {
            val payload = mutableMapOf<String, Any?>(
                "slotId" to event.slotId,
                "eventType" to event.eventType,
                "viewerId" to event.viewerId,
                "processed" to false,
                "createdAt" to Instant.now().toString()
            )
            event.campaignId?.let { payload["campaignId"] = it }
            event.promotionId?.let { payload["promotionId"] = it }
            event.articleId?.let { payload["articleId"] = it }
            event.writerId?.let { payload["writerId"] = it }
            if (event.isExternalAdView == true) payload["isExternalAdView"] = true
            adEventsCol.add(payload).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.success(Unit)
        }
    }

    /** Admin-only per firestore.rules. */
    fun observeAdEvents(): Flow<List<AdEvent>> = callbackFlow {
        val registration = adEventsCol.whereEqualTo("processed", false).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { it.toObject<AdEvent>()?.copy(id = it.id) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    suspend fun markAdEventProcessed(eventId: String, isValid: Boolean): Result<Unit> = safeCall {
        adEventsCol.document(eventId).update(mapOf("processed" to true, "isValid" to isValid)).await()
        Unit
    }

    // ---- Fraud flags ----

    /** Admin-read-only per firestore.rules. */
    fun observeFraudFlags(): Flow<List<FraudFlag>> = callbackFlow {
        val registration = fraudFlagsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { it.toObject<FraudFlag>()?.copy(id = it.id) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    /** Any signed-in user may create a flag (self-reporting an [AntiFraudEngine] rejection); only an
     *  admin may read/update/delete afterwards. [flag.detectedAt] is stamped server-side-equivalently
     *  here to match source's `"YYYY-MM-DD HH:mm"`-style human string. */
    suspend fun logFraudFlag(flag: FraudFlag): Result<Unit> = safeCall {
        val now = Instant.now()
        val detectedAt = DateTimeFormatter
            .ofLocalizedDateTime(FormatStyle.SHORT)
            .withLocale(Locale("ar"))
            .withZone(java.time.ZoneId.systemDefault())
            .format(now)
        val payload = flagToMap(flag) + mapOf("detectedAt" to detectedAt, "createdAt" to now.toString())
        fraudFlagsCol.add(payload).await()
        Unit
    }

    /** [action] "resolved" maps to [FraudFlagStatus.REVIEWED] and "dismissed" maps to
     *  [FraudFlagStatus.DISMISSED] — matching `resolveFraudFlagInFirestore` exactly. */
    suspend fun resolveFraudFlag(flagId: String, action: String): Result<Unit> = safeCall {
        val status = if (action == "resolved") "reviewed" else "dismissed"
        fraudFlagsCol.document(flagId).update("status", status).await()
        Unit
    }

    // ---- Article promotions ----

    /** firestore.rules requires `writerId == caller`, `status == "pending"`, and zeroed counters on
     *  create — [promotion] must already satisfy that (mirrors `requestArticlePromotion`'s payload shape). */
    suspend fun requestArticlePromotion(promotion: ArticlePromotion): Result<String> = safeCall {
        val payload = mutableMapOf<String, Any?>(
            "articleId" to promotion.articleId,
            "writerId" to promotion.writerId,
            "durationHours" to promotion.durationHours,
            "pricingModel" to promotion.pricingModel,
            "cost" to promotion.cost,
            "status" to "pending",
            "createdAt" to Instant.now().toString(),
            "impressionsCount" to 0,
            "clicksCount" to 0
        )
        promotion.articleTitle?.let { payload["articleTitle"] = it }
        promotion.writerName?.let { payload["writerName"] = it }
        promotionsCol.add(payload).await().id
    }

    /** Non-admins may only query their own promotions (firestore.rules) — pass [isAdmin] = true to
     *  read every writer's promotions instead of scoping to [writerId]. */
    fun observePromotions(writerId: String?, isAdmin: Boolean): Flow<List<ArticlePromotion>> = callbackFlow {
        if (!isAdmin && writerId == null) {
            // No listener was ever registered on this branch — `callbackFlow` still requires
            // `awaitClose` to be called before the block returns (it throws otherwise), so this
            // no-op close still goes through it rather than an early `return@callbackFlow`.
            trySend(emptyList())
            awaitClose { }
        } else {
            val query: Query = if (isAdmin) promotionsCol else promotionsCol.whereEqualTo("writerId", writerId)
            val registration = query.addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { it.toObject<ArticlePromotion>()?.copy(id = it.id) }.orEmpty()
                    .sortedByDescending { it.createdAt }
                trySend(list)
            }
            awaitClose { registration.remove() }
        }
    }

    suspend fun setPromotionStatus(promotionId: String, status: String, adminNote: String? = null): Result<Unit> = safeCall {
        val payload = mutableMapOf<String, Any>("status" to status, "reviewedAt" to Instant.now().toString())
        if (!adminNote.isNullOrBlank()) payload["adminNote"] = adminNote
        promotionsCol.document(promotionId).update(payload).await()
        Unit
    }

    /** Only while still `pending`, by the requesting writer (or any time, by an admin) — firestore.rules. */
    suspend fun cancelPromotionRequest(promotionId: String): Result<Unit> = safeCall {
        promotionsCol.document(promotionId).delete().await()
        Unit
    }

    // ---- internal mapping ----

    private fun campaignToMap(c: AdCampaign): Map<String, Any?> = mapOf(
        "id" to c.id,
        "advertiserId" to c.advertiserId,
        "advertiserName" to c.advertiserName,
        "campaignName" to c.campaignName,
        "description" to c.description,
        "imageUrl" to c.imageUrl,
        "destinationUrl" to c.destinationUrl,
        "type" to c.type,
        "pricingModel" to c.pricingModel,
        "placementType" to c.placementType,
        "adText" to c.adText,
        "status" to c.status,
        "durationHours" to c.durationHours,
        "startDate" to c.startDate,
        "endDate" to c.endDate,
        "totalBudget" to c.totalBudget,
        "requestedBudget" to c.requestedBudget,
        "cpcRate" to c.cpcRate,
        "cpmRate" to c.cpmRate,
        "fixedRate" to c.fixedRate,
        "targetCategories" to c.targetCategories,
        "targetCountries" to c.targetCountries,
        "antiFraudLevel" to c.antiFraudLevel,
        "videoUrl" to c.videoUrl,
        "uploadedVideoUrl" to c.uploadedVideoUrl,
        "promotionKind" to c.promotionKind,
        "verifiedActionsCount" to c.verifiedActionsCount
    ).filterValues { it != null }

    private fun flagToMap(f: FraudFlag): Map<String, Any?> = mapOf(
        "campaignId" to f.campaignId,
        "campaignName" to f.campaignName,
        "articleId" to f.articleId,
        "articleTitle" to f.articleTitle,
        "writerId" to f.writerId,
        "writerName" to f.writerName,
        "userId" to f.userId,
        "userIp" to f.userIp,
        "pricingModel" to f.pricingModel,
        "triggerType" to f.triggerType,
        "severity" to f.severity,
        "status" to f.status,
        "details" to f.details,
        "mitigationAction" to f.mitigationAction,
        "revenueBlocked" to f.revenueBlocked
    ).filterValues { it != null }
}
