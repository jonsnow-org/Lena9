package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.nodes.Node
import org.jsoup.nodes.TextNode
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * Manual HTML → Compose block model. [studio.ai.literium.literium_app.data.model.Article.content]
 * is raw HTML from the in-house rich-text editor (not Markdown, not Firestore-safe Markdown either)
 * — per task scope we parse it with Jsoup and render each recognized tag with genuine Compose
 * widgets (Text/Image/Column rows), never a WebView. Unrecognized/unsupported tags degrade to their
 * inline text content rather than being silently dropped, so nothing in an article ever disappears.
 */
private sealed class ContentBlock {
    data class Paragraph(val text: AnnotatedString) : ContentBlock()
    data class Heading(val text: AnnotatedString, val level: Int) : ContentBlock()
    data class ListBlock(val items: List<AnnotatedString>, val ordered: Boolean) : ContentBlock()
    data class Quote(val text: AnnotatedString) : ContentBlock()
    data class Picture(val src: String, val alt: String) : ContentBlock()
}

/** True if [tag] is a block-level container we walk recursively rather than treat as one leaf. */
private fun isContainerTag(tag: String) = tag in setOf("div", "section", "article", "body")

private fun buildInline(el: Element): AnnotatedString = buildAnnotatedString {
    fun walk(node: Node) {
        when (node) {
            is TextNode -> append(node.text())
            is Element -> when (node.tagName().lowercase()) {
                "br" -> append("\n")
                "b", "strong" -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { node.childNodes().forEach { walk(it) } }
                "i", "em" -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { node.childNodes().forEach { walk(it) } }
                "u" -> withStyle(SpanStyle(textDecoration = TextDecoration.Underline)) { node.childNodes().forEach { walk(it) } }
                "mark" -> withStyle(SpanStyle(background = Color(0x33F59E0B))) { node.childNodes().forEach { walk(it) } }
                "a" -> {
                    val href = node.attr("href")
                    if (href.isNotBlank()) {
                        withLink(
                            LinkAnnotation.Url(
                                href,
                                TextLinkStyles(style = SpanStyle(color = BrandTeal, textDecoration = TextDecoration.Underline))
                            )
                        ) { node.childNodes().forEach { walk(it) } }
                    } else {
                        node.childNodes().forEach { walk(it) }
                    }
                }
                else -> node.childNodes().forEach { walk(it) }
            }
        }
    }
    el.childNodes().forEach { walk(it) }
}

private fun collectBlocks(container: Element, out: MutableList<ContentBlock>) {
    for (child in container.children()) {
        when (child.tagName().lowercase()) {
            "p" -> {
                val txt = buildInline(child)
                if (txt.text.isNotBlank()) out += ContentBlock.Paragraph(txt)
            }
            "h1" -> out += ContentBlock.Heading(buildInline(child), 1)
            "h2" -> out += ContentBlock.Heading(buildInline(child), 2)
            "h3", "h4", "h5", "h6" -> out += ContentBlock.Heading(buildInline(child), 3)
            "ul" -> out += ContentBlock.ListBlock(
                child.children().filter { it.tagName().equals("li", true) }.map { buildInline(it) },
                ordered = false
            )
            "ol" -> out += ContentBlock.ListBlock(
                child.children().filter { it.tagName().equals("li", true) }.map { buildInline(it) },
                ordered = true
            )
            "blockquote" -> {
                val txt = buildInline(child)
                if (txt.text.isNotBlank()) out += ContentBlock.Quote(txt)
            }
            "img" -> {
                val src = child.attr("src")
                if (src.isNotBlank()) out += ContentBlock.Picture(src, child.attr("alt"))
            }
            "hr" -> { /* skipped — no visual divider in the source reader either */ }
            else -> if (isContainerTag(child.tagName().lowercase()) || child.children().isNotEmpty()) {
                collectBlocks(child, out)
            } else {
                val txt = buildInline(child)
                if (txt.text.isNotBlank()) out += ContentBlock.Paragraph(txt)
            }
        }
    }
}

/**
 * Parses [html] and returns the block list. If the input has no recognized block-level HTML tags at
 * all (Jsoup leaves it as bare text nodes under `<body>`) it is treated as legacy plain text — split
 * on blank lines into paragraphs, exactly matching `ArticleReader.tsx`'s own
 * `article.content.split('\n\n')` fallback for the plain-textarea editor content that predates this
 * HTML-capable rewrite.
 */
private fun parseArticleHtml(html: String): List<ContentBlock> {
    if (html.isBlank()) return emptyList()
    val doc = Jsoup.parseBodyFragment(html)
    val body = doc.body()
    val blocks = mutableListOf<ContentBlock>()
    if (body.children().isEmpty()) {
        // Plain text (no HTML tags at all) — paragraph-split fallback.
        html.split(Regex("\n\\s*\n")).map { it.trim() }.filter { it.isNotEmpty() }.forEach {
            blocks += ContentBlock.Paragraph(AnnotatedString(it))
        }
    } else {
        collectBlocks(body, blocks)
    }
    return blocks
}

/**
 * Renders article/editor-preview HTML body content as native Compose widgets — the whole reason
 * this rewrite exists instead of a WebView wrapper. See [parseArticleHtml] for the tag-mapping and
 * plain-text-fallback rules.
 */
@Composable
fun HtmlContent(
    html: String,
    modifier: Modifier = Modifier,
    bodyFontSize: androidx.compose.ui.unit.TextUnit = 15.sp,
    lineHeight: androidx.compose.ui.unit.TextUnit = 26.sp,
    textColor: Color = LocalContentColor.current
) {
    val blocks = remember(html) { parseArticleHtml(html) }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        blocks.forEach { block ->
            when (block) {
                is ContentBlock.Paragraph -> Text(
                    block.text,
                    fontSize = bodyFontSize,
                    lineHeight = lineHeight,
                    color = textColor
                )
                is ContentBlock.Heading -> Text(
                    block.text,
                    fontSize = when (block.level) { 1 -> 24.sp; 2 -> 20.sp; else -> 17.sp },
                    fontWeight = FontWeight.Black,
                    color = textColor,
                    modifier = Modifier.padding(top = 4.dp)
                )
                is ContentBlock.Quote -> androidx.compose.material3.Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(androidx.compose.foundation.layout.IntrinsicSize.Min)
                    ) {
                        androidx.compose.foundation.layout.Box(
                            modifier = Modifier
                                .width(3.dp)
                                .fillMaxHeight()
                                .background(BrandTeal)
                        )
                        Text(
                            block.text,
                            fontSize = bodyFontSize,
                            fontStyle = FontStyle.Italic,
                            lineHeight = lineHeight,
                            color = textColor,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
                is ContentBlock.ListBlock -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    block.items.forEachIndexed { idx, item ->
                        Row {
                            Text(
                                if (block.ordered) "${idx + 1}." else "•",
                                fontSize = bodyFontSize,
                                fontWeight = FontWeight.Bold,
                                color = BrandTeal,
                                modifier = Modifier.padding(end = 8.dp)
                            )
                            Text(item, fontSize = bodyFontSize, lineHeight = lineHeight, color = textColor)
                        }
                    }
                }
                is ContentBlock.Picture -> AsyncImage(
                    model = block.src,
                    contentDescription = block.alt,
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)),
                    contentScale = ContentScale.FillWidth
                )
            }
        }
    }
}
