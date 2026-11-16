package studio.ai.literium.literium_app.ui.screens.feed

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.components.articleCategoryLabelAr
import studio.ai.literium.literium_app.ui.theme.CairoFamily
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.mixColors
import studio.ai.literium.literium_app.ui.theme.neutralButton
import studio.ai.literium.literium_app.ui.theme.neutralButtonText
import studio.ai.literium.literium_app.ui.theme.pulseAlpha
import studio.ai.literium.literium_app.ui.theme.solidSheen
import studio.ai.literium.literium_app.ui.theme.trBrush
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.util.DateFormatAr

internal fun cairo(size: Int, weight: FontWeight, lh: Int = 0) = TextStyle(
    fontFamily = CairoFamily, fontSize = size.sp, fontWeight = weight,
    lineHeight = if (lh > 0) lh.sp else androidx.compose.ui.unit.TextUnit.Unspecified
)

/** مبدّل المدونة/التغريد — HomeFeedModeSwitcher.tsx: h-14، rounded-2xl، p-1.5، gap-2، بطاقتان برتقالية/زرقاء. */
@Composable
internal fun HomeFeedModeSwitcher(mode: FeedMode, onModeChange: (FeedMode) -> Unit) {
    val dark = isDark
    val outer = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().height(56.dp).clip(outer)
            .background(if (dark) Tw.slate900 else Tw.slate100)
            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, outer)
            .padding(6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ModeTab("المدونة", Lu.BookOpen, mode == FeedMode.BLOG, Color(0xFFF97316), Color(0xFFFFF7ED), Color(0xFF431407).copy(alpha = 0.30f),
            Color(0xFFF97316), Color(0xFFFB923C).copy(alpha = 0.80f), Modifier.weight(1f)) { onModeChange(FeedMode.BLOG) }
        ModeTab("تغريد", Lu.MessageSquare, mode == FeedMode.TWEET, Tw.blue600, Tw.blue50, Color(0xFF172554).copy(alpha = 0.30f),
            Tw.blue500, Color(0xFF60A5FA).copy(alpha = 0.80f), Modifier.weight(1f)) { onModeChange(FeedMode.TWEET) }
    }
}

@Composable
private fun ModeTab(
    label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean,
    solid: Color, idleBgLight: Color, idleBgDark: Color, idleFgLight: Color, idleFgDark: Color,
    modifier: Modifier, onClick: () -> Unit
) {
    val dark = isDark
    val shape = RoundedCornerShape(12.dp)
    val bg by animateColorAsState(if (active) solid else if (dark) idleBgDark else idleBgLight, tween(300), label = "modeBg")
    val fg = if (active) Tw.white else if (dark) idleFgDark else idleFgLight
    Row(
        modifier.fillMaxHeight()
            .then(if (active) Modifier.shadow(6.dp, shape, ambientColor = solid.copy(alpha = 0.30f), spotColor = solid.copy(alpha = 0.30f)) else Modifier)
            .clip(shape).background(bg).twClickable(onClick = onClick).padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
    ) {
        LuIcon(icon, 16.dp, fg)
        Box(Modifier.width(8.dp))
        Text(label, style = cairo(14, FontWeight.ExtraBold, 20), color = fg, maxLines = 1)
    }
}

/** زر دائري صغير p-2 rounded-full (بحث/تحديث التغريدات) — مع طبقة الأزرار المحايدة. */
@Composable
internal fun RoundIconButton(icon: androidx.compose.ui.graphics.vector.ImageVector, spinning: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val tone = brand.s500
    val t = rememberInfiniteTransition(label = "spin")
    val rot by t.animateFloat(0f, 360f, infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Restart), label = "rot")
    Box(
        Modifier.clip(CircleShape).neutralButton(CircleShape, tone).twClickable(enabled = enabled, pressScale = 0.95f, onClick = onClick).padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        LuIcon(icon, 14.dp, if (spinning) brand.s500 else neutralButtonText(tone), Modifier.rotate(if (spinning) rot else 0f))
    }
}

