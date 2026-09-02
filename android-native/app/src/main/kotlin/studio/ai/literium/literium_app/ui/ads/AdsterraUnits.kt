package studio.ai.literium.literium_app.ui.ads

/**
 * Kotlin port of `src/constants/adsterraUnits.ts` — the same real Adsterra ad-unit codes the owner
 * pasted from their literium.ai.studio Adsterra dashboard, hardcoded here exactly like the web side
 * instead of a single admin-pasted snippet (the old single-textarea design only fit one ad size at a
 * time). All 7 units are static-size "Banner"/"Native Banner" formats, not the disruptive Social
 * Bar/In-Page Push/Popunder types — safe to enable by default. Keep this list byte-for-byte identical
 * to the web catalog whenever either changes; both read the same `adsterraUnits` map from the same
 * `settings/externalAds` Firestore document.
 */
internal data class AdsterraUnit(
    val id: String,
    val label: String,
    val widthPx: Int,
    val heightPx: Int,
    val snippet: String
)

internal val ADSTERRA_UNITS: List<AdsterraUnit> = listOf(
    AdsterraUnit(
        id = "160x300",
        label = "شريط جانبي 160×300",
        widthPx = 160,
        heightPx = 300,
        snippet = """
            <script>
              atOptions = {
                'key' : '750f3f7da6bb12c0bb3749a1dfb47e2e',
                'format' : 'iframe',
                'height' : 300,
                'width' : 160,
                'params' : {}
              };
            </script>
            <script src="https://www.highrevenueformat.com/750f3f7da6bb12c0bb3749a1dfb47e2e/invoke.js"></script>
        """.trimIndent()
    ),
    AdsterraUnit(
        id = "160x600",
        label = "شريط طويل 160×600",
        widthPx = 160,
        heightPx = 600,
        snippet = """
            <script>
              atOptions = {
                'key' : '5af425b2959139fbe64cfdf1a3cd7fa0',
                'format' : 'iframe',
                'height' : 600,
                'width' : 160,
                'params' : {}
              };
            </script>
            <script src="https://www.highrevenueformat.com/5af425b2959139fbe64cfdf1a3cd7fa0/invoke.js"></script>
        """.trimIndent()
    ),
    AdsterraUnit(
        id = "300x250",
        label = "مربع متوسط 300×250",
        widthPx = 300,
        heightPx = 250,
        snippet = """
            <script>
              atOptions = {
                'key' : '52da6e1ab87e40b8f1e3a8b7c19c4dd5',
                'format' : 'iframe',
                'height' : 250,
                'width' : 300,
                'params' : {}
              };
            </script>
            <script src="https://www.highrevenueformat.com/52da6e1ab87e40b8f1e3a8b7c19c4dd5/invoke.js"></script>
        """.trimIndent()
    ),
    AdsterraUnit(
        id = "320x50",
        label = "شريط جوال 320×50",
        widthPx = 320,
        heightPx = 50,
        snippet = """
            <script>
              atOptions = {
                'key' : '91104547eb3766f79b5d980c3a1c0b3f',
                'format' : 'iframe',
                'height' : 50,
                'width' : 320,
                'params' : {}
              };
            </script>
            <script src="https://www.highrevenueformat.com/91104547eb3766f79b5d980c3a1c0b3f/invoke.js"></script>
        """.trimIndent()
    ),
    AdsterraUnit(
        id = "468x60",
        label = "شريط أفقي 468×60",
        widthPx = 468,
        heightPx = 60,
        snippet = """
            <script>
              atOptions = {
                'key' : '7c5d724a36c9eefbb28ba1004ebc8bd9',
                'format' : 'iframe',
                'height' : 60,
                'width' : 468,
                'params' : {}
              };
            </script>
            <script src="https://www.highrevenueformat.com/7c5d724a36c9eefbb28ba1004ebc8bd9/invoke.js"></script>
        """.trimIndent()
    ),
    AdsterraUnit(
        id = "728x90",
        label = "شريط عريض 728×90",
        widthPx = 728,
        heightPx = 90,
        snippet = """
            <script>
              atOptions = {
                'key' : '6a7a8f774ccb9fcb8cde77b43dfff1c3',
                'format' : 'iframe',
                'height' : 90,
                'width' : 728,
                'params' : {}
              };
            </script>
            <script src="https://www.highrevenueformat.com/6a7a8f774ccb9fcb8cde77b43dfff1c3/invoke.js"></script>
        """.trimIndent()
    ),
    AdsterraUnit(
        id = "native_banner",
        label = "بطاقات صور مقترحة (Native Banner)",
        widthPx = 0,
        heightPx = 240,
        snippet = """
            <script async="async" data-cfasync="false" src="https://pl31032517.profitableratecpmnetwork.com/44873569efe1495c898068e4aecde4e9/invoke.js"></script>
            <div id="container-44873569efe1495c898068e4aecde4e9"></div>
        """.trimIndent()
    )
)

/** Mirrors `pickAdsterraUnit` from `src/constants/adsterraUnits.ts` — same rotation-seed selection
 *  among only the units the admin hasn't individually disabled, or null if all are disabled. */
internal fun pickAdsterraUnit(unitsEnabled: Map<String, Boolean>, seed: Int): AdsterraUnit? {
    val enabled = ADSTERRA_UNITS.filter { unitsEnabled[it.id] != false }
    if (enabled.isEmpty()) return null
    val idx = seed.mod(enabled.size)
    return enabled[idx]
}
