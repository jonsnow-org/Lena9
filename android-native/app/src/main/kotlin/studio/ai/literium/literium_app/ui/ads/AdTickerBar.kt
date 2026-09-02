package studio.ai.literium.literium_app.ui.ads

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AdEvent
import studio.ai.literium.literium_app.data.model.AdEventType
import studio.ai.literium.literium_app.data.model.AdPlacementType
import studio.ai.literium.literium_app.data.model.CampaignStatus
import studio.ai.literium.literium_app.data.repository.AdCampaignRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.util.AntiFraudEngine

/**
 * Kotlin/Compose port of `src/components/AdTickerBar.tsx` (131 lines) — the slim, single-line rotating
 * ad strip used where a full [AdSlot] card would be too heavy (spec §5.1a).
 *
 * ⚠️ Behavior note (real source, not the "marquee" description this slice's brief assumed): reading
 * `AdTickerBar.tsx` directly shows it is **not** a horizontally-scrolling marquee anywhere — it is a
 * single-item **crossfade rotator**: one ad shown at a time, fading to transparent over 250ms, swapping
 * to the next eligible campaign, then fading back in, every [rotateMs] (default 5000ms; spec §5.1a
 * confirms "with a brief fade transition between ads"). This file implements that REAL behavior — the
 * same 250ms-out/swap/250ms-in sequence via [animateFloatAsState] — rather than inventing a marquee
 * that does not exist in the product. RTL is handled the same way the rest of this Arabic-first app
 * handles it: a plain [Row] already lays out start-to-end per [androidx.compose.ui.platform.LocalLayoutDirection],
 * so no manual mirroring is needed here (there is no horizontal scroll direction to get right in the
 * first place, since nothing scrolls).
 *
 * Shares [AdPageCounter]/`MAX_ADS_PER_PAGE` with [AdSlot] via `claimAdSlotIndex()`, exactly like
 * `AdTickerBar.tsx` does — ticker instances count against the same 3-ads-per-page budget as `AdSlot`
 * instances, not a separate one.
 *
 * @param slotId free-text tag identifying this ticker's placement in logged ad events — NOT one of the
 *   13 [studio.ai.literium.literium_app.data.model.AdSlotId] values, matching source's own distinction.
 * @param externalPriority true = an eligible external network excludes internal campaigns from
 *   rotation entirely (source's `externalPriority` prop) — when that network actually wins, it renders
 *   via [ExternalAdNetworkView] at this ticker's own [minHeightDp], matching `AdTickerBar.tsx`'s own
 *   `<ExternalAdScript ... heightPx={minHeightPx} />` branch exactly.
 */