/** صف البحث/التحديث لوضع المدونة (px-3 py-2.5 rounded-2xl) أو التغريد (مختصر). */
@Composable
internal fun SearchRefreshRow(
    expanded: Boolean, query: String, placeholder: String, compact: Boolean,
    isRefreshing: Boolean, refreshLabel: Boolean,
    onExpand: (Boolean) -> Unit, onQuery: (String) -> Unit, onRefresh: () -> Unit
) {
    val dark = isDark
    val tone = brand.s500
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        if (expanded) {
            val shape = RoundedCornerShape(16.dp)
            val focus = remember { FocusRequester() }
            LaunchedEffect(Unit) { focus.requestFocus() }
            val iconBox = if (compact) 36.dp else 44.dp
            Row(
                Modifier.weight(1f).clip(shape).background(if (dark) Tw.slate900 else Tw.white)
                    .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape).height(IntrinsicSizeMin),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.width(iconBox).fillMaxHeight().drawEndBorder(if (dark) Tw.slate800 else Tw.slate200), contentAlignment = Alignment.Center) {
                    LuIcon(Lu.Search, if (compact) 14.dp else 16.dp, Tw.slate400)
                }
                Box(Modifier.weight(1f).padding(horizontal = if (compact) 12.dp else 16.dp, vertical = if (compact) 8.dp else 12.dp)) {
                    if (query.isEmpty()) Text(placeholder, style = cairo(if (compact) 12 else 12, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    BasicTextField(
                        value = query, onValueChange = onQuery, singleLine = true,
                        textStyle = cairo(12, FontWeight.Normal, 16).copy(color = if (dark) Tw.white else Tw.slate900),
                        cursorBrush = SolidColor(brand.s500),
                        modifier = Modifier.fillMaxWidth().focusRequester(focus)
                    )
                }
                Box(
                    Modifier.width(iconBox).fillMaxHeight().twClickable { onQuery(""); onExpand(false) },
                    contentAlignment = Alignment.Center
                ) { LuIcon(Lu.X, if (compact) 14.dp else 16.dp, Tw.slate400) }
            }
        } else if (compact) {
            RoundIconButton(Lu.Search) { onExpand(true) }
        } else {
            val shape = RoundedCornerShape(16.dp)
            Row(
                Modifier.clip(shape).neutralButton(shape, tone).twClickable(pressScale = 0.95f) { onExpand(true) }.padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                LuIcon(Lu.Search, 16.dp, neutralButtonText(tone))
                Text("بحث...", style = cairo(12, FontWeight.Normal, 16), color = neutralButtonText(tone))
            }
        }
        Box(Modifier.width(8.dp))
        if (compact) {
            RoundIconButton(Lu.RefreshCw, spinning = isRefreshing, enabled = !isRefreshing, onClick = onRefresh)
        } else {
            val shape = RoundedCornerShape(16.dp)
            val t = rememberInfiniteTransition(label = "spin2")
            val rot by t.animateFloat(0f, 360f, infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Restart), label = "rot2")
            Row(
                Modifier.clip(shape).neutralButton(shape, tone).twClickable(enabled = !isRefreshing, pressScale = 0.95f, onClick = onRefresh).padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                LuIcon(Lu.RefreshCw, 14.dp, if (isRefreshing) brand.s500 else neutralButtonText(tone), Modifier.rotate(if (isRefreshing) rot else 0f))
            }
        }
    }
}

private val IntrinsicSizeMin = androidx.compose.foundation.layout.IntrinsicSize.Min

private fun Modifier.drawEndBorder(color: Color): Modifier = this.then(
    Modifier.drawBehind {
        val w = 1.dp.toPx()
        val rtl = layoutDirection == androidx.compose.ui.unit.LayoutDirection.Rtl
        // border-e: على جهة النهاية (يسار في RTL)
        val x = if (rtl) 0f else size.width - w
        drawRect(color, topLeft = androidx.compose.ui.geometry.Offset(x, 0f), size = androidx.compose.ui.geometry.Size(w, size.height))
    }
)

/** شرائح التصنيف — min-h-[42px] px-4.5 py-2 rounded-2xl text-xs font-extrabold. */
@Composable
internal fun CategoryChips(filters: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    val dark = isDark
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        filters.forEach { (id, label) ->
            val active = id == selected
            val shape = RoundedCornerShape(16.dp)
            val tone = brand.s500
            Box(
                Modifier.heightIn(min = 42.dp)
                    .then(if (active) Modifier.shadow(6.dp, shape, ambientColor = tone.copy(alpha = 0.25f), spotColor = tone.copy(alpha = 0.25f)) else Modifier)
                    .clip(shape)
                    .then(
                        if (active) Modifier.background(brand.s600).solidSheen(shape).border(2.dp, brand.s500.copy(alpha = 0.20f), shape)
                        else Modifier.neutralButton(shape, tone)
                    )
                    .twClickable(pressScale = 0.95f) { onSelect(id) }
                    .padding(horizontal = 18.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(label, style = cairo(12, FontWeight.ExtraBold, 16), color = if (active) Tw.white else neutralButtonText(tone), maxLines = 1)
            }
        }
    }
}

