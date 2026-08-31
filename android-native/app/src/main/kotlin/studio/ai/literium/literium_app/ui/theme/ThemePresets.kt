package studio.ai.literium.literium_app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Kotlin port of `src/constants/themePresets.ts` — the admin-selectable live color palette
 * (`settings/theme` Firestore doc's `preset` field). Every shade value below was computed by a
 * deterministic OKLCH->sRGB conversion (CSS Color Module 4's standard OKLab matrices) from the
 * exact same oklch(...) triples the web source declares — not eyeballed or approximated.
 */
data class ThemeShadeScale(
    val shade50: Color,
    val shade100: Color,
    val shade200: Color,
    val shade300: Color,
    val shade400: Color,
    val shade500: Color,
    val shade600: Color,
    val shade700: Color,
    val shade800: Color,
    val shade900: Color,
    val shade950: Color,
)

data class ThemePresetDefinition(
    val key: String,
    val label: String,
    val labelEn: String,
    val swatch: Color,
    val shades: ThemeShadeScale
)

const val DEFAULT_THEME_PRESET: String = "purple"

val THEME_PRESETS: Map<String, ThemePresetDefinition> = mapOf(
    "purple" to ThemePresetDefinition(
        key = "purple",
        label = "بنفسجي (افتراضي)",
        labelEn = "Purple (Default)",
        swatch = Color(0xFF9333EA),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFFAF5FF),
            shade100 = Color(0xFFF3E8FF),
            shade200 = Color(0xFFE9D4FF),
            shade300 = Color(0xFFDAB2FF),
            shade400 = Color(0xFFC27AFF),
            shade500 = Color(0xFFAD46FF),
            shade600 = Color(0xFF9810FA),
            shade700 = Color(0xFF8200DB),
            shade800 = Color(0xFF6E11B0),
            shade900 = Color(0xFF59168B),
            shade950 = Color(0xFF3C0366),
        )
    ),
    "red" to ThemePresetDefinition(
        key = "red",
        label = "أحمر",
        labelEn = "Red",
        swatch = Color(0xFFDC2626),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFFEF2F2),
            shade100 = Color(0xFFFFE2E2),
            shade200 = Color(0xFFFFC9C9),
            shade300 = Color(0xFFFFA2A2),
            shade400 = Color(0xFFFF6467),
            shade500 = Color(0xFFFB2C36),
            shade600 = Color(0xFFE7000B),
            shade700 = Color(0xFFC10007),
            shade800 = Color(0xFF9F0712),
            shade900 = Color(0xFF82181A),
            shade950 = Color(0xFF460809),
        )
    ),
    "amber" to ThemePresetDefinition(
        key = "amber",
        label = "أصفر ذهبي",
        labelEn = "Amber",
        swatch = Color(0xFFD97706),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFFFFBEB),
            shade100 = Color(0xFFFEF3C6),
            shade200 = Color(0xFFFEE685),
            shade300 = Color(0xFFFFD230),
            shade400 = Color(0xFFFFB900),
            shade500 = Color(0xFFFE9A00),
            shade600 = Color(0xFFE17100),
            shade700 = Color(0xFFBB4D00),
            shade800 = Color(0xFF973C00),
            shade900 = Color(0xFF7B3306),
            shade950 = Color(0xFF461901),
        )
    ),
    "green" to ThemePresetDefinition(
        key = "green",
        label = "أخضر",
        labelEn = "Green",
        swatch = Color(0xFF16A34A),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFF0FDF4),
            shade100 = Color(0xFFDCFCE7),
            shade200 = Color(0xFFB9F8CF),
            shade300 = Color(0xFF7BF1A8),
            shade400 = Color(0xFF05DF72),
            shade500 = Color(0xFF00C950),
            shade600 = Color(0xFF00A63E),
            shade700 = Color(0xFF008236),
            shade800 = Color(0xFF016630),
            shade900 = Color(0xFF0D542B),
            shade950 = Color(0xFF032E15),
        )
    ),
    "blue" to ThemePresetDefinition(
        key = "blue",
        label = "أزرق",
        labelEn = "Blue",
        swatch = Color(0xFF2563EB),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFEFF6FF),
            shade100 = Color(0xFFDBEAFE),
            shade200 = Color(0xFFBEDBFF),
            shade300 = Color(0xFF8EC5FF),
            shade400 = Color(0xFF51A2FF),
            shade500 = Color(0xFF2B7FFF),
            shade600 = Color(0xFF155DFC),
            shade700 = Color(0xFF1447E6),
            shade800 = Color(0xFF193CB8),
            shade900 = Color(0xFF1C398E),
            shade950 = Color(0xFF162456),
        )
    ),
    "cyan" to ThemePresetDefinition(
        key = "cyan",
        label = "سماوي",
        labelEn = "Sky Blue",
        swatch = Color(0xFF0891B2),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFECFEFF),
            shade100 = Color(0xFFCEFAFE),
            shade200 = Color(0xFFA2F4FD),
            shade300 = Color(0xFF53EAFD),
            shade400 = Color(0xFF00D3F2),
            shade500 = Color(0xFF00B8DB),
            shade600 = Color(0xFF0092B8),
            shade700 = Color(0xFF007595),
            shade800 = Color(0xFF005F78),
            shade900 = Color(0xFF104E64),
            shade950 = Color(0xFF053345),
        )
    ),
    "rose" to ThemePresetDefinition(
        key = "rose",
        label = "وردي",
        labelEn = "Rose",
        swatch = Color(0xFFE11D48),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFFFF1F2),
            shade100 = Color(0xFFFFE4E6),
            shade200 = Color(0xFFFFCCD3),
            shade300 = Color(0xFFFFA1AD),
            shade400 = Color(0xFFFF637E),
            shade500 = Color(0xFFFF2056),
            shade600 = Color(0xFFEC003F),
            shade700 = Color(0xFFC70036),
            shade800 = Color(0xFFA50036),
            shade900 = Color(0xFF8B0836),
            shade950 = Color(0xFF4D0218),
        )
    ),
    "gold" to ThemePresetDefinition(
        key = "gold",
        label = "ذهبي",
        labelEn = "Gold",
        swatch = Color(0xFFC8952A),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFFFF9EB),
            shade100 = Color(0xFFFFF0CC),
            shade200 = Color(0xFFFFE09B),
            shade300 = Color(0xFFFECD5C),
            shade400 = Color(0xFFF5B000),
            shade500 = Color(0xFFE79400),
            shade600 = Color(0xFFD07100),
            shade700 = Color(0xFFAB4E00),
            shade800 = Color(0xFF893C00),
            shade900 = Color(0xFF6F3000),
            shade950 = Color(0xFF3E1602),
        )
    ),
    "silver" to ThemePresetDefinition(
        key = "silver",
        label = "فضي",
        labelEn = "Silver",
        swatch = Color(0xFF6B7C93),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFF5F9FC),
            shade100 = Color(0xFFEAF1F8),
            shade200 = Color(0xFFD6E1ED),
            shade300 = Color(0xFFB9C9DC),
            shade400 = Color(0xFF92A7C1),
            shade500 = Color(0xFF7188A7),
            shade600 = Color(0xFF556A89),
            shade700 = Color(0xFF41536E),
            shade800 = Color(0xFF303E53),
            shade900 = Color(0xFF222B3D),
            shade950 = Color(0xFF0B111E),
        )
    ),
    "orange" to ThemePresetDefinition(
        key = "orange",
        label = "برتقالي",
        labelEn = "Orange",
        swatch = Color(0xFFEA580C),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFFFF7ED),
            shade100 = Color(0xFFFFEDD4),
            shade200 = Color(0xFFFFD6A7),
            shade300 = Color(0xFFFFB86A),
            shade400 = Color(0xFFFF8904),
            shade500 = Color(0xFFFF6900),
            shade600 = Color(0xFFF54900),
            shade700 = Color(0xFFCA3500),
            shade800 = Color(0xFF9F2D00),
            shade900 = Color(0xFF7E2A0C),
            shade950 = Color(0xFF441306),
        )
    ),
    "bronze" to ThemePresetDefinition(
        key = "bronze",
        label = "برونزي",
        labelEn = "Bronze",
        swatch = Color(0xFFA15B34),
        shades = ThemeShadeScale(
            shade50 = Color(0xFFFEF2EC),
            shade100 = Color(0xFFFDE2D4),
            shade200 = Color(0xFFFAC8B1),
            shade300 = Color(0xFFEFA68A),
            shade400 = Color(0xFFDA7F63),
            shade500 = Color(0xFFBE5D47),
            shade600 = Color(0xFF9E4236),
            shade700 = Color(0xFF7E3029),
            shade800 = Color(0xFF612420),
            shade900 = Color(0xFF481B1A),
            shade950 = Color(0xFF220808),
        )
    ),
)

fun isValidThemePreset(value: String?): Boolean = value != null && THEME_PRESETS.containsKey(value)
