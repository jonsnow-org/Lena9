package studio.ai.literium.literium_app.ui.ads

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.startapp.sdk.ads.banner.Banner

/**
 * Start.io (formerly StartApp) integration — a real native-SDK ad network (Banner format only, see
 * final report), distinct from every other network in [ExternalAdsSettingsStore]: those are raw
 * HTML/JS snippets rendered in an isolated WebView, this is Start.io's own Android View
 * ([com.startapp.sdk.ads.banner.Banner]) requesting/rendering its ad natively, no WebView involved.
 *
 * [APP_ID] is Start.io's public per-app identifier (visible in the "My Apps" list of the Start.io
 * publisher dashboard) — not a secret, safe to compile in, same treatment as any other
 * publisher-facing app id already in this codebase (e.g. Firebase's own `google-services.json`).
 * [studio.ai.literium.literium_app.LiteriumApplication] calls
 * `StartAppSDK.initParams(this, APP_ID).setReturnAdsEnabled(false).init()` unconditionally at
 * process start — `setReturnAdsEnabled(false)` specifically disables Start.io's own automatic
 * interstitial-on-app-resume behavior, so nothing from this network ever appears outside the one
 * spot this file renders, which is itself gated live by the admin's Firestore toggle
 * ([ExternalAdsSettingsStore.Config.startIo]) exactly like PropellerAds/Adsterra/Taboola.
 */
internal object StartIoAds {
    const val APP_ID: String = "208464217"
}

/**
 * Renders one live Start.io banner. Wrapped in a fixed-height, full-width [Box] purely for layout
 * stability in a scrolling list (matches every other ad slot in this app reserving its own space
 * before its creative loads) — [Banner] sizes and refreshes its own creative internally.
 */
@Composable
internal fun StartIoBannerView(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxWidth().wrapContentHeight(),
        contentAlignment = Alignment.Center
    ) {
        AndroidView(factory = { ctx -> Banner(ctx) })
    }
}
