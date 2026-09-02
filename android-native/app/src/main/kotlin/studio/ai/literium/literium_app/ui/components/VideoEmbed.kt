package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp

data class ParsedVideo(val provider: String, val videoId: String, val embedUrl: String)

private val YOUTUBE_PATTERNS = listOf(
    Regex("""(?:youtube\.com/watch\?v=)([A-Za-z0-9_-]{11})"""),
    Regex("""(?:youtu\.be/)([A-Za-z0-9_-]{11})"""),
    Regex("""(?:youtube\.com/embed/)([A-Za-z0-9_-]{11})"""),
    Regex("""(?:youtube\.com/shorts/)([A-Za-z0-9_-]{11})""")
)
private val VIMEO_PATTERN = Regex("""vimeo\.com/(?:video/)?(\d+)""")

/** Kotlin port of `src/utils/videoEmbed.ts`'s `parseVideoUrl` — same YouTube/Vimeo pattern set, same
 *  `youtube-nocookie.com`/`player.vimeo.com` embed URLs. */
fun parseVideoUrl(url: String): ParsedVideo? {
    val clean = url.trim()
    if (clean.isEmpty()) return null

    for (pattern in YOUTUBE_PATTERNS) {
        pattern.find(clean)?.groupValues?.get(1)?.let { id ->
            return ParsedVideo("youtube", id, "https://www.youtube-nocookie.com/embed/$id?rel=0")
        }
    }
    VIMEO_PATTERN.find(clean)?.groupValues?.get(1)?.let { id ->
        return ParsedVideo("vimeo", id, "https://player.vimeo.com/video/$id")
    }
    return null
}

/** Production origin the video-embed HTML wrapper is loaded with — see [VideoEmbed]'s KDoc for why
 *  this, not `null`, is required for YouTube playback to work at all. */
private const val PRODUCTION_ORIGIN = "https://literium.ai.studio/"

/**
 * Kotlin port of `VideoEmbed.tsx` — a YouTube/Vimeo `<iframe>` embed, reserved at a 16:9 aspect ratio
 * so surrounding layout never jumps once it loads. Renders nothing for an unparseable [url], matching
 * source's own `if (!parsed) return null`.
 *
 * Wraps [ParsedVideo.embedUrl] in a real `<iframe>` inside a tiny host page, loaded via
 * [IsolatedWebView]'s `html`+`baseUrl` path rather than navigating the WebView directly to the embed
 * URL (`url =`) — a real-device bug report ("YouTube error 153: خطأ في إعدادات مشغل الفيديو"): loading
 * the embed URL as the WebView's own top-level document, the way the `url` path does, gives YouTube's
 * player no parent-frame/origin context at all (effectively `about:blank`), which YouTube's embed
 * player rejects outright. `VideoEmbed.tsx` on web never hits this because its `<iframe src=embedUrl>`
 * is genuinely nested inside the real literium.ai.studio page — this reproduces that exact structure
 * natively, with [PRODUCTION_ORIGIN] as the iframe's real parent origin.
 */
@Composable
fun VideoEmbed(url: String, modifier: Modifier = Modifier) {
    val parsed = parseVideoUrl(url) ?: return
    val html = """
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>html,body{margin:0;padding:0;background:#0f172a;overflow:hidden}
        iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
        </head><body>
        <iframe src="${parsed.embedUrl}" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </body></html>
    """.trimIndent()
    IsolatedWebView(
        html = html,
        baseUrl = PRODUCTION_ORIGIN,
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
    )
}
