package studio.ai.literium.literium_app.ui.ads

import android.content.Context
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.startapp.sdk.adsbase.StartAppSDK
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
 *
 * ⚠️ [ensureInitialized] — NOT [studio.ai.literium.literium_app.LiteriumApplication] — owns calling
 * `StartAppSDK.initParams(...).init()`, and only [StartIoBannerView] ever calls it. This used to run
 * unconditionally in `Application.onCreate()`; that made Start.io's own mandatory privacy-consent
 * screen pop up full-screen for every single user on every cold start, regardless of the admin's
 * Firestore toggle — because SDK *initialization* (not ad display) is what triggers that consent
 * screen, and the toggle only ever gated whether [StartIoBannerView] gets composed, not whether the
 * SDK object existed. Moving the call here ties the SDK's entire lifecycle (init, consent prompt, any
 * data collection) to the exact same gate as its visible banner: [StartIoBannerView] is only ever
 * composed by [AdSlot]/[AdTickerBar] when `ExternalAdsSettingsStore.Config.startIo` is true AND the
 * fair-rotation math actually selects it — so with the admin toggle off (the default), this network
 * now does *nothing at all*, matching every other network's off-by-default behavior.
 */
internal object StartIoAds {
    const val APP_ID: String = "208464217"

    @Volatile
    private var initialized = false

    @Synchronized
    fun ensureInitialized(context: Context) {
        if (initialized) return
        initialized = true
        StartAppSDK.initParams(context.applicationContext, APP_ID)
            .setReturnAdsEnabled(false)
            .init()
    }
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
        AndroidView(factory = { ctx ->
            StartIoAds.ensureInitialized(ctx)
            Banner(ctx)
        })
    }
}