@Composable
fun AdTickerBar(
    slotId: String,
    modifier: Modifier = Modifier,
    viewerId: String? = null,
    rotateMs: Long = 5000L,
    externalPriority: Boolean = false,
    minHeightDp: Dp = 56.dp
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    val adCampaignRepository = remember { AdCampaignRepository(firestore) }
    val authRepository = remember { AuthRepository() }
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current

    remember {
        PlatformAdsSettingsStore.ensureStarted(firestore)
        ExternalAdsSettingsStore.ensureStarted(firestore)
    }
    val platformAdsEnabled by PlatformAdsSettingsStore.enabled.collectAsState()
    val externalAdsConfig by ExternalAdsSettingsStore.config.collectAsState()
    val authStateFlow = remember(authRepository) { authRepository.authState() }
    val firebaseUser by authStateFlow.collectAsState(initial = authRepository.currentFirebaseUser)
    val resolvedViewerId = viewerId ?: firebaseUser?.uid

    val campaigns by remember(adCampaignRepository) { adCampaignRepository.observeCampaigns() }
        .collectAsState(initial = emptyList())

    val slotIndex = remember(slotId) { AdPageCounter.claimAdSlotIndex() }

    val active = remember(campaigns, platformAdsEnabled) {
        if (!platformAdsEnabled) {
            emptyList()
        } else {
            campaigns.filter { it.status == CampaignStatus.ACTIVE && it.placementType != AdPlacementType.CATEGORY_SPONSOR }
        }
    }
    val hasEligibleExternalNetwork = platformAdsEnabled && ExternalAdsSettingsStore.eligibleCount(externalAdsConfig) > 0
    // externalPriority=true excludes internal campaigns entirely while a network is eligible, matching
    // source — that network then renders below instead of an internal campaign (see file KDoc).
    val rotationCampaigns = if (externalPriority && hasEligibleExternalNetwork) emptyList() else active

    if (slotIndex >= MAX_ADS_PER_PAGE) return
    if (rotationCampaigns.isEmpty()) {
        if (externalPriority && hasEligibleExternalNetwork) {
            // Same Adsterra special-case as AdSlot.kt — its snippet field is deliberately empty now
            // (hardcoded units live in AdsterraUnits.kt), so it must never be filtered like a plain
            // network with `it.snippet.isNotBlank()`, or it would always be excluded here.
            val plainNetworks = listOf(externalAdsConfig.propellerAds, externalAdsConfig.taboola)
                .filter { it.enabled && it.snippet.isNotBlank() && it.appSafe }
            val adsterraEligible = ExternalAdsSettingsStore.isAdsterraEligible(externalAdsConfig)
            val poolSize = plainNetworks.size + if (adsterraEligible) 1 else 0
            if (poolSize > 0) {
                val idx = slotIndex.mod(poolSize)
                if (idx < plainNetworks.size) {
                    ExternalAdNetworkView(snippet = plainNetworks[idx].snippet, modifier = modifier, heightDp = minHeightDp)
                } else {
                    pickAdsterraUnit(externalAdsConfig.adsterraUnits, slotIndex)?.let { unit ->
                        ExternalAdNetworkView(
                            snippet = unit.snippet,
                            modifier = modifier,
                            heightDp = minHeightDp,
                            widthDp = if (unit.widthPx > 0) unit.widthPx.dp else null
                        )
                    }
                }
            }
        }
        return
    }

    var index by remember { mutableStateOf(0) }
    var visible by remember { mutableStateOf(true) }
    val safeIndex = index % rotationCampaigns.size
    val campaign = rotationCampaigns[safeIndex]
    val alpha by animateFloatAsState(targetValue = if (visible) 1f else 0f, animationSpec = tween(250), label = "adTickerFade")

    LaunchedEffect(rotationCampaigns.size, rotateMs) {
        if (rotationCampaigns.size <= 1) return@LaunchedEffect
        while (isActive) {
            delay(rotateMs)
            visible = false
            delay(250)
            index = (index + 1) % rotationCampaigns.size
            visible = true
        }
    }

    // Impression: logged once per distinct campaign id the ticker rotates into view, matching
    // AdTickerBar.tsx's `loggedIds` Set exactly (source has no viewport/dwell gating here at all,
    // unlike AdSlot.tsx — a ticker item counts as "shown" the moment it rotates in). Still routed
    // through the real AntiFraudEngine for self-view/15s-throttle protection — a deliberate,
    // documented enhancement over the literal source, matching the same choice made in AdSlot.kt.
    val loggedIds = remember { mutableStateOf(emptySet<String>()) }
    LaunchedEffect(campaign.id, resolvedViewerId) {
        if (campaign.id in loggedIds.value) return@LaunchedEffect
        val ctx = AntiFraudEngine.ViewabilityContext(
            campaignId = campaign.id,
            pricingModel = campaign.pricingModel,
            visiblePercentage = 100.0,
            continuousVisibleMs = 1000L,
            pageScrollDepth = 0.0,
            pageDwellTimeSeconds = 1.5,
            userId = resolvedViewerId
        )
        val result = AntiFraudEngine.validateImpression(ctx)
        loggedIds.value = loggedIds.value + campaign.id
        if (result.isValid) {
            adCampaignRepository.logAdEvent(
                AdEvent(
                    campaignId = campaign.id,
                    slotId = slotId,
                    viewerId = resolvedViewerId,
                    eventType = AdEventType.IMPRESSION
                )
            )
        } else {
            result.fraudFlag?.let { adCampaignRepository.logFraudFlag(it) }
        }
    }

    val mountTimeMs = remember { System.currentTimeMillis() }
    fun handleClick() {
        val now = System.currentTimeMillis()
        val elapsedSeconds = (now - mountTimeMs) / 1000.0
        val ctx = AntiFraudEngine.ViewabilityContext(
            campaignId = campaign.id,
            pricingModel = campaign.pricingModel,
            visiblePercentage = 100.0,
            continuousVisibleMs = 1000L,
            pageScrollDepth = 0.0,
            pageDwellTimeSeconds = elapsedSeconds,
            userId = resolvedViewerId,
            clickTimeFromLoadSeconds = elapsedSeconds
        )
        val result = AntiFraudEngine.validateClick(ctx)
        scope.launch {
            if (result.isValid) {
                adCampaignRepository.logAdEvent(
                    AdEvent(
                        campaignId = campaign.id,
                        slotId = slotId,
                        viewerId = resolvedViewerId,
                        eventType = AdEventType.CLICK
                    )
                )
            } else {
                result.fraudFlag?.let { adCampaignRepository.logFraudFlag(it) }
            }
        }
        if (campaign.destinationUrl.isNotBlank()) uriHandler.openUri(campaign.destinationUrl)
    }

    val label = campaign.adText.ifBlank { campaign.description.ifBlank { campaign.campaignName } }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = minHeightDp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .clickable { handleClick() }
            .alpha(alpha)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (campaign.imageUrl.isNotBlank()) {
            AsyncImage(
                model = campaign.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(8.dp))
            )
        }
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = "إعلان",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
