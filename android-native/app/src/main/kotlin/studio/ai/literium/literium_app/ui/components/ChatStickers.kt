package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.core.graphics.PathParser
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * Literium's custom branded chat stickers — exact-fidelity Compose port of
 * `src/components/ChatStickers.tsx` (§ "SPEC OF RECORD" cross-reference for
 * the messaging screens). Verified against source line-for-line: every SVG
 * `<path>` `d` string below is copied verbatim from `ChatStickers.tsx` and
 * parsed with [androidx.core.graphics.PathParser] (the same mini-language
 * Android vector drawables use, a strict superset of what these paths
 * actually use — M/C/L/Z), so the rendered geometry is pixel-identical to
 * the web version, not a hand-redrawn approximation. `<circle>`/`<rect>`/
 * `<ellipse>`/`<text>` primitives are drawn with native Compose DrawScope
 * calls instead of being routed through the path parser, since they aren't
 * `<path>` elements in the source SVG either.
 *
 * DECISION NOTE (see final report): these are simple flat-design procedural
 * faces (source's own doc comment says so explicitly — "ليست صوراً
 * فوتوغرافية حقيقية"), not photographic stock art, so a faithful geometric
 * port was tractable within scope. This was chosen over an emoji fallback
 * specifically to preserve the "custom Literium-branded sticker" identity
 * (the small teal "ل" badge in [brandBadgeOps] has no emoji equivalent).
 */
enum class StickerGender { MALE, FEMALE }

enum class StickerMood {
    HAPPY, LAUGHING, LOVE, WINK, COOL, SAD, SURPRISED, THINKING, BLUSHING, SLEEPY, ANGRY, CALM
}

data class StickerMeta(
    val id: String,
    val label: String,
    val gender: StickerGender,
    val mood: StickerMood
)

/** Exact port of `CHAT_STICKERS` — same 16 ids/labels/gender/mood, same order. */
object ChatStickers {
    val ALL: List<StickerMeta> = listOf(
        StickerMeta("f_happy", "سعيدة", StickerGender.FEMALE, StickerMood.HAPPY),
        StickerMeta("m_happy", "سعيد", StickerGender.MALE, StickerMood.HAPPY),
        StickerMeta("f_laughing", "ضاحكة", StickerGender.FEMALE, StickerMood.LAUGHING),
        StickerMeta("m_laughing", "ضاحك", StickerGender.MALE, StickerMood.LAUGHING),
        StickerMeta("f_love", "معجبة", StickerGender.FEMALE, StickerMood.LOVE),
        StickerMeta("m_love", "معجب", StickerGender.MALE, StickerMood.LOVE),
        StickerMeta("f_wink", "غمزة", StickerGender.FEMALE, StickerMood.WINK),
        StickerMeta("m_cool", "رايق", StickerGender.MALE, StickerMood.COOL),
        StickerMeta("f_sad", "حزينة", StickerGender.FEMALE, StickerMood.SAD),
        StickerMeta("m_sad", "حزين", StickerGender.MALE, StickerMood.SAD),
        StickerMeta("f_surprised", "متفاجئة", StickerGender.FEMALE, StickerMood.SURPRISED),
        StickerMeta("m_thinking", "يفكر", StickerGender.MALE, StickerMood.THINKING),
        StickerMeta("f_blushing", "خجولة", StickerGender.FEMALE, StickerMood.BLUSHING),
        StickerMeta("m_sleepy", "نعسان", StickerGender.MALE, StickerMood.SLEEPY),
        StickerMeta("f_angry", "غاضبة", StickerGender.FEMALE, StickerMood.ANGRY),
        StickerMeta("m_calm", "هادئ", StickerGender.MALE, StickerMood.CALM)
    )

    private val byId = ALL.associateBy { it.id }

    fun find(id: String): StickerMeta? = byId[id]

    private val skinTones: Map<String, Color> = mapOf(
        "f_happy" to Color(0xFFF1C27D), "m_happy" to Color(0xFFE8B08A),
        "f_laughing" to Color(0xFFC68642), "m_laughing" to Color(0xFFF1C27D),
        "f_love" to Color(0xFFE8B08A), "m_love" to Color(0xFFC68642),
        "f_wink" to Color(0xFFF1C27D), "m_cool" to Color(0xFF8D5524),
        "f_sad" to Color(0xFFE8B08A), "m_sad" to Color(0xFFF1C27D),
        "f_surprised" to Color(0xFFC68642), "m_thinking" to Color(0xFFE8B08A),
        "f_blushing" to Color(0xFFF1C27D), "m_sleepy" to Color(0xFF8D5524),
        "f_angry" to Color(0xFFE8B08A), "m_calm" to Color(0xFFC68642)
    )

    internal fun skinTone(id: String): Color = skinTones[id] ?: Color(0xFFF1C27D)
}

/** Standard emoji tab in the message composer's "سمايلات وملصقات" picker — exact port of `STANDARD_EMOJIS`. */
val STANDARD_EMOJIS: List<String> = listOf(
    "😀", "😂", "🥰", "😍", "😘", "😉", "😊", "🙂", "😎", "🤩",
    "😢", "😭", "😡", "😱", "🤔", "😴", "🙄", "😅", "🥳", "🤗",
    "👍", "👎", "🙏", "👏", "💪", "🤝", "✌️", "👌", "🤙", "✋",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💯",
    "🔥", "✨", "🎉", "🎊", "⭐", "🌹", "☕", "📚", "✍️", "💬"
)

// ---- Draw-op model (built once per sticker id, then replayed every frame) ----

private val Ink = Color(0xFF1E293B)
private val Tear = Color(0xFF38BDF8)
private val LoveRed = Color(0xFFE11D48)
private val LaughDark = Color(0xFF7F1D1D)
private val CoolLens = Color(0xFF0F172A)
private val Blush = Color(0xFFFB7185)
private val SleepyGray = Color(0xFF94A3B8)
private val ThinkGray = Color(0xFFCBD5E1)
private val HairFemaleColor = Color(0xFF3B2415)
private val HairMaleColor = Color(0xFF1C1C1C)

private sealed interface FaceOp
private data class FillPathOp(val path: Path, val color: Color, val alpha: Float = 1f) : FaceOp
private data class StrokePathOp(val path: Path, val color: Color, val width: Float, val alpha: Float = 1f) : FaceOp
private data class FillStrokePathOp(val path: Path, val fill: Color, val stroke: Color, val strokeWidth: Float) : FaceOp
private data class CircleFillOp(val cx: Float, val cy: Float, val r: Float, val color: Color, val alpha: Float = 1f) : FaceOp
private data class CircleStrokeOp(val cx: Float, val cy: Float, val r: Float, val color: Color, val width: Float) : FaceOp
private data class OvalFillOp(val cx: Float, val cy: Float, val rx: Float, val ry: Float, val color: Color) : FaceOp
private data class OvalFillStrokeOp(val cx: Float, val cy: Float, val rx: Float, val ry: Float, val fill: Color, val stroke: Color, val strokeWidth: Float) : FaceOp
private data class RoundRectOp(val x: Float, val y: Float, val w: Float, val h: Float, val r: Float, val color: Color) : FaceOp
private data class RectOp(val x: Float, val y: Float, val w: Float, val h: Float, val color: Color) : FaceOp
private data class TextOp(val text: String, val x: Float, val y: Float, val sizeUnits: Float, val color: Color, val bold: Boolean, val centered: Boolean = false) : FaceOp

private fun svgPath(d: String): Path = PathParser.createPathFromPathData(d).asComposePath()

private fun hairOps(meta: StickerMeta): FaceOp {
    val d = if (meta.gender == StickerGender.FEMALE) {
        "M10 26c-1-14 9-22 22-22s23 8 22 22c0 4-2 10-2 10s-3-6-4-14c-6 4-14 5-18 3-4-2-8-2-14 2-1-9 3-13 3-13s-8 2-9 12z"
    } else {
        "M12 24c-1-12 8-19 20-19s21 7 20 19c0 3-1 6-1 6s-6-9-19-9-19 9-19 9-1-3-1-6z"
    }
    val color = if (meta.gender == StickerGender.FEMALE) HairFemaleColor else HairMaleColor
    return FillPathOp(svgPath(d), color)
}

private fun eyebrowOps(mood: StickerMood): List<FaceOp> {
    val (dLeft, dRight) = when (mood) {
        StickerMood.ANGRY -> "M14 22l10 4" to "M50 22l-10 4"
        StickerMood.SURPRISED -> "M15 22c3-2 8-2 11 0" to "M38 22c3-2 8-2 11 0"
        StickerMood.THINKING -> "M15 24c3-1 8-1 11 1" to "M39 21c3-2 7-1 10 1"
        else -> "M15 24c3-1.5 8-1.5 11 0" to "M38 24c3-1.5 8-1.5 11 0"
    }
    return listOf(
        StrokePathOp(svgPath(dLeft), Ink, 2.6f),
        StrokePathOp(svgPath(dRight), Ink, 2.6f)
    )
}

private fun eyeOps(mood: StickerMood): List<FaceOp> = when (mood) {
    StickerMood.LOVE -> listOf(
        FillPathOp(svgPath("M20 30c-3-4-9-2-9 2 0 4 5 7 9 10 4-3 9-6 9-10 0-4-6-6-9-2z"), LoveRed),
        FillPathOp(svgPath("M44 30c-3-4-9-2-9 2 0 4 5 7 9 10 4-3 9-6 9-10 0-4-6-6-9-2z"), LoveRed)
    )
    StickerMood.WINK -> listOf(
        StrokePathOp(svgPath("M17 32c2-2 6-2 8 0"), Ink, 3f),
        CircleFillOp(44f, 31f, 3.4f, Ink)
    )
    StickerMood.COOL -> listOf(
        RoundRectOp(14f, 27f, 16f, 9f, 3f, CoolLens),
        RoundRectOp(34f, 27f, 16f, 9f, 3f, CoolLens),
        RectOp(30f, 30f, 4f, 2f, CoolLens)
    )
    StickerMood.SAD -> listOf(
        CircleFillOp(21f, 31f, 3.4f, Ink),
        CircleFillOp(43f, 31f, 3.4f, Ink),
        StrokePathOp(svgPath("M17 40c1-2 2-2 3 0"), Tear, 2.4f)
    )
    StickerMood.SURPRISED -> listOf(
        CircleFillOp(21f, 31f, 4.2f, Ink),
        CircleFillOp(43f, 31f, 4.2f, Ink)
    )
    StickerMood.SLEEPY -> listOf(
        StrokePathOp(svgPath("M16 31c2-1.5 5-1.5 7 0"), Ink, 3f),
        StrokePathOp(svgPath("M38 31c2-1.5 5-1.5 7 0"), Ink, 3f)
    )
    StickerMood.ANGRY -> listOf(
        CircleFillOp(21f, 32f, 3.2f, Ink),
        CircleFillOp(43f, 32f, 3.2f, Ink)
    )
    StickerMood.THINKING -> listOf(
        CircleFillOp(21f, 31f, 3.2f, Ink),
        CircleFillOp(43f, 28f, 3.2f, Ink)
    )
    StickerMood.LAUGHING -> listOf(
        StrokePathOp(svgPath("M16 30c2 3 6 3 8 0"), Ink, 3f),
        StrokePathOp(svgPath("M38 30c2 3 6 3 8 0"), Ink, 3f)
    )
    else -> listOf(
        CircleFillOp(21f, 31f, 3.4f, Ink),
        CircleFillOp(43f, 31f, 3.4f, Ink)
    )
}

private fun mouthOps(mood: StickerMood): FaceOp = when (mood) {
    StickerMood.HAPPY, StickerMood.LOVE ->
        StrokePathOp(svgPath("M20 42c4 5 20 5 24 0"), Ink, 3f)
    StickerMood.LAUGHING ->
        FillStrokePathOp(svgPath("M18 40c5 8 23 8 28 0"), LaughDark, Ink, 2.4f)
    StickerMood.WINK, StickerMood.COOL, StickerMood.CALM ->
        StrokePathOp(svgPath("M22 42c4 3 16 3 20 0"), Ink, 3f)
    StickerMood.SAD ->
        StrokePathOp(svgPath("M22 46c4-4 16-4 20 0"), Ink, 3f)
    StickerMood.SURPRISED ->
        OvalFillStrokeOp(32f, 43f, 5f, 6f, LaughDark, Ink, 2f)
    StickerMood.ANGRY ->
        StrokePathOp(svgPath("M23 45c4-2 14-2 18 0"), Ink, 3f)
    StickerMood.BLUSHING ->
        StrokePathOp(svgPath("M24 41c3 3 13 3 16 0"), Ink, 2.6f)
    StickerMood.SLEEPY ->
        OvalFillOp(32f, 42f, 3.4f, 2.4f, Ink)
    StickerMood.THINKING ->
        StrokePathOp(svgPath("M24 43c4 1 12 1 16-1"), Ink, 2.6f)
}

private fun extraOps(mood: StickerMood): List<FaceOp> = when (mood) {
    StickerMood.BLUSHING -> listOf(
        CircleFillOp(15f, 38f, 4.5f, Blush, 0.55f),
        CircleFillOp(49f, 38f, 4.5f, Blush, 0.55f)
    )
    StickerMood.SLEEPY -> listOf(
        TextOp("zZ", 46f, 18f, 9f, SleepyGray, bold = true)
    )
    StickerMood.SURPRISED -> listOf(
        CircleFillOp(50f, 24f, 2.2f, Tear, 0.8f)
    )
    StickerMood.THINKING -> listOf(
        CircleFillOp(52f, 16f, 1.6f, ThinkGray, 0.9f),
        CircleFillOp(56f, 11f, 2.2f, ThinkGray, 0.9f)
    )
    else -> emptyList()
}

private fun brandBadgeOps(): List<FaceOp> = listOf(
    CircleFillOp(53f, 53f, 9f, BrandTeal),
    CircleStrokeOp(53f, 53f, 9f, Color.White, 2f),
    TextOp("ل", 53f, 57f, 10f, Color.White, bold = true, centered = true)
)

private fun buildFaceOps(meta: StickerMeta): List<FaceOp> = buildList {
    add(CircleFillOp(32f, 34f, 24f, ChatStickers.skinTone(meta.id)))
    add(hairOps(meta))
    addAll(eyebrowOps(meta.mood))
    addAll(eyeOps(meta.mood))
    add(mouthOps(meta.mood))
    addAll(extraOps(meta.mood))
    addAll(brandBadgeOps())
}

/** One rendered sticker face, square, scaled to fill [modifier]'s bounds (viewBox is 64x64, like source). */
@Composable
fun ChatStickerFace(meta: StickerMeta, modifier: Modifier = Modifier) {
    val ops = remember(meta.id) { buildFaceOps(meta) }
    Canvas(
        modifier = modifier
            .aspectRatio(1f)
            .semantics { contentDescription = meta.label }
    ) {
        val unitScale = size.minDimension / 64f
        scale(unitScale, unitScale, pivot = androidx.compose.ui.geometry.Offset.Zero) {
            ops.forEach { op -> drawFaceOp(op) }
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawFaceOp(op: FaceOp) {
    when (op) {
        is FillPathOp -> drawPath(op.path, color = op.color, alpha = op.alpha)
        is StrokePathOp -> drawPath(
            op.path,
            color = op.color,
            alpha = op.alpha,
            style = Stroke(width = op.width, cap = StrokeCap.Round)
        )
        is FillStrokePathOp -> {
            drawPath(op.path, color = op.fill)
            drawPath(op.path, color = op.stroke, style = Stroke(width = op.strokeWidth, cap = StrokeCap.Round))
        }
        is CircleFillOp -> drawCircle(op.color, radius = op.r, center = androidx.compose.ui.geometry.Offset(op.cx, op.cy), alpha = op.alpha)
        is CircleStrokeOp -> drawCircle(
            op.color,
            radius = op.r,
            center = androidx.compose.ui.geometry.Offset(op.cx, op.cy),
            style = Stroke(width = op.width)
        )
        is OvalFillOp -> drawOval(
            op.color,
            topLeft = androidx.compose.ui.geometry.Offset(op.cx - op.rx, op.cy - op.ry),
            size = androidx.compose.ui.geometry.Size(op.rx * 2, op.ry * 2)
        )
        is OvalFillStrokeOp -> {
            val topLeft = androidx.compose.ui.geometry.Offset(op.cx - op.rx, op.cy - op.ry)
            val ovalSize = androidx.compose.ui.geometry.Size(op.rx * 2, op.ry * 2)
            drawOval(op.fill, topLeft = topLeft, size = ovalSize)
            drawOval(op.stroke, topLeft = topLeft, size = ovalSize, style = Stroke(width = op.strokeWidth))
        }
        is RoundRectOp -> drawRoundRect(
            op.color,
            topLeft = androidx.compose.ui.geometry.Offset(op.x, op.y),
            size = androidx.compose.ui.geometry.Size(op.w, op.h),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(op.r, op.r)
        )
        is RectOp -> drawRect(
            op.color,
            topLeft = androidx.compose.ui.geometry.Offset(op.x, op.y),
            size = androidx.compose.ui.geometry.Size(op.w, op.h)
        )
        is TextOp -> {
            val paint = android.graphics.Paint().apply {
                isAntiAlias = true
                color = op.color.toArgb()
                textSize = op.sizeUnits
                isFakeBoldText = op.bold
                textAlign = if (op.centered) android.graphics.Paint.Align.CENTER else android.graphics.Paint.Align.LEFT
            }
            drawContext.canvas.nativeCanvas.drawText(op.text, op.x, op.y, paint)
        }
    }
}
