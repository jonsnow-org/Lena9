package studio.ai.literium.literium_app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Kotlin port of `src/constants/backgroundPresets.ts` — the admin-selectable live aesthetic
 * background (`settings/theme` Firestore doc's `backgroundPreset` field). Photo presets use the
 * exact same Unsplash [imageUrl] the web loads; the three CSS-gradient-only presets
 * ([gradientColors]) are approximated as a single Compose linear gradient across their same
 * accent colors — `aurora_mesh`'s real 4-layer radial-mesh CSS has no direct single-Brush
 * equivalent, so its Kotlin rendering is a faithful-in-palette, not pixel-exact, approximation;
 * `midnight_gradient`/`marble_luxury` were already linear on the web and port exactly.
 * [overlayLight]/[overlayDark] are the same translucent readability overlay colors, applied over
 * the image/gradient depending on the active light/dark mode, exactly as the web does.
 */
data class BackgroundPresetDefinition(
    val key: String,
    val label: String,
    val labelEn: String,
    val description: String,
    val imageUrl: String?,
    val gradientColors: List<Color>?,
    val overlayLight: Color,
    val overlayDark: Color
)

const val DEFAULT_BACKGROUND_PRESET: String = "none"

val BACKGROUND_PRESETS: Map<String, BackgroundPresetDefinition> = mapOf(
    "none" to BackgroundPresetDefinition(
        key = "none",
        label = "بدون خلفية (افتراضي)",
        labelEn = "None (Default Clean)",
        description = "الخلفية الافتراضية النقية والهادئة المناسبة لجميع الشاشات.",
        imageUrl = null,
        gradientColors = null,
        overlayLight = Color.Transparent,
        overlayDark = Color.Transparent
    ),
    "library_warm" to BackgroundPresetDefinition(
        key = "library_warm",
        label = "مكتبة كلاسيكية عريقة",
        labelEn = "Classic Library",
        description = "أجواء مكتبة أدبية دافئة وهادئة تضفي هيبة وفخامة للقرّاء والكتّاب.",
        imageUrl = "https://images.unsplash.com/photo-1507842229451-7f01be7ff612?w=1920&auto=format&fit=crop&q=80",
        gradientColors = null,
        overlayLight = Color(255, 255, 255, 240),
        overlayDark = Color(2, 6, 23, 235)
    ),
    "parchment_manuscript" to BackgroundPresetDefinition(
        key = "parchment_manuscript",
        label = "ورق ومخطوطات عتيقة",
        labelEn = "Vintage Parchment",
        description = "ملمس أدبي تاريخي ناعم مستوحى من المخطوطات القديمة وأوراق البردي.",
        imageUrl = "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1920&auto=format&fit=crop&q=80",
        gradientColors = null,
        overlayLight = Color(254, 252, 247, 237),
        overlayDark = Color(15, 23, 42, 235)
    ),
    "celestial_night" to BackgroundPresetDefinition(
        key = "celestial_night",
        label = "سماء وسديم ليلي هادئ",
        labelEn = "Celestial Night",
        description = "أفق ليلي وسديم كوني خافت مريح للعين في جلسات القراءة والتأمل الليلية.",
        imageUrl = "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1920&auto=format&fit=crop&q=80",
        gradientColors = null,
        overlayLight = Color(248, 250, 252, 240),
        overlayDark = Color(2, 6, 23, 230)
    ),
    "arabesque_geometry" to BackgroundPresetDefinition(
        key = "arabesque_geometry",
        label = "زخارف هندسية فاخرة",
        labelEn = "Arabesque Luxury",
        description = "أنماط هندسية معمارية راقية بطابع تراثي معاصر يعزز أصالة المنصة.",
        imageUrl = "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1920&auto=format&fit=crop&q=80",
        gradientColors = null,
        overlayLight = Color(255, 255, 255, 237),
        overlayDark = Color(15, 23, 42, 232)
    ),
    "minimalist_gradient" to BackgroundPresetDefinition(
        key = "minimalist_gradient",
        label = "أمواج شفق أدبي ناعم",
        labelEn = "Literary Aurora",
        description = "تدرجات لونية هادئة وشفق ضوئي سينمائي خفيف يمنح الموقع حيوية بصرية.",
        imageUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&auto=format&fit=crop&q=80",
        gradientColors = null,
        overlayLight = Color(255, 255, 255, 235),
        overlayDark = Color(2, 6, 23, 224)
    ),
    "emerald_forest" to BackgroundPresetDefinition(
        key = "emerald_forest",
        label = "واحة زمردية مريحة",
        labelEn = "Emerald Serenity",
        description = "طبيعة زمردية ضبابية تمنح إحساساً بالسكينة والتركيز أثناء تصفح المقالات.",
        imageUrl = "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&auto=format&fit=crop&q=80",
        gradientColors = null,
        overlayLight = Color(244, 249, 245, 237),
        overlayDark = Color(2, 18, 10, 230)
    ),
    "aurora_mesh" to BackgroundPresetDefinition(
        key = "aurora_mesh",
        label = "توهّج الشفق الأدبي",
        labelEn = "Literary Aurora Mesh",
        description = "تدرّج ألوان ناعم متعدد الطبقات بروح عصرية راقية — بلا أي صورة، يظهر فوراً دون تحميل.",
        imageUrl = null,
        gradientColors = listOf(Color(168, 85, 247, 115), Color(56, 189, 248, 102), Color(236, 72, 153, 77), Color(0xFF0F172A), Color(0xFF1E1B4B)),
        overlayLight = Color(255, 255, 255, 230),
        overlayDark = Color(2, 6, 23, 209)
    ),
    "midnight_gradient" to BackgroundPresetDefinition(
        key = "midnight_gradient",
        label = "عمق ليلي متدرّج",
        labelEn = "Midnight Depth",
        description = "تدرّج داكن هادئ يريح العين في القراءة الليلية الطويلة — تدرّج CSS خالص بلا صورة.",
        imageUrl = null,
        gradientColors = listOf(Color(0xFF020617), Color(0xFF0F172A), Color(0xFF1E293B)),
        overlayLight = Color(255, 255, 255, 237),
        overlayDark = Color(2, 6, 23, 191)
    ),
    "marble_luxury" to BackgroundPresetDefinition(
        key = "marble_luxury",
        label = "رخام فاخر دافئ",
        labelEn = "Warm Marble Luxury",
        description = "درجات رخام كريمية فاخرة وناعمة تمنح إحساساً بالفخامة الهادئة — تدرّج CSS خالص بلا صورة.",
        imageUrl = null,
        gradientColors = listOf(Color(0xFFFDFBF7), Color(0xFFF3EDE3), Color(0xFFE8DDD0), Color(0xFFF5F0E8)),
        overlayLight = Color(255, 255, 255, 230),
        overlayDark = Color(2, 6, 23, 237)
    ),
)

fun isValidBackgroundPreset(value: String?): Boolean = value != null && BACKGROUND_PRESETS.containsKey(value)
