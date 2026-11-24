package studio.ai.literium.literium_app.util

import java.text.Normalizer

/**
 * Arabic-aware search-string normalization — exact port of
 * `src/utils/arabicSearch.ts`'s `normalizeArabicSearch`. For SEARCH
 * purposes only, never for display: naive substring matching silently
 * fails on extremely common Arabic spelling variants (alef forms, ya vs.
 * alef-maksura, ta-marbuta vs. ha, diacritics, stray whitespace), making
 * search feel broken even when the account/article genuinely exists
 * (spec §1.4).
 *
 * Apply this to BOTH the query string and the field being searched before
 * comparing/`contains`-matching them.
 */
object ArabicSearch {

    /**
     * Diacritics (tashkeel) to strip — matches the source regex `/[ً-ٰٟ]/g`
     * byte-for-byte (verified against the actual codepoints in `arabicSearch.ts`, not re-derived by
     * eye — Arabic combining marks render ambiguously/out-of-order in most editors and terminals):
     * U+064B..U+065F (fathatan through the small Quranic annotation marks) as a contiguous range,
     * plus U+0670 (superscript alef) as a separate literal appended to the character class.
     */
    private val TASHKEEL_REGEX = Regex("[ً-ٰٟ]")

    /** Alef variants (hamza-above / hamza-below / madda) unified to bare alef — U+0623, U+0625, U+0622. */
    private val ALEF_VARIANTS_REGEX = Regex("[أإآ]")
    private val WHITESPACE_REGEX = Regex("\\s+")

    /** Alef maksura U+0649 -> ya U+064A. */
    private const val ALEF_MAKSURA = 'ى'
    private const val YA = 'ي'

    /** Ta marbuta U+0629 -> ha U+0647. */
    private const val TA_MARBUTA = 'ة'
    private const val HA = 'ه'

    fun normalize(text: String): String {
        var result = text.lowercase()
        // NFKC normalization — matches JS `String.prototype.normalize('NFKC')`.
        result = Normalizer.normalize(result, Normalizer.Form.NFKC)
        // Strip tashkeel (diacritics).
        result = result.replace(TASHKEEL_REGEX, "")
        // Unify alef forms (hamza-above/below, madda) to bare alef.
        result = result.replace(ALEF_VARIANTS_REGEX, "ا")
        // Alef maksura -> ya.
        result = result.replace(ALEF_MAKSURA, YA)
        // Ta marbuta -> ha.
        result = result.replace(TA_MARBUTA, HA)
        // Collapse runs of whitespace and trim.
        result = result.replace(WHITESPACE_REGEX, " ").trim()
        return result
    }

    /** True if [haystack] contains [needle] after normalizing both. Convenience wrapper for search filters. */
    fun matches(haystack: String, needle: String): Boolean {
        if (needle.isBlank()) return true
        return normalize(haystack).contains(normalize(needle))
    }
}
