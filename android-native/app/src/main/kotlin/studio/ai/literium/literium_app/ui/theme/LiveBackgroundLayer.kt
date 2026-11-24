package studio.ai.literium.literium_app.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage

/**
 * Renders [LocalBackgroundPreset]'s active admin-selected background (spec's `applyBackgroundPreset` /
 * `BACKGROUND_PRESETS`) behind [content] — a full-bleed photo or gradient layer with a translucent
 * readability overlay on top, exactly mirroring the web's `#literium-theme-bg-layer` +
 * `#literium-theme-overlay-layer` pair. Only meaningfully visible where [content] itself leaves gaps
 * (page margins, the space around opaque cards), matching the web's own visual behavior — individual
 * cards/surfaces stay opaque (`bg-white dark:bg-slate-900`) on both platforms.
 */
@Composable
fun LiveBackgroundLayer(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val preset = LocalBackgroundPreset.current
    val isDark = LocalIsDarkTheme.current

    Box(modifier = modifier.fillMaxSize()) {
        if (preset.key != "none") {
            when {
                preset.imageUrl != null -> {
                    AsyncImage(
                        model = preset.imageUrl,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }
                preset.gradientColors != null -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Brush.verticalGradient(preset.gradientColors))
                    )
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(if (isDark) preset.overlayDark else preset.overlayLight)
            )
        }
        content()
    }
}