@Composable
internal fun MatchingUsersRow(users: List<User>, onClick: (String) -> Unit) {
    val dark = isDark
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("حسابات مطابقة لبحثك:", style = cairo(12, FontWeight.Bold, 16), color = if (dark) Tw.slate400 else Tw.slate500)
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            users.forEach { u ->
                val shape = RoundedCornerShape(16.dp)
                Row(
                    Modifier.clip(shape).neutralButton(shape).twClickable(pressScale = 0.95f) { onClick(u.id) }.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AsyncImage(u.avatarUrl, null, Modifier.size(24.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                    Text(u.fullName, style = cairo(12, FontWeight.Bold, 16), color = neutralButtonText(brand.s500), maxLines = 1)
                    Text("@${u.username}", style = cairo(10, FontWeight.Normal, 15), color = Tw.slate400, maxLines = 1)
                }
            }
        }
    }
}

/** رأس قسم «مقالات مميزة / الأكثر قراءة»: أيقونة 32dp متدرّجة + عنوان base/black + وصف 11px. */
@Composable
private fun SectionTitle(icon: androidx.compose.ui.graphics.vector.ImageVector, from: Color, to: Color, title: String, sub: String) {
    val dark = isDark
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(
            Modifier.size(32.dp).clip(RoundedCornerShape(12.dp)).background(trBrush(from, to)),
            contentAlignment = Alignment.Center
        ) { LuIcon(icon, 16.dp, Tw.white) }
        Column {
            Text(title, style = cairo(16, FontWeight.Black, 20), color = if (dark) Tw.white else Tw.slate900)
            Text(sub, style = cairo(11, FontWeight.Medium, 16), color = if (dark) Tw.slate400 else Tw.slate500)
        }
    }
}

