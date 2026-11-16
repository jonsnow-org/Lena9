package studio.ai.literium.literium_app.ui.screens.explore

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.ui.ads.AdTickerBar
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.neutralButton
import studio.ai.literium.literium_app.ui.theme.neutralButtonText
import studio.ai.literium.literium_app.ui.theme.solidSheen
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr

private val FILTER_TABS = listOf(
    ExploreFilter.TRENDING to "🔥 الأكثر رواجاً",
    ExploreFilter.TOP_RATED to "⭐ الأعلى تقييماً",
    ExploreFilter.WRITERS to "✍️ كبار الكُتّاب"
    // «💎 مقالات مميزة وحصرية» مخفية كما في الويب (WRITER_MONETIZATION_ENABLED=false)
)

/**
 * الاستكشاف — ExploreView.tsx: رأس (أيقونة Compass 40dp + عنوان xl/black)، بحث كبير rounded-2xl،
 * تبويبات الفلاتر، بطاقة «كُتّاب موصى بمتابعتهم» (بطاقات w-44)، شريط إعلان، سحابة الوسوم الأكثر تداولاً،
 * وقائمة المقالات المرتّبة (p-3.5 rounded-2xl: ترتيب + مصغّرة 64dp + تفاصيل + حفظ).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ExploreScreen(
    onArticleClick: (String) -> Unit,
    onWriterClick: (String) -> Unit
) {
    val viewModel: ExploreViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()
    val dark = isDark

    if (state.isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }
        return
    }
    val articles = state.filteredArticles
    val writers = state.filteredWriters
    val searching = state.query.isNotBlank()

    PullToRefreshBox(isRefreshing = state.isRefreshing, onRefresh = viewModel::refresh, modifier = Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 64.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            // الرأس + البحث
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(40.dp).clip(RoundedCornerShape(16.dp)).background(if (dark) Color(0xFF042F2E) else Color(0xFFCCFBF1)), contentAlignment = Alignment.Center) {
                            LuIcon(Lu.Compass, 20.dp, if (dark) Tw.teal300 else Tw.teal600)
                        }
                        Column {
                            Text("استكشف العالم الأدبي", style = twText(20, FontWeight.Black, 28), color = if (dark) Tw.white else Tw.slate950)
                            Text("تصفح نخبة الكُتّاب، أكثر المقالات رواجاً والمواضيع الأكثر نقاشاً", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                        }
                    }
                    val shape = RoundedCornerShape(16.dp)
                    Row(
                        Modifier.fillMaxWidth().shadow(1.dp, shape, clip = false).clip(shape).background(if (dark) Tw.slate900 else Tw.white)
                            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape).padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        LuIcon(Lu.Search, 20.dp, Tw.slate400)
                        Box(Modifier.weight(1f)) {
                            if (state.query.isEmpty()) Text("ابحث عن كاتب، عنوان مقال، فكرة فلسفية...", style = twText(14, FontWeight.Normal, 20), color = Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            BasicTextField(state.query, viewModel::setQuery, singleLine = true, textStyle = twText(14, FontWeight.Normal, 20).copy(color = if (dark) Tw.white else Tw.slate900), cursorBrush = SolidColor(Tw.teal600), modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            }

            // تبويبات الفلاتر
            item {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FILTER_TABS.forEach { (f, label) ->
                        val active = state.filter == f
                        val shape = RoundedCornerShape(16.dp)
                        Box(
                            Modifier.heightIn(min = 42.dp)
                                .then(if (active) Modifier.shadow(6.dp, shape, ambientColor = Color(0xFF14B8A6).copy(alpha = 0.20f), spotColor = Color(0xFF14B8A6).copy(alpha = 0.20f)) else Modifier)
                                .clip(shape)
                                .then(if (active) Modifier.background(Tw.teal600).solidSheen(shape) else Modifier.neutralButton(shape))
                                .twClickable(pressScale = 0.95f) { viewModel.setFilter(f) }.padding(horizontal = 16.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) { Text(label, style = twText(12, FontWeight.Bold, 16), color = if (active) Tw.white else neutralButtonText(brand.s500), maxLines = 1) }
                    }
                }
            }

            // كُتّاب موصى بمتابعتهم
            item {
                val cardShape = RoundedCornerShape(24.dp)
                Column(
                    Modifier.fillMaxWidth().shadow(1.dp, cardShape, clip = false).clip(cardShape).background(if (dark) Tw.slate900 else Tw.white)
                        .border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), cardShape).padding(16.dp)
                ) {
                    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            LuIcon(Lu.Users, 16.dp, Tw.teal600)
                            Text(if (searching) "نتائج البحث عن كُتّاب" else "كُتّاب موصى بمتابعتهم", style = twText(14, FontWeight.Black, 20), color = if (dark) Tw.white else Tw.slate900)
                        }
                        Text("${writers.size} كاتب", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal600)
                    }
                    if (writers.isNotEmpty()) {
                        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            writers.forEach { w ->
                                val following = w.id in state.followedWriterIds
                                val ws = RoundedCornerShape(16.dp)
                                Column(
                                    Modifier.width(176.dp).clip(ws).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50)
                                        .border(1.dp, if (dark) Tw.slate700.copy(alpha = 0.60f) else Tw.slate200.copy(alpha = 0.60f), ws).padding(14.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Box(Modifier.padding(bottom = 8.dp).twClickable { onWriterClick(w.id) }) {
                                        val av = RoundedCornerShape(16.dp)
                                        AsyncImage(w.avatarUrl, w.fullName, Modifier.size(56.dp).clip(av).border(2.dp, Color(0xFF14B8A6).copy(alpha = 0.30f), av), contentScale = ContentScale.Crop)
                                        if (w.isVerified == true) Box(Modifier.align(Alignment.BottomEnd).padding(2.dp).clip(CircleShape).background(Tw.teal600).padding(2.dp)) { LuIcon(Lu.CheckCircle2, 12.dp, Tw.white) }
                                    }
                                    Text(w.fullName, Modifier.twClickable { onWriterClick(w.id) }, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text((w.bio ?: "").ifBlank { "كاتب ومفكر في منصة ليتيريوم" }, Modifier.padding(bottom = 12.dp), style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Box(
                                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (following) (if (dark) Tw.slate700 else Tw.slate200) else Tw.teal600)
                                            .twClickable(pressScale = 0.95f) { viewModel.toggleFollow(w.id) }.padding(vertical = 6.dp),
                                        contentAlignment = Alignment.Center
                                    ) { Text(if (following) "مُتابَع" else "+ متابعة", style = twText(12, FontWeight.Bold, 16), color = if (following) (if (dark) Tw.slate300 else Tw.slate700) else Tw.white) }
                                }
                            }
                        }
                    } else {
                        Text(if (searching) "لا يوجد كاتب يطابق بحثك." else "لا يوجد كُتّاب متاحون حالياً.", Modifier.fillMaxWidth().padding(vertical = 12.dp), style = twText(12, FontWeight.Normal, 16).copy(textAlign = TextAlign.Center), color = Tw.slate400)
                    }
                }
            }

            item { AdTickerBar(slotId = "explore_feed", externalPriority = true, minHeightDp = 68.dp, modifier = Modifier.fillMaxWidth()) }

            // الوسوم الأكثر تداولاً
            val tags = state.trendingTags
            if (tags.isNotEmpty()) item {
                val ts = RoundedCornerShape(24.dp)
                Column(
                    Modifier.fillMaxWidth().clip(ts)
                        .background(if (dark) Brush.linearGradient(listOf(Color(0xFF042F2E).copy(alpha = 0.40f), Tw.slate950.copy(alpha = 0.30f), Tw.slate900.copy(alpha = 0.40f)))
                                    else Brush.linearGradient(listOf(Color(0xFF134E4A).copy(alpha = 0.10f), Tw.slate900.copy(alpha = 0.10f), Tw.slate900.copy(alpha = 0.05f))))
                        .border(1.dp, if (dark) Color(0xFF115E59).copy(alpha = 0.60f) else Color(0xFF99F6E4).copy(alpha = 0.60f), ts).padding(16.dp)
                ) {
                    Row(Modifier.padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(Lu.TrendingUp, 16.dp, if (dark) Tw.teal300 else Tw.teal600)
                        Text("الوسوم الأكثر تداولاً", style = twText(14, FontWeight.Black, 20), color = if (dark) Tw.white else Tw.slate900)
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        tags.forEach { (name, count) ->
                            val cs = RoundedCornerShape(12.dp)
                            Row(
                                Modifier.clip(cs).background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.white.copy(alpha = 0.80f))
                                    .border(1.dp, if (dark) Color(0xFF115E59).copy(alpha = 0.60f) else Color(0xFF99F6E4).copy(alpha = 0.60f), cs)
                                    .twClickable(pressScale = 0.95f) { viewModel.setQuery(name.replace('_', ' ')) }.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text("#${name.replace('_', ' ')}", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate800)
                                Text("$count مقال", style = twText(10, FontWeight.Medium, 15), color = if (dark) Tw.teal300 else Tw.teal600)
                            }
                        }
                    }
                }
            }

            // المقالات المستكشفة
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LuIcon(Lu.BookOpen, 20.dp, Tw.teal600)
                    Text("المقالات المستكشفة (${articles.size})", style = twText(16, FontWeight.Black, 24), color = if (dark) Tw.white else Tw.slate900)
                }
            }
            if (articles.isEmpty()) item {
                val es = RoundedCornerShape(24.dp)
                Column(Modifier.fillMaxWidth().clip(es).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, es).padding(vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    LuIcon(Lu.BookOpen, 40.dp, Tw.slate400)
                    Text("لا توجد مقالات مطابقة", Modifier.padding(top = 12.dp), style = twText(14, FontWeight.Bold, 20), color = if (dark) Tw.white else Tw.slate900)
                    Text("جرّب تغيير كلمات البحث أو الفلاتر.", Modifier.padding(top = 4.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
                }
            } else {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        articles.forEachIndexed { idx, a ->
                            val saved = a.id in state.bookmarkedArticleIds
                            val rs = RoundedCornerShape(16.dp)
                            Row(
                                Modifier.fillMaxWidth().shadow(1.dp, rs, clip = false).clip(rs).background(if (dark) Tw.slate900 else Tw.white)
                                    .border(1.dp, if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), rs)
                                    .twClickable(pressScale = 0.99f) { onArticleClick(a.id) }.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Box(Modifier.size(28.dp).clip(RoundedCornerShape(12.dp)).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA)), contentAlignment = Alignment.Center) {
                                    Text(arNum((idx + 1).toLong()), style = twText(12, FontWeight.Black, 16), color = if (dark) Tw.teal300 else Tw.teal700)
                                }
                                AsyncImage(a.featuredImage, a.title, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                                Column(Modifier.weight(1f)) {
                                    Row(Modifier.padding(bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Text(a.writerName, style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                                        Text("•", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                                        Text(DateFormatAr.formatDateTimeAr(a.publishedAt), style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1)
                                    }
                                    Text(a.title, Modifier.padding(bottom = 4.dp), style = twText(12, FontWeight.Black, 16), color = if (dark) Tw.white else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { LuIcon(Lu.Eye, 12.dp, Color(0xFF14B8A6)); Text("${a.viewsCount}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400) }
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { LuIcon(Lu.Heart, 12.dp, Tw.rose500); Text("${a.likesCount}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400) }
                                    }
                                }
                                Box(
                                    Modifier.clip(RoundedCornerShape(12.dp)).then(if (saved) Modifier.background(if (dark) Color(0xFF042F2E) else Color(0xFFF0FDFA)) else Modifier)
                                        .twClickable(pressScale = 0.90f) { viewModel.toggleBookmark(a.id) }.padding(8.dp)
                                ) { LuIcon(Lu.Bookmark, 16.dp, if (saved) Tw.teal600 else Tw.slate400) }
                            }
                        }
                    }
                }
            }
        }
    }
}
