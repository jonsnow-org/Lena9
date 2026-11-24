package studio.ai.literium.literium_app.ui.components

import android.view.ViewGroup
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

/** Same Cloudinary auto-quality/format URL rewrite as `VideoPlayer.tsx`'s `optimizeCloudinaryVideoUrl`
 *  — inserts `q_auto,f_auto/` right after `/video/upload/` so Cloudinary picks the lightest
 *  quality/codec for the viewer's device/connection instead of always serving the original file. */
internal fun optimizeCloudinaryVideoUrl(url: String): String {
    val marker = "/video/upload/"
    val idx = url.indexOf(marker)
    if (idx == -1) return url
    val rest = url.substring(idx + marker.length)
    if (rest.startsWith("q_auto") || rest.startsWith("f_auto")) return url
    return url.substring(0, idx + marker.length) + "q_auto,f_auto/" + rest
}

/**
 * The app-wide shared video player — Kotlin port of `VideoPlayer.tsx`, used anywhere a real uploaded
 * (not embedded-YouTube/Vimeo) video plays: ad creatives ([studio.ai.literium.literium_app.ui.ads.AdSlot]),
 * and available for messages/article bodies wherever they later need it. Standard tap-to-play with
 * Media3's own playback controls (matching the web's plain `<video controls>`) — no autoplay, no mute,
 * no loop, since the source never sets any of those either.
 */
@OptIn(UnstableApi::class)
@Composable
fun VideoPlayer(src: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val exoPlayer = remember(src) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(optimizeCloudinaryVideoUrl(src)))
            prepare()
        }
    }

    DisposableEffect(exoPlayer) {
        onDispose { exoPlayer.release() }
    }

    AndroidView(
        modifier = modifier.fillMaxWidth(),
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            }
        }
    )
}