/** المقالات المميزة: شريط أفقي، كل بطاقة w-[290px] rounded-3xl، صورة h-44 + تدرّج + شارات. */
@Composable
internal fun FeaturedSection(articles: List<Article>, bookmarked: Set<String>, onOpen: (String) -> Unit, onBookmark: (String) -> Unit) {
    val featured = articles.take(4)
    if (featured.isEmpty()) return
    val dark = isDark
    Column(Modifier.fillMaxWidth()) {
        SectionTitle(Lu.Sparkles, Tw.amber500, Color(0xFF14B8A6), "مقالات مميزة ونخبة الاختيارات", "أطروحات عميقة اختارها فريق التحرير للأسبوع الحالي")
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(start = 4.dp, end = 4.dp, top = 4.dp, bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            featured.forEach { a ->
                val shape = RoundedCornerShape(24.dp)
                Column(
                    Modifier.width(290.dp).clip(shape).background(if (dark) Tw.slate900.copy(alpha = 0.95f) else Tw.white)
                        .border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.90f), shape)
                        .twClickable { onOpen(a.id) }
                ) {
                    Box(Modifier.fillMaxWidth().height(176.dp).background(if (dark) Tw.slate800 else Tw.slate100)) {
                        AsyncImage(a.featuredImage, a.title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Tw.slate950.copy(alpha = 0.30f), Tw.slate950.copy(alpha = 0.90f)))))
                        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(
                                Modifier.clip(CircleShape).background(Tw.slate900.copy(alpha = 0.95f)).border(1.dp, Color(0xFF14B8A6).copy(alpha = 0.30f), CircleShape).padding(horizontal = 12.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                LuIcon(Lu.Star, 12.dp, Tw.amber400)
                                Text("مختار للتحرير", style = cairo(11, FontWeight.ExtraBold, 16), color = Tw.teal300)
                            }
                            Text("مجاني", Modifier.clip(CircleShape).background(Tw.teal600).padding(horizontal = 10.dp, vertical = 2.dp), style = cairo(11, FontWeight.Bold, 16), color = Tw.white)
                        }
                        Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                articleCategoryLabelAr(a.category),
                                Modifier.clip(RoundedCornerShape(8.dp)).background(Color(0xFF042F2E).copy(alpha = 0.92f)).border(1.dp, Color(0xFF14B8A6).copy(alpha = 0.20f), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 2.dp),
                                style = cairo(11, FontWeight.Bold, 16), color = Tw.teal300
                            )
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                LuIcon(Lu.Calendar, 12.dp, Color(0xFF2DD4BF))
                                Text(DateFormatAr.formatDateTimeAr(a.publishedAt), style = cairo(11, FontWeight.SemiBold, 16), color = Tw.slate200)
                            }
                        }
                    }
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        Text(a.title, Modifier.padding(bottom = 8.dp), style = cairo(14, FontWeight.Black, 19), color = if (dark) Tw.white else Tw.slate900, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text(a.description, Modifier.padding(bottom = 12.dp), style = cairo(12, FontWeight.Normal, 20), color = if (dark) Tw.slate400 else Tw.slate600, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800.copy(alpha = 0.80f) else Tw.slate100))
                        Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f, fill = false)) {
                                val av = RoundedCornerShape(12.dp)
                                AsyncImage(a.writerAvatar, null, Modifier.size(32.dp).clip(av).border(1.dp, Color(0xFF14B8A6).copy(alpha = 0.30f), av), contentScale = ContentScale.Crop)
                                Column {
                                    Text(a.writerName, style = cairo(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("${arNum(a.viewsCount)} قراءة", style = cairo(10, FontWeight.Medium, 15), color = Tw.slate400)
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                val isB = a.id in bookmarked
                                Box(
                                    Modifier.size(32.dp).clip(RoundedCornerShape(12.dp))
                                        .then(if (isB) Modifier.background(if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA)) else Modifier)
                                        .twClickable(pressScale = 0.95f) { onBookmark(a.id) },
                                    contentAlignment = Alignment.Center
                                ) { LuIcon(Lu.Bookmark, 14.dp, if (isB) (if (dark) Tw.teal300 else Tw.teal600) else Tw.slate400) }
                                Row(
                                    Modifier.heightIn(min = 34.dp).clip(RoundedCornerShape(12.dp)).background(Brush.horizontalGradient(listOf(Tw.teal600, Tw.cyan600)))
                                        .twClickable(pressScale = 0.95f) { onOpen(a.id) }.padding(horizontal = 12.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text("قراءة", style = cairo(12, FontWeight.Bold, 16), color = Tw.white)
                                    LuIcon(Lu.ArrowLeft, 12.dp, Tw.white)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** الأكثر قراءة: 4 بطاقات p-3.5 rounded-2xl بشارة ترتيب متدرّجة. */
@Composable
internal fun TrendingSection(articles: List<Article>, onOpen: (String) -> Unit) {
    val trending = articles.sortedByDescending { it.viewsCount }.take(4)
    if (trending.isEmpty()) return
    val dark = isDark
    Column(Modifier.fillMaxWidth()) {
        SectionTitle(Lu.Flame, Tw.rose500, Tw.amber500, "الأكثر قراءة وتفاعلاً هذا الأسبوع", "المقالات الأكثر رواجاً ونقاشاً بين مجتمع القراء")
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            trending.forEachIndexed { idx, a ->
                val (c1, c2, fg) = when (idx) {
                    0 -> Triple(Tw.amber500, Tw.amber600, Tw.slate950)
                    1 -> Triple(Tw.slate400, Tw.slate500, Tw.white)
                    2 -> Triple(Color(0xFFB45309), Color(0xFF92400E), Tw.white)
                    else -> Triple(Tw.teal600, Tw.teal700, Tw.white)
                }
                val shape = RoundedCornerShape(16.dp)
                Column(
                    Modifier.fillMaxWidth().clip(shape).background(if (dark) Tw.slate900 else Tw.white)
                        .border(1.dp, if (dark) Tw.slate800.copy(alpha = 0.80f) else Tw.slate200.copy(alpha = 0.80f), shape)
                        .twClickable(pressScale = 0.99f) { onOpen(a.id) }.padding(14.dp)
                ) {
                    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(24.dp).clip(RoundedCornerShape(8.dp)).background(trBrush(c1, c2)), contentAlignment = Alignment.Center) {
                            Text("#${arNum((idx + 1).toLong())}", style = cairo(12, FontWeight.Black, 16), color = fg)
                        }
                        Text(
                            when (a.category) { "literature" -> "أدب"; "philosophy" -> "فلسفة"; "technology" -> "تقنية"; "history" -> "تاريخ"; "science" -> "علوم"; "business" -> "مال"; else -> "عام" },
                            Modifier.clip(CircleShape).background(if (dark) Tw.slate800 else Tw.slate100).padding(horizontal = 8.dp, vertical = 2.dp),
                            style = cairo(10, FontWeight.Bold, 15), color = if (dark) Tw.slate300 else Tw.slate600
                        )
                    }
                    Text(a.title, Modifier.padding(bottom = 8.dp), style = cairo(12, FontWeight.Black, 16), color = if (dark) Tw.white else Tw.slate900, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate100))
                    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f, fill = false)) {
                            AsyncImage(a.writerAvatar, null, Modifier.size(20.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                            Text(a.writerName, Modifier.widthIn(max = 90.dp), style = cairo(11, FontWeight.SemiBold, 16), color = if (dark) Tw.slate300 else Tw.slate700, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            LuIcon(Lu.Eye, 12.dp, if (dark) Tw.teal300 else Tw.teal600)
                            Text(arNum(a.viewsCount), style = cairo(11, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal600)
                        }
                    }
                }
            }
        }
    }
}

/** هيكل بطاقة المقال — ArticleCardSkeleton.tsx. */
@Composable
internal fun ArticleSkeleton() {
    val dark = isDark
    val bg = if (dark) Tw.slate800 else Tw.slate200
    val bg2 = if (dark) Tw.slate700 else Tw.slate300
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier.fillMaxWidth().alpha(pulseAlpha()).clip(shape).background(if (dark) Tw.slate900.copy(alpha = 0.90f) else Tw.white)
            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), shape)
    ) {
        Box(Modifier.fillMaxWidth().height(192.dp).background(bg)) {
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Box(Modifier.width(80.dp).height(20.dp).clip(CircleShape).background(bg2))
                Box(Modifier.width(64.dp).height(20.dp).clip(CircleShape).background(bg2))
            }
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(16.dp)).background(bg))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.width(112.dp).height(14.dp).clip(RoundedCornerShape(6.dp)).background(bg))
                    Box(Modifier.width(64.dp).height(10.dp).clip(RoundedCornerShape(6.dp)).background(bg))
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.fillMaxWidth().height(16.dp).clip(RoundedCornerShape(6.dp)).background(bg))
                Box(Modifier.fillMaxWidth(0.75f).height(16.dp).clip(RoundedCornerShape(6.dp)).background(bg))
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp)).background(bg))
                Box(Modifier.fillMaxWidth(0.83f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(bg))
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate100))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.width(40.dp).height(12.dp).clip(RoundedCornerShape(6.dp)).background(bg))
                    Box(Modifier.width(40.dp).height(12.dp).clip(RoundedCornerShape(6.dp)).background(bg))
                }
                Box(Modifier.width(80.dp).height(28.dp).clip(RoundedCornerShape(12.dp)).background(bg))
            }
        }
    }
}

/** حالة «لا نتائج»: p-12 rounded-3xl، أيقونة BookOpen 48dp، زر «عرض جميع المقالات». */
@Composable
internal fun NoArticlesCard(onShowAll: () -> Unit) {
    val dark = isDark
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(if (dark) Tw.slate900 else Tw.white)
            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape).padding(48.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        LuIcon(Lu.BookOpen, 48.dp, Tw.slate300)
        Text("لم يتم العثور على مقالات تطابق هذا البحث", style = cairo(16, FontWeight.Bold, 24).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = if (dark) Tw.slate300 else Tw.slate700)
        Text("جرّب تغيير كلمات البحث أو استعراض قسم آخر من الأقسام.", style = cairo(12, FontWeight.Normal, 16).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = Tw.slate400)
        Box(
            Modifier.clip(RoundedCornerShape(12.dp)).background(brand.s600).solidSheen(RoundedCornerShape(12.dp)).twClickable(pressScale = 0.95f, onClick = onShowAll).padding(horizontal = 16.dp, vertical = 8.dp)
        ) { Text("عرض جميع المقالات", style = cairo(12, FontWeight.Bold, 16), color = Tw.white) }
    }
}
