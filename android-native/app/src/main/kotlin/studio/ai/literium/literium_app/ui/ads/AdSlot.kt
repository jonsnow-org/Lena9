package studio.ai.literium.literium_app.ui.ads

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.AdEvent
import studio.ai.literium.literium_app.data.model.AdEventType
import studio.ai.literium.literium_app.data.model.AdPlacementType
import studio.ai.literium.literium_app.data.model.AdSlotBeneficiary
import studio.ai.literium.literium_app.data.model.AdSlotConfig
import studio.ai.literium.literium_app.data.model.CampaignStatus
import studio.ai.literium.literium_app.data.model.PromotionKind
import studio.ai.literium.literium_app.data.repository.AdCampaignRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.ui.components.IsolatedWebView
import studio.ai.literium.literium_app.ui.components.VideoEmbed
import studio.ai.literium.literium_app.ui.components.VideoPlayer
import studio.ai.literium.literium_app.ui.components.parseVideoUrl
import studio.ai.literium.literium_app.util.AntiFraudEngine
import java.util.concurrent.atomic.AtomicInteger
import kotlin.random.Random

/**
 * Kotlin/Compose port of `src/components/AdSlot.tsx` (442 lines) — the full-card ad unit rendered at
 * each of the 13 named [studio.ai.literium.literium_app.data.model.AdSlotId] positions (spec §5.1).
 *
 * ⚠️ Public-signature note: the integration contract this slice was built against literally reads
 * `fun AdSlot(slotId: AdSlotId, modifier: Modifier = Modifier)`. That does not type-check as written —
 * `AdSlotId` (`data/model/AdModels.kt`) is a plain `object` namespacing `String` constants, not a type —
 * so `slotId` below is typed `String`. Every existing/expected call site (`AdSlot(slotId =
 * AdSlotId.HOME_HERO)`) compiles identically either way, since `AdSlotId.HOME_HERO` IS a `String`.
 * [modifier] keeps its exact position/default. Every parameter after it is a new, purely-additive,
 * defaulted parameter — `AdSlot(slotId = AdSlotId.X)` alone still compiles and behaves fully, so this
 * does not break the stable two-argument contract other workstreams already code against; it only lets
 * a caller that HAS the extra context (inside an article, on a writer profile, on a category page) opt
 * into the fuller fidelity (self-click protection, in-read formatting, sponsor category matching) that
 * `AdSlot.tsx` gets from its `campaigns`/`articleId`/`writerId`/`category`/`inRead`/`adFree` props. See
 * the final report for the full reasoning.
 *
 * @param articleId the article this slot is embedded in, if any (tags logged ad events; §5.1a/§5.4).
 * @param writerId the writer whose article/profile this slot is embedded in, if any — NOT necessarily
 *   the viewer; used only to tag logged events, matching `AdSlot.tsx`'s own `writerId` prop.
 * @param articleWriterId the writer id anti-fraud should compare the *viewer* against for self-click/
 *   self-view suppression (`AntiFraudEngine`'s `articleWriterId == userId` checks) — pass this on any
 *   writer-beneficiary slot embedded in that writer's own article/profile.
 * @param viewerId explicit viewer id override; when null (the common case) the current Firebase Auth
 *   uid is read live, matching how the web app resolves `viewerId` from `onAuthStateChanged` upstream.
 * @param category current category — used only to match a `category_banner` sponsor campaign's
 *   `targetCategories`.
 * @param inRead true = the in-article-body creative format (`AdSlot.tsx`'s `inRead` branch); false =
 *   the standard card format used everywhere else.
 * @param adFree true = an ad-free-subscription viewer; renders nothing at all, matching source.
 */
