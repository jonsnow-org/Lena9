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

/**
 * Kotlin port of `VideoEmbed.tsx` — a YouTube/Vimeo `<iframe>` embed, reserved at a 16:9 aspect ratio
 * so surrounding layout never jumps once it loads. Renders nothing for an unparseable [url], matching
 * source's own `if (!parsed) return null`.
 */
@Composable
fun VideoEmbed(url: String, modifier: Modifier = Modifier) {
    val parsed = parseVideoUrl(url) ?: return
    IsolatedWebView(
        url = parsed.embedUrl,
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
    )
}
