package studio.ai.literium.literium_app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.data.model.ThemeSettingsData
import studio.ai.literium.literium_app.data.repository.AdminRepository

/** Live handle to the currently-active admin color/background preset, for any composable that needs
 *  the raw definitions beyond what `MaterialTheme.colorScheme` alone carries (e.g. [LocalBackgroundPreset]
 *  consumers painting the page-background layer behind [studio.ai.literium.literium_app.ui.components.MainScaffold]). */
val LocalBackgroundPreset = compositionLocalOf { BACKGROUND_PRESETS.getValue(DEFAULT_BACKGROUND_PRESET) }

/** The resolved light/dark boolean [LiteriumTheme] actually built its [ColorScheme] with — lets
 *  [LiveBackgroundLayer] pick the matching overlay without re-deriving light/dark itself (which could
 *  otherwise disagree with an explicit per-device dark-mode override from [studio.ai.literium.literium_app.data.local.UserPreferencesRepository]). */
val LocalIsDarkTheme = compositionLocalOf { false }

/**
 * `settings/theme` (spec's live admin color/background system — `subscribeToThemePreset` in
 * `firebase.ts`/`firestoreService.ts`) drives [MaterialTheme]'s primary/secondary color roles here,
 * live, for every signed-in AND guest user (public Firestore read, matching the web exactly) — any
 * admin change via [studio.ai.literium.literium_app.ui.screens.admin.tabs.SettingsTab] recolors every
 * connected device within the same `onSnapshot` tick, no republish or app update needed.
 *
 * Scope note on `brand-*` vs `teal-*`: the web's Tailwind config splits color usage into two families
 * — the ~30 files using `bg-brand-*`/`text-brand-*` (nav highlights, admin tabs, badges, primary CTAs
 * across most of the app) follow the *admin-selected* [ThemePresetDefinition], which is what
 * [buildColorScheme] below maps onto `primary`/`secondary`/`tertiary`/their container roles; the
 * smaller set of screens that literally hardcode `teal-600` in the web (auth flow buttons —
 * `AuthModal`/`ResetPasswordModal`/etc.) is a fixed brand color independent of the admin picker, and
 * stays exactly as already built here: [BrandTeal]/[BrandTealLight] Kotlin constants used directly by
 * those specific screens, untouched by this live system, matching the web 1:1.
 */
@Composable
fun LiteriumTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    adminRepository: AdminRepository = remember { AdminRepository() },
    content: @Composable () -> Unit
) {
    val themeSettings by adminRepository.observeThemeSettings()
        .collectAsState(initial = ThemeSettingsData())

    val presetKey = themeSettings.preset?.takeIf { isValidThemePreset(it) } ?: DEFAULT_THEME_PRESET
    val preset = THEME_PRESETS.getValue(presetKey)
    val backgroundKey = themeSettings.backgroundPreset?.takeIf { isValidBackgroundPreset(it) } ?: DEFAULT_BACKGROUND_PRESET
    val background = BACKGROUND_PRESETS.getValue(backgroundKey)

    CompositionLocalProvider(LocalBackgroundPreset provides background, LocalIsDarkTheme provides darkTheme) {
        MaterialTheme(
            colorScheme = buildColorScheme(preset, darkTheme),
            typography = LiteriumTypography,
            content = content
        )
    }
}

/** Tailwind's own light/dark shade-role convention (600/100/900 for light mode, 400/900/100 for dark
 *  mode) — the same pairing every already-built screen already assumes implicitly via
 *  `MaterialTheme.colorScheme.primary`/`primaryContainer`. */
private fun buildColorScheme(preset: ThemePresetDefinition, darkTheme: Boolean): ColorScheme {
    val s = preset.shades
    return if (darkTheme) {
        darkColorScheme(
            primary = s.shade400,
            onPrimary = s.shade950,
            primaryContainer = s.shade900,
            onPrimaryContainer = s.shade100,
            secondary = BrandTealLight,
            tertiary = BrandAmber,
            background = DarkBackground,
            surface = DarkSurface
        )
    } else {
        lightColorScheme(
            primary = s.shade600,
            onPrimary = Color.White,
            primaryContainer = s.shade100,
            onPrimaryContainer = s.shade900,
            secondary = BrandTeal,
            tertiary = BrandAmber,
            background = LightBackground,
            surface = LightSurface
        )
    }
}

val LiteriumTypography = androidx.compose.material3.Typography(
    bodyLarge = androidx.compose.ui.text.TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = androidx.compose.ui.text.TextStyle(fontSize = 13.sp, lineHeight = 19.sp),
    titleLarge = androidx.compose.ui.text.TextStyle(fontSize = 20.sp, lineHeight = 26.sp)
)