@Composable
fun AdSlot(
    slotId: String,
    modifier: Modifier = Modifier,
    articleId: String? = null,
    writerId: String? = null,
    articleWriterId: String? = null,
    viewerId: String? = null,
    category: String? = null,
    inRead: Boolean = false,
    adFree: Boolean = false
) {
    val config = AdSlotConfig.BY_SLOT[slotId] ?: return
    if (adFree) return

    val firestore = remember { FirebaseFirestore.getInstance() }
    val adCampaignRepository = remember { AdCampaignRepository(firestore) }
    val authRepository = remember { AuthRepository() }
    val scope = rememberCoroutineScope()

    remember {
        PlatformAdsSettingsStore.ensureStarted(firestore)
        ExternalAdsSettingsStore.ensureStarted(firestore)
    }
    val platformAdsEnabled by PlatformAdsSettingsStore.enabled.collectAsState()
    val externalAdsConfig by ExternalAdsSettingsStore.config.collectAsState()
    // Remembered (not called fresh each recomposition) so the underlying Firebase Auth listener is
    // registered once per AdSlot instance rather than torn down/re-added on every recomposition.
    val authStateFlow = remember(authRepository) { authRepository.authState() }
    val firebaseUser by authStateFlow.collectAsState(initial = authRepository.currentFirebaseUser)
    val resolvedViewerId = viewerId ?: firebaseUser?.uid

    val campaigns by remember(adCampaignRepository) { adCampaignRepository.observeCampaigns() }
        .collectAsState(initial = emptyList())

    val slotIndex = remember(slotId) { AdPageCounter.claimAdSlotIndex() }
    val rotationSeed = remember(slotId) { AdPageCounter.rotationSeed }

    val isSponsorSlot = config.sponsorOnly
    val isPlatformSlot = config.beneficiary == AdSlotBeneficiary.PLATFORM

    // Direct internal-campaign candidate — used as-is for the exclusive sponsor slot and for every
    // writer-beneficiary slot (article_*, writer_profile_*, comments_feed); for platform slots it feeds
    // rotationPool below instead of being used directly. Mirrors AdSlot.tsx's `internalCandidate`.
    val internalCandidate: AdCampaign? = remember(campaigns, isSponsorSlot, isPlatformSlot, platformAdsEnabled, category, slotIndex, rotationSeed) {
        if (isPlatformSlot && !platformAdsEnabled) return@remember null
        val active = campaigns.filter { it.status == CampaignStatus.ACTIVE }
        if (active.isEmpty()) return@remember null
        if (isSponsorSlot) {
            return@remember active.firstOrNull { c ->
                c.placementType == AdPlacementType.CATEGORY_SPONSOR &&
                    (category == null || category in c.targetCategories)
            }
        }
        val eligible = active.filter { it.placementType != AdPlacementType.CATEGORY_SPONSOR }
        if (eligible.isEmpty()) return@remember null
        eligible[(slotIndex + rotationSeed).mod(eligible.size)]
    }

    // Whether an external-network fill (PropellerAds/Adsterra/Taboola) would be eligible right now —
    // feeds the fair-rotation-pool accounting below; an External turn that actually wins renders via
    // ExternalAdNetworkView further down (see ExternalAdsSettingsStore's KDoc).
    val hasEligibleExternalNetwork = platformAdsEnabled && ExternalAdsSettingsStore.eligibleCount(externalAdsConfig) > 0

    // Fair-rotation pool — platform (non-sponsor) slots only, mirrors AdSlot.tsx's `rotationPool`
    // exactly: internal campaigns and eligible external-network "slots" rotate together so neither
    // source permanently starves the other. An External turn always resolving to an internal campaign
    // instead would silently inflate internal campaigns' effective share of platform-slot impressions
    // beyond what the real rotation math intends — so it renders the external network it actually won
    // instead (see below), matching the web's own rotation fairness.
    val rotationPool: List<RotationPoolItem> = remember(campaigns, isSponsorSlot, isPlatformSlot, platformAdsEnabled, externalAdsConfig) {
        if (isSponsorSlot || !isPlatformSlot || !platformAdsEnabled) return@remember emptyList()
        val eligibleCampaigns = campaigns.filter { it.status == CampaignStatus.ACTIVE && it.placementType != AdPlacementType.CATEGORY_SPONSOR }
        val pool = mutableListOf<RotationPoolItem>()
        eligibleCampaigns.forEach { pool.add(RotationPoolItem.Internal(it)) }
        repeat(ExternalAdsSettingsStore.eligibleCount(externalAdsConfig)) { pool.add(RotationPoolItem.External) }
        pool
    }
    val selectedPoolItem = if (rotationPool.isNotEmpty()) rotationPool[(slotIndex + rotationSeed).mod(rotationPool.size)] else null

    val selectedCampaign: AdCampaign? = when {
        isSponsorSlot -> internalCandidate
        isPlatformSlot -> (selectedPoolItem as? RotationPoolItem.Internal)?.campaign
        config.internalPriority -> internalCandidate
        hasEligibleExternalNetwork -> null
        else -> internalCandidate
    }

    if (slotIndex >= MAX_ADS_PER_PAGE) return

    // The fair-rotation turn landed on an external-network slot rather than an internal campaign —
    // render whichever eligible network (enabled + appSafe, admin-controlled on/off exactly like a
    // browser's own ad-network toggle) the same slot/rotation math selects deterministically, via the
    // one narrowly-scoped WebView this reverses the app's no-WebView default for. See
    // [ExternalAdNetworkView]'s KDoc for the isolation this still keeps.
    if (isPlatformSlot && selectedPoolItem is RotationPoolItem.External) {
        // Adsterra no longer carries one fixed snippet — it occupies one rotation-pool "turn" like
        // any other network, but which of its 7 hardcoded units actually renders is picked separately
        // (same rotation offset) among only the units the admin hasn't individually disabled. See
        // ExternalAdsSettingsStore's KDoc + AdsterraUnits.kt (Kotlin twin of adsterraUnits.ts).
        val plainNetworks = listOf(externalAdsConfig.propellerAds, externalAdsConfig.taboola)
            .filter { it.enabled && it.snippet.isNotBlank() && it.appSafe }
        val adsterraEligible = ExternalAdsSettingsStore.isAdsterraEligible(externalAdsConfig)
        val poolSize = plainNetworks.size + if (adsterraEligible) 1 else 0
        if (poolSize > 0) {
            val idx = (slotIndex + rotationSeed).mod(poolSize)
            if (idx < plainNetworks.size) {
                ExternalAdNetworkView(snippet = plainNetworks[idx].snippet, modifier = modifier)
            } else {
                val unit = pickAdsterraUnit(externalAdsConfig.adsterraUnits, slotIndex + rotationSeed)
                if (unit != null) {
                    ExternalAdNetworkView(
                        snippet = unit.snippet,
                        modifier = modifier,
                        heightDp = unit.heightPx.dp,
                        widthDp = if (unit.widthPx > 0) unit.widthPx.dp else null
                    )
                }
            }
        }
        return
    }

    // No internal campaign won this render (none eligible, or non-platform slot deferring to an
    // external-priority policy with none rendered above): render nothing. We never fabricate a
    // view/click event for content the user was never actually shown.
    val campaign = selectedCampaign ?: return

    AdCreative(
        campaign = campaign,
        config = config,
        slotId = slotId,
        articleId = articleId,
        writerId = writerId,
        articleWriterId = articleWriterId,
        viewerId = resolvedViewerId,
        inRead = inRead,
        modifier = modifier,
        adCampaignRepository = adCampaignRepository,
        scope = scope
    )
}

/** Renders one resolved [AdCampaign]'s creative plus real viewability/dwell/click anti-fraud tracking. */
@Composable
private fun AdCreative(
    campaign: AdCampaign,
    config: AdSlotConfig,
    slotId: String,
    articleId: String?,
    writerId: String?,
    articleWriterId: String?,
    viewerId: String?,
    inRead: Boolean,
    modifier: Modifier,
    adCampaignRepository: AdCampaignRepository,
    scope: CoroutineScope
) {
    val view = LocalView.current
    val uriHandler = LocalUriHandler.current

    var visibleFraction by remember(campaign.id) { mutableStateOf(0f) }
    var continuousVisibleMs by remember(campaign.id) { mutableStateOf(0L) }
    var hasLoggedImpression by remember(campaign.id) { mutableStateOf(false) }
    val mountTimeMs = remember(campaign.id) { System.currentTimeMillis() }

    // Real on-screen-percentage measurement (spec §5.4/§12.1: ≥50% visible, continuously, before an
    // impression can even be attempted) — element bounds vs. the root view's window bounds, not a
    // fixed-delay stand-in.
    val trackedModifier = modifier.onGloballyPositioned { coords ->
        val bounds = coords.boundsInWindow()
        val elementArea = bounds.width * bounds.height
        visibleFraction = if (elementArea <= 0f) {
            0f
        } else {
            val viewportW = view.width.toFloat()
            val viewportH = view.height.toFloat()
            val visW = (minOf(bounds.right, viewportW) - maxOf(bounds.left, 0f)).coerceAtLeast(0f)
            val visH = (minOf(bounds.bottom, viewportH) - maxOf(bounds.top, 0f)).coerceAtLeast(0f)
            ((visW * visH) / elementArea).coerceIn(0f, 1f)
        }
    }

    // Dwell timer: accumulates while ≥50% visible, resets the instant it drops below — the same idea
    // as AdSlot.tsx's IntersectionObserver+setTimeout, then hands off to the REAL AntiFraudEngine
    // (util/AntiFraud.kt) for the actual accept/reject decision (self-view throttle, the real
    // 1s-continuous/50%-viewable floor, the 1.5s-dwell-or-10%-scroll bot check, and the 15s repeat-view
    // throttle) instead of AdSlot.tsx's own bare "just log it" behavior. This is a deliberate,
    // documented enhancement over the literal web source — see the final report.
    LaunchedEffect(campaign.id, viewerId, articleWriterId) {
        var accumulatedMs = 0L
        var lastTick = System.currentTimeMillis()
        var loggedRejectionOnce = false
        while (isActive && !hasLoggedImpression) {
            delay(120)
            val now = System.currentTimeMillis()
            val elapsed = (now - lastTick).coerceAtLeast(0)
            lastTick = now
            accumulatedMs = if (visibleFraction >= 0.5f) accumulatedMs + elapsed else 0L
            continuousVisibleMs = accumulatedMs
            // Safety valve: never spin forever on a rejection that won't naturally resolve (e.g. this
            // exact campaign+viewer already logged a valid impression elsewhere within the last 15s).
            if (accumulatedMs > 30_000L) break
            if (accumulatedMs < 1000L) continue

            val dwellSeconds = (now - mountTimeMs) / 1000.0
            val ctx = AntiFraudEngine.ViewabilityContext(
                campaignId = campaign.id,
                pricingModel = campaign.pricingModel,
                visiblePercentage = (visibleFraction * 100).toDouble(),
                continuousVisibleMs = accumulatedMs,
                // No page-level scroll-depth signal reaches this composable (AdSlot's stable public
                // signature carries no shared scroll-position context) — conservatively treated as 0,
                // which only matters when dwell is also under 1.5s (see AntiFraud.kt's rapid-refresh
                // check); a real page-scroll signal from the hosting screen would sharpen this further.
                pageScrollDepth = 0.0,
                pageDwellTimeSeconds = dwellSeconds,
                userId = viewerId,
                articleId = articleId,
                articleWriterId = articleWriterId
            )
            val result = AntiFraudEngine.validateImpression(ctx)
            if (result.isValid) {
                hasLoggedImpression = true
                adCampaignRepository.logAdEvent(
                    AdEvent(
                        campaignId = campaign.id,
                        slotId = slotId,
                        articleId = articleId,
                        writerId = writerId,
                        viewerId = viewerId,
                        eventType = AdEventType.IMPRESSION
                    )
                )
            } else if (!loggedRejectionOnce && result.fraudFlag != null) {
                loggedRejectionOnce = true
                adCampaignRepository.logFraudFlag(result.fraudFlag)
            }
        }
    }

    fun handleClick() {
        val now = System.currentTimeMillis()
        val ctx = AntiFraudEngine.ViewabilityContext(
            campaignId = campaign.id,
            pricingModel = campaign.pricingModel,
            visiblePercentage = (visibleFraction * 100).toDouble(),
            continuousVisibleMs = continuousVisibleMs,
            pageScrollDepth = 0.0,
            pageDwellTimeSeconds = (now - mountTimeMs) / 1000.0,
            userId = viewerId,
            articleId = articleId,
            articleWriterId = articleWriterId,
            clickTimeFromLoadSeconds = (now - mountTimeMs) / 1000.0
        )
        val result = AntiFraudEngine.validateClick(ctx)
        scope.launch {
            if (result.isValid) {
                adCampaignRepository.logAdEvent(
                    AdEvent(
                        campaignId = campaign.id,
                        slotId = slotId,
                        articleId = articleId,
                        writerId = writerId,
                        viewerId = viewerId,
                        eventType = AdEventType.CLICK
                    )
                )
            } else {
                result.fraudFlag?.let { adCampaignRepository.logFraudFlag(it) }
            }
        }
        // Matches AdSlot.tsx's `handleClick`: the destination ALWAYS opens regardless of anti-fraud
        // validity — a suspected-fraudulent click still reflects a real user's tap intent; validity
        // only ever gates whether the click is credited as billable revenue, never the navigation
        // itself.
        if (campaign.destinationUrl.isNotBlank()) uriHandler.openUri(campaign.destinationUrl)
    }

    val isPromo = !campaign.promotionKind.isNullOrBlank() && campaign.promotionKind != PromotionKind.WEBSITE
    val adText = campaign.adText.ifBlank { campaign.description }
    val advertiserName = campaign.advertiserName.ifBlank { "معلن" }
    val disclosureLabel = if (inRead) "إعلان" else if (config.sponsorOnly) "برعاية" else "إعلان"
    val cardShape = RoundedCornerShape(16.dp)
    val cardBorder = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    val cardContainerColor = if (inRead) {
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
    } else {
        MaterialTheme.colorScheme.surface
    }
    val cardPadding = if (inRead) 16.dp else 14.dp

    Column(trackedModifier.padding(vertical = if (inRead) 20.dp else 12.dp)) {
        if (inRead) HorizontalDivider()
        Text(
            text = disclosureLabel,
            fontSize = if (inRead) 11.sp else 10.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = if (inRead) 8.dp else 0.dp, horizontal = 0.dp).padding(bottom = if (inRead) 0.dp else 6.dp)
        )
        if (isPromo) {
            // Promo (social-follow) campaigns are never the whole-card click target on the web either —
            // only the CTA button inside is (`SocialPromoCta`'s own button); the surrounding card is a
            // plain, non-clickable container.
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = cardShape,
                colors = CardDefaults.cardColors(containerColor = cardContainerColor),
                border = cardBorder
            ) {
                Column(Modifier.padding(cardPadding)) {
                    AdMediaBlock(campaign)
                    Text(
                        text = adText,
                        fontSize = if (inRead) 14.sp else 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = if (campaign.imageUrl.isNotBlank()) 12.dp else 0.dp)
                    )
                    PromoCtaButton(campaign.promotionKind!!, Modifier.padding(top = 12.dp)) { handleClick() }
                    Text(
                        text = advertiserName,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        } else {
            Card(
                onClick = { handleClick() },
                modifier = Modifier.fillMaxWidth(),
                shape = cardShape,
                colors = CardDefaults.cardColors(containerColor = cardContainerColor),
                border = cardBorder
            ) {
                Column(Modifier.padding(cardPadding)) {
                    AdMediaBlock(campaign)
                    Text(
                        text = adText,
                        fontSize = 14.sp,
                        fontWeight = if (inRead) FontWeight.Medium else FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = if (campaign.imageUrl.isNotBlank()) 12.dp else 0.dp)
                    )
                    Text(
                        text = if (inRead) "محتوى مموّل — $advertiserName" else advertiserName,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = if (inRead) 8.dp else 4.dp)
                    )
                }
            }
        }
        if (inRead) HorizontalDivider(modifier = Modifier.padding(top = 12.dp))
    }
}

/**
 * Media block for an ad creative — Kotlin port of `AdSlot.tsx`'s `mediaBlock()`, same precedence: an
 * uploaded video ([VideoPlayer], Media3/ExoPlayer, real Cloudinary-hosted video files) beats an
 * embedded YouTube/Vimeo URL ([VideoEmbed], the one narrowly-scoped `WebView` use for third-party
 * iframe embeds this rewrite can't avoid), which beats a plain [AdCampaign.imageUrl] image, which
 * beats rendering nothing at all — exactly source's own fallback order.
 */
@Composable
private fun AdMediaBlock(campaign: AdCampaign) {
    val uploadedVideoUrl = campaign.uploadedVideoUrl
    val videoUrl = campaign.videoUrl
    when {
        !uploadedVideoUrl.isNullOrBlank() -> VideoPlayer(
            src = uploadedVideoUrl,
            modifier = Modifier.clip(RoundedCornerShape(12.dp))
        )
        !videoUrl.isNullOrBlank() && parseVideoUrl(videoUrl) != null -> VideoEmbed(url = videoUrl)
        campaign.imageUrl.isNotBlank() -> AsyncImage(
            model = campaign.imageUrl,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(12.dp))
        )
        else -> Unit
    }
}

/**
 * Kotlin port of `ExternalAdScript.tsx` — renders one external ad network's raw HTML/JS `snippet`
 * (PropellerAds/Adsterra/Taboola) inside a small fixed-height, isolated [IsolatedWebView] instead of
 * the web's sandboxed `srcdoc` iframe. This reverses this rewrite's own "no WebView anywhere" default
 * specifically and only for this one surface, at explicit request, since the app is not imminently
 * bound for Play Store review — where raw third-party ad-network script injection in a native app is
 * a real policy risk worth knowing about before ever submitting there. Fully admin-toggleable exactly
 * like a browser's own ad-blocker-adjacent on/off switch: each network's `enabled` flag
 * ([ExternalAdsSettingsStore]) is the kill switch, live via the same Firestore document the admin
 * panel's external-ads form already writes to.
 */
@Composable
internal fun ExternalAdNetworkView(
    snippet: String,
    modifier: Modifier = Modifier,
    heightDp: Dp = 90.dp,
    /** Real fixed width for a unit narrower than the slot's container (e.g. Adsterra's 160×300/
     *  160×600/468×60/728×90) — centered within the available width instead of stretched to fill it.
     *  `null` (the default) keeps the previous fillMaxWidth() behavior. */
    widthDp: Dp? = null
) {
    val trimmed = snippet.trim()
    if (trimmed.isEmpty()) return
    val html = "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
        "<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>" +
        trimmed + "</body></html>"
    Box(
        modifier = modifier
            .then(if (widthDp != null) Modifier.width(widthDp) else Modifier.fillMaxWidth())
            .height(heightDp)
            .clip(RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center
    ) {
        IsolatedWebView(html = html)
    }
}

/**
 * Lightweight stand-in for `SocialPromoCta.tsx`: an honest click-through CTA (always records a real
 * click via [AdCreative]'s own `handleClick`) for a social-follow-promotion campaign
 * ([PromotionKind] != website). Does NOT port `SocialPromoCta.tsx`'s real Telegram/YouTube
 * verified-follow-reward flow (Telegram login widget, YouTube read-only OAuth, `socialVerifyApi`
 * verification round-trip, §4.11a/§11.6/§12.8) — that is a distinct, substantially larger feature
 * (server-verified follow-through + a reward credit) outside "AdSlot + AdTickerBar" scope. See the
 * final report. Icons here are generic Material stand-ins, not brand marks — Compose's Material icon
 * set has no Telegram/YouTube/Instagram/X/Facebook logos to draw on.
 */
@Composable
private fun PromoCtaButton(kind: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val (label, icon, color) = when (kind) {
        PromotionKind.YOUTUBE -> Triple("اشترك في القناة", Icons.Filled.PlayArrow, Color(0xFFDC2626))
        PromotionKind.TELEGRAM -> Triple("انضم إلى القناة", Icons.AutoMirrored.Filled.Send, Color(0xFF0EA5E9))
        PromotionKind.INSTAGRAM -> Triple("تابعنا على انستغرام", Icons.Filled.CameraAlt, Color(0xFFC026D3))
        PromotionKind.TWITTER -> Triple("تابعنا على X", Icons.Filled.AlternateEmail, Color(0xFF1E293B))
        PromotionKind.FACEBOOK -> Triple("تابع الصفحة", Icons.Filled.ThumbUp, Color(0xFF2563EB))
        else -> Triple("زيارة", Icons.Filled.OpenInNew, Color(0xFF334155))
    }
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = color),
        shape = RoundedCornerShape(10.dp)
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.padding(end = 6.dp))
        Text(label, fontWeight = FontWeight.Bold, fontSize = 13.sp)
    }
}

/**
 * Discriminates a fair-rotation-pool slot: a real internal campaign, or a turn that (on the web) an
 * external ad network would have filled — see [AdSlot]'s `rotationPool` KDoc for why an [External]
 * turn renders nothing in this native app rather than a fabricated fallback.
 */
private sealed class RotationPoolItem {
    data class Internal(val campaign: AdCampaign) : RotationPoolItem()
    data object External : RotationPoolItem()
}

/** `MAX_ADS_PER_PAGE` — مطابقة لـ `AdSlot.tsx` (رُفعت من 3 إلى 5: مرحلة بناء/تطوير حالياً بلا
 *  تقديم قريب لبرنامج AdSense؛ يجب إعادتها إلى 3 قبل أي تقديم فعلي له). */
internal const val MAX_ADS_PER_PAGE = 5

/**
 * Kotlin port of `AdSlot.tsx`'s module-level `renderedAdsOnPage`/`adRotationSeed` counters — shared by
 * every [AdSlot]/[AdTickerBar] instance on the current screen (via [claimAdSlotIndex]) so the
 * platform-wide 3-ads-per-page cap and the fair rotation offset apply across all of them together, not
 * per-component.
 *
 * ⚠️ Integration gap: source resets this on every route/screen change (`App.tsx` calls
 * `resetAdSlotCounter()` on navigation). This slice does not own `navigation/LiteriumNavHost.kt`, so
 * nothing here calls [reset] automatically. For the cap and rotation fairness to behave correctly
 * across screens (not just within the process's lifetime), the navigation layer needs to call
 * `AdPageCounter.reset()` once per screen entry — e.g. a `LaunchedEffect(currentBackStackEntry) {
 * AdPageCounter.reset() }` at the `NavHost` level. Flagged in the final report as a required follow-up
 * for whichever workstream owns navigation.
 */
internal object AdPageCounter {
    private val counter = AtomicInteger(0)

    @Volatile
    var rotationSeed: Int = Random.nextInt(997)
        private set

    fun claimAdSlotIndex(): Int = counter.getAndIncrement()

    fun reset() {
        counter.set(0)
        rotationSeed = Random.nextInt(997)
    }
}

/**
 * Kotlin port of `src/utils/platformAdsStore.ts` — one shared Firestore listener on
 * `settings/platformAds` (`enabled`, default true when the doc/field is absent — only an explicit
 * `false` disables) reused by every [AdSlot]/[AdTickerBar] instance instead of one listener per ad
 * unit, matching the source's single-listener "store" pattern exactly.
 */
internal object PlatformAdsSettingsStore {
    private val _enabled = MutableStateFlow(true)
    val enabled: StateFlow<Boolean> = _enabled

    @Volatile
    private var started = false

    @Synchronized
    fun ensureStarted(firestore: FirebaseFirestore) {
        if (started) return
        started = true
        firestore.collection(FirestoreCollections.Settings.COLLECTION)
            .document(FirestoreCollections.Settings.PLATFORM_ADS_DOC)
            .addSnapshotListener { snap, _ ->
                _enabled.value = if (snap != null && snap.exists()) (snap.getBoolean("enabled") ?: true) else true
            }
    }
}

/**
 * Kotlin port of `src/utils/externalAdsStore.ts`'s config shape/listener (`settings/externalAds`).
 *
 * [eligibleCount] feeds [AdSlot]'s fair-rotation-pool accounting; when an `External` turn actually
 * wins the rotation, [AdSlot] renders the chosen network's raw snippet via
 * [ExternalAdNetworkView]/[studio.ai.literium.literium_app.ui.components.IsolatedWebView] — the one
 * deliberate, explicitly-requested exception to this app otherwise using zero WebView anywhere.
 * `appSafe` is applied unconditionally (as if `isRunningInNativeApp()` were always true) — that flag's
 * entire purpose in source is exactly "this network's snippet is confirmed safe to run inside an
 * installed native-ish app, not just the open web", which describes this app more strictly than it
 * describes the Capacitor-wrapped WebView build the flag was originally written for.
 */
internal object ExternalAdsSettingsStore {
    data class NetworkConfig(val enabled: Boolean = false, val snippet: String = "", val appSafe: Boolean = false)
    data class Config(
        val propellerAds: NetworkConfig = NetworkConfig(),
        val adsterra: NetworkConfig = NetworkConfig(),
        /** Per-unit enable/disable map from `adsterraUnits` on the same Firestore doc — mirrors
         *  `ExternalAdsConfig.adsterraUnits` on web. A unit id missing from this map is enabled by
         *  default (only explicit `false` disables it). */
        val adsterraUnits: Map<String, Boolean> = emptyMap(),
        val taboola: NetworkConfig = NetworkConfig(),
        val estimatedCpmUsd: Double = 2.0
    )

    private val _config = MutableStateFlow(Config())
    val config: StateFlow<Config> = _config

    @Volatile
    private var started = false

    @Synchronized
    fun ensureStarted(firestore: FirebaseFirestore) {
        if (started) return
        started = true
        firestore.collection(FirestoreCollections.Settings.COLLECTION)
            .document(FirestoreCollections.Settings.EXTERNAL_ADS_DOC)
            .addSnapshotListener { snap, _ ->
                val data: Map<String, Any?> = if (snap != null && snap.exists()) snap.data.orEmpty() else emptyMap()
                // `default` mirrors web's DEFAULT_CONFIG (externalAdsStore.ts): Adsterra's hardcoded,
                // pre-vetted units default ON (enabled=true, appSafe=true) when the Firestore doc has
                // no `adsterra` field yet at all, unlike every other network which defaults fully OFF.
                // This function used to hardcode `false` for every network regardless — which silently
                // disagreed with the admin UI's own `?: true` fallback for Adsterra (CampaignsTab.kt),
                // showing "enabled ✓" there while actually rendering nothing here until first saved.
                fun parse(key: String, default: NetworkConfig = NetworkConfig()): NetworkConfig {
                    val raw = data[key] as? Map<*, *> ?: return default
                    return NetworkConfig(
                        enabled = raw["enabled"] as? Boolean ?: default.enabled,
                        snippet = raw["snippet"] as? String ?: default.snippet,
                        appSafe = raw["appSafe"] as? Boolean ?: default.appSafe
                    )
                }
                val estimatedCpm = (data["estimatedCpmUsd"] as? Number)?.toDouble()?.takeIf { it >= 0 } ?: 2.0
                @Suppress("UNCHECKED_CAST")
                val adsterraUnitsRaw = (data["adsterraUnits"] as? Map<String, Any?>)
                    ?.mapNotNull { (k, v) -> (v as? Boolean)?.let { k to it } }
                    ?.toMap() ?: emptyMap()
                _config.value = Config(
                    propellerAds = parse("propellerAds"),
                    adsterra = parse("adsterra", default = NetworkConfig(enabled = true, snippet = "", appSafe = true)),
                    adsterraUnits = adsterraUnitsRaw,
                    taboola = parse("taboola"),
                    estimatedCpmUsd = estimatedCpm
                )
            }
    }

    /** True when Adsterra itself is on, appSafe-cleared for this native app, and at least one of its
     *  hardcoded units hasn't been individually disabled by the admin. */
    fun isAdsterraEligible(config: Config): Boolean =
        config.adsterra.enabled && config.adsterra.appSafe &&
            ADSTERRA_UNITS.any { config.adsterraUnits[it.id] != false }

    /** Count of networks eligible to occupy a rotation-pool turn right now (never rendered — see the object KDoc). */
    fun eligibleCount(config: Config): Int {
        val plainNetworks = listOf(config.propellerAds, config.taboola)
            .count { it.enabled && it.snippet.isNotBlank() && it.appSafe }
        return plainNetworks + if (isAdsterraEligible(config)) 1 else 0
    }
}
