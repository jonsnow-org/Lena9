package studio.ai.literium.literium_app.ui.screens.article

import android.content.Context
import android.content.Intent
import android.speech.tts.TextToSpeech
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdSlotId
import studio.ai.literium.literium_app.data.model.Comment
import studio.ai.literium.literium_app.ui.ads.AdSlot
import studio.ai.literium.literium_app.ui.components.VideoEmbed
import studio.ai.literium.literium_app.ui.components.VideoPlayer
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr
import java.util.Locale

private enum class ReaderTheme { Default, Sepia, Charcoal }
private enum class ReaderFont(val sp: Int, val lh: Int) { Sm(14, 23), Md(16, 32), Lg(18, 36), Xl(20, 40) }

private fun readerCategory(c: String) = when (c) {
    "literature" -> "الأدب والشعر"; "technology" -> "التقنية والذكاء الاصطناعي"; "history" -> "التاريخ والحضارات"
    "philosophy" -> "الفلسفة والفكر"; "business" -> "ريادة الأعمال والمال"; "science" -> "العلوم والفضاء"
    "health" -> "علم النفس والذات"; else -> "مقالات عامة"
}

/**
 * قارئ المقال — ArticleReader.tsx بنسخة الهاتف (ملء الشاشة): شريط تقدّم h-1 بتدرّج teal→cyan→amber،
 * رأس لاصق (رجوع/استماع/تخصيص/حفظ/مشاركة)، قائمة تخصيص الخط والمظهر (افتراضي/ورق دافئ/فحمي)، قراءة صوتية،
 * وبطاقة الكاتب، الصورة، النص مع إعلان منتصفي، الوسوم، التفاعلات والتقييم، الإعجاب/المشاركة، التعليقات.
 */
@Composable
fun ArticleReaderScreen(
    articleId: String,
    onBack: () -> Unit,
    onWriterClick: (String) -> Unit
) {
    val viewModel: ArticleReaderViewModel = viewModel()
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("literium_reader", Context.MODE_PRIVATE) }
    var font by remember { mutableStateOf(runCatching { ReaderFont.valueOf(prefs.getString("font", "Md") ?: "Md") }.getOrDefault(ReaderFont.Md)) }
    var theme by remember { mutableStateOf(runCatching { ReaderTheme.valueOf(prefs.getString("theme", "Default") ?: "Default") }.getOrDefault(ReaderTheme.Default)) }
    var showAppearance by remember { mutableStateOf(false) }
    val scroll = rememberScrollState()
    val dark = isDark

    LaunchedEffect(articleId) { viewModel.load(articleId) }
    BackHandler(enabled = showAppearance) { showAppearance = false }

    // ألوان المظهر
    val bg = when (theme) { ReaderTheme.Sepia -> Color(0xFFFAF3E0); ReaderTheme.Charcoal -> Color(0xFF0B0F17); else -> if (dark) Tw.slate900 else Tw.white }
    val ink = when (theme) { ReaderTheme.Sepia -> Color(0xFF382B22); ReaderTheme.Charcoal -> Color(0xFFE2E8F0); else -> if (dark) Tw.slate100 else Tw.slate900 }
    val line = when (theme) { ReaderTheme.Sepia -> Color(0xFFE8DCC4); ReaderTheme.Charcoal -> Color(0xFF1E293B); else -> if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f) }

    // ── القراءة الصوتية (Web Speech ⇒ TextToSpeech الأصلي)
    var playing by remember { mutableStateOf(false) }
    var rate by remember { mutableStateOf(1.0f) }
    var audioNotice by remember { mutableStateOf<String?>(null) }
    var ttsReady by remember { mutableStateOf(false) }
    val tts = remember {
        var ref: TextToSpeech? = null
        ref = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                ref?.language = Locale("ar", "SA")
                ttsReady = true
            }
        }
        ref
    }
    DisposableEffect(Unit) { onDispose { tts?.stop(); tts?.shutdown() } }
    fun speak(a: studio.ai.literium.literium_app.data.model.Article) {
        val text = "${a.title}. ${a.description}. ${a.content.replace(Regex("[#*>`]"), "")}"
        tts?.setSpeechRate(rate)
        tts?.stop()
        val max = TextToSpeech.getMaxSpeechInputLength() - 100
        text.chunked(max.coerceAtLeast(500)).forEachIndexed { i, chunk ->
            tts?.speak(chunk, if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null, "lit_$i")
        }
        playing = true
    }

    // ── تقدّم القراءة (يُحفظ كل 5%)
    val progress by remember { derivedStateOf { if (scroll.maxValue > 0) (scroll.value.toFloat() / scroll.maxValue).coerceIn(0f, 1f) else 0f } }
    val showTop by remember { derivedStateOf { scroll.value > 400 } }
    LaunchedEffect(articleId, state.article?.id, scroll.maxValue) {
        val saved = prefs.getFloat("pos_$articleId", -1f)
        if (state.article != null && scroll.maxValue > 0 && saved in 5f..95f) scroll.scrollTo((scroll.maxValue * saved / 100f).toInt())
    }
    LaunchedEffect(progress) {
        val p = (progress * 100).toInt()
        if (p in 6..94) prefs.edit().putFloat("pos_$articleId", p.toFloat()).apply() else prefs.edit().remove("pos_$articleId").apply()
    }

    Box(Modifier.fillMaxSize().background(bg)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            // شريط التقدّم h-1
            Box(Modifier.fillMaxWidth().height(4.dp).background(if (dark) Tw.slate800 else Tw.slate200)) {
                Box(
                    Modifier.fillMaxWidth(progress).fillMaxHeight()
                        .background(Brush.horizontalGradient(listOf(Color(0xFF14B8A6), Color(0xFF06B6D4), Tw.amber500)))
                )
            }
            // رأس لاصق
            Column(Modifier.fillMaxWidth().background(bg.copy(alpha = 0.98f))) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        Modifier.clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100).twClickable(pressScale = 0.95f, onClick = onBack).padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        LuIcon(Lu.ArrowRight, 16.dp, if (dark) Tw.slate300 else Tw.slate700)
                        Text("رجوع", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        val pulse = rememberInfiniteTransition(label = "audioPulse").animateFloat(1f, 0.6f, infiniteRepeatable(tween(1000), RepeatMode.Reverse), label = "ap").value
                        HeaderBtn(if (playing) Lu.VolumeX else Lu.Volume2, active = playing, activeBg = Tw.amber500, activeFg = Tw.slate950, activeBorder = Tw.amber500, alphaV = if (playing) pulse else 1f) {
                            val a = state.article ?: return@HeaderBtn
                            if (!ttsReady || tts == null) { audioNotice = "ميزة القراءة الصوتية غير مدعومة في جهازك الحالي."; return@HeaderBtn }
                            if (playing) { tts.stop(); playing = false } else speak(a)
                        }
                        HeaderBtn(Lu.Sliders, active = showAppearance, activeBg = Tw.teal600, activeFg = Tw.white, activeBorder = Tw.teal600) { showAppearance = !showAppearance }
                        HeaderBtn(Lu.Bookmark, active = state.isBookmarked, activeBg = if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA), activeFg = if (dark) Tw.teal300 else Tw.teal600, activeBorder = if (dark) Color(0xFF115E59) else Color(0xFF5EEAD4)) { viewModel.toggleBookmark() }
                        HeaderBtn(Lu.Share2, active = false, activeBg = Color.Transparent, activeFg = Tw.slate500, activeBorder = Color.Transparent) {
                            val a = state.article ?: return@HeaderBtn
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, a.title)
                                putExtra(Intent.EXTRA_TEXT, (a.description.ifBlank { a.title }) + "\nhttps://literium.ai.studio/?article=${a.id}")
                            }
                            context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                            viewModel.shareArticle()
                        }
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(line))
            }
            audioNotice?.let { n ->
                Row(Modifier.fillMaxWidth().background(if (dark) Color(0xFF4C0519).copy(alpha = 0.70f) else Tw.rose50).padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(n, style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.rose200 else Color(0xFF9F1239))
                    Text("✕", Modifier.twClickable { audioNotice = null }, style = twText(12, FontWeight.Bold, 16), color = Tw.rose500)
                }
            }
            if (playing) {
                Row(
                    Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(Tw.amber500.copy(alpha = 0.10f), Color(0xFF14B8A6).copy(alpha = 0.10f), Color.Transparent))).padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(Tw.amber500))
                        Text("جاري القراءة الصوتية للمقال...", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.amber300 else Tw.amber700)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("السرعة:", style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
                        listOf(0.75f, 1.0f, 1.25f, 1.5f).forEach { r ->
                            Text(
                                "${r}x",
                                Modifier.clip(RoundedCornerShape(6.dp)).background(if (rate == r) Tw.amber500 else if (dark) Tw.slate800 else Tw.slate200).twClickable { rate = r; state.article?.let { speak(it) } }.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = twText(10, if (rate == r) FontWeight.Black else FontWeight.Bold, 15), color = if (rate == r) Tw.slate950 else if (dark) Tw.slate300 else Tw.slate600
                            )
                        }
                    }
                }
            }

            when {
                state.isLoading -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }
                state.notFound || state.article == null -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text("تعذر العثور على هذا المقال.", style = twText(13, FontWeight.Normal, 18), color = Tw.slate500)
                }
                else -> Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(scroll).padding(horizontal = 16.dp, vertical = 24.dp)) {
                    ReaderBody(state, viewModel, font, ink, line, dark, onWriterClick)
                    Box(Modifier.navigationBarsPadding())
                }
            }
        }

        // قائمة التخصيص (w-72 تحت الرأس، على جهة end)
        if (showAppearance) {
            AppearanceMenu(
                font, theme, dark,
                onFont = { font = it; prefs.edit().putString("font", it.name).apply() },
                onTheme = { theme = it; prefs.edit().putString("theme", it.name).apply() },
                modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = 70.dp, start = 14.dp, end = 14.dp)
            )
        }
        // زر الصعود: bottom-5 start-5
        if (showTop) {
            val sc = rememberCoroutineScopeCompat()
            Box(
                Modifier.align(Alignment.BottomStart).navigationBarsPadding().padding(20.dp)
                    .shadow(10.dp, CircleShape, ambientColor = Tw.teal600.copy(alpha = 0.30f), spotColor = Tw.teal600.copy(alpha = 0.30f))
                    .clip(CircleShape).background(Tw.teal600).twClickable(pressScale = 0.90f) { sc { scroll.animateScrollTo(0) } }.padding(12.dp)
            ) { LuIcon(Lu.ArrowUp, 20.dp, Tw.white) }
        }
    }
}

@Composable
private fun rememberCoroutineScopeCompat(): (suspend () -> Unit) -> Unit {
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    return { block -> scope.launch { block() } }
}

@Composable
private fun HeaderBtn(
    icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, activeBg: Color, activeFg: Color, activeBorder: Color,
    alphaV: Float = 1f, onClick: () -> Unit
) {
    val dark = isDark
    val s = RoundedCornerShape(12.dp)
    Box(
        Modifier.alpha(alphaV).clip(s)
            .background(if (active) activeBg else if (dark) Tw.slate800 else Tw.slate100)
            .border(1.dp, if (active) activeBorder else if (dark) Tw.slate700 else Tw.slate200, s)
            .twClickable(pressScale = 0.95f, onClick = onClick).padding(8.dp)
    ) { LuIcon(icon, 16.dp, if (active) activeFg else if (dark) Tw.slate300 else Tw.slate500) }
}

@Composable
private fun AppearanceMenu(font: ReaderFont, theme: ReaderTheme, dark: Boolean, onFont: (ReaderFont) -> Unit, onTheme: (ReaderTheme) -> Unit, modifier: Modifier) {
    val s = RoundedCornerShape(16.dp)
    Column(
        modifier.width(288.dp).shadow(16.dp, s).clip(s).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, s).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column {
            Text("حجم الخط:", Modifier.padding(bottom = 8.dp), style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(ReaderFont.Sm to "صغير", ReaderFont.Md to "متوسط", ReaderFont.Lg to "كبير", ReaderFont.Xl to "ضخم").forEach { (f, label) ->
                    Box(
                        Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(if (font == f) Tw.teal600 else Color.Transparent).twClickable { onFont(f) }.padding(vertical = 6.dp),
                        contentAlignment = Alignment.Center
                    ) { Text(label, style = twText(12, FontWeight.Bold, 16), color = if (font == f) Tw.white else if (dark) Tw.slate400 else Tw.slate600) }
                }
            }
        }
        Column {
            Text("مظهر ووضع القراءة:", Modifier.padding(bottom = 8.dp), style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ThemeChip(Modifier.weight(1f), Lu.Sun, "الافتراضي", theme == ReaderTheme.Default,
                    if (theme == ReaderTheme.Default) Tw.teal600 else if (dark) Tw.slate700 else Tw.slate200,
                    if (theme == ReaderTheme.Default) (if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFF0FDFA)) else if (dark) Tw.slate800 else Tw.slate50,
                    if (theme == ReaderTheme.Default) (if (dark) Tw.teal300 else Tw.teal700) else if (dark) Tw.slate400 else Tw.slate600, if (dark) Tw.slate300 else Tw.slate600) { onTheme(ReaderTheme.Default) }
                ThemeChip(Modifier.weight(1f), Lu.Coffee, "ورق دافئ", theme == ReaderTheme.Sepia,
                    if (theme == ReaderTheme.Sepia) Color(0xFFB45309) else Color(0xFFE8DCC4), if (theme == ReaderTheme.Sepia) Color(0xFFF7EED6) else Color(0xFFFBF0D9),
                    if (theme == ReaderTheme.Sepia) Color(0xFF4A3B32) else Color(0xFF5A483E), Color(0xFFB45309)) { onTheme(ReaderTheme.Sepia) }
                ThemeChip(Modifier.weight(1f), Lu.Moon, "فحمي ليلي", theme == ReaderTheme.Charcoal,
                    if (theme == ReaderTheme.Charcoal) Tw.slate500 else Tw.slate800, if (theme == ReaderTheme.Charcoal) Tw.slate950 else Tw.slate900,
                    if (theme == ReaderTheme.Charcoal) Tw.slate100 else Tw.slate400, brand400()) { onTheme(ReaderTheme.Charcoal) }
            }
        }
    }
}

@Composable
private fun brand400() = studio.ai.literium.literium_app.ui.theme.brand.s400

@Composable
private fun ThemeChip(modifier: Modifier, icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, selected: Boolean, border: Color, bg: Color, fg: Color, iconTint: Color, onClick: () -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Column(
        modifier.clip(s).background(bg).border(1.dp, border, s).twClickable(onClick = onClick).padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        LuIcon(icon, 16.dp, iconTint)
        Text(label, style = twText(11, FontWeight.Bold, 16), color = fg, maxLines = 1)
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun ReaderBody(
    state: ArticleReaderUiState, viewModel: ArticleReaderViewModel, font: ReaderFont,
    ink: Color, line: Color, dark: Boolean, onWriterClick: (String) -> Unit
) {
    val article = state.article!!
    var commentText by remember { mutableStateOf("") }
    var replyingId by remember { mutableStateOf<String?>(null) }
    var replyText by remember { mutableStateOf("") }

    // الفئة + القراءات
    Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            readerCategory(article.category),
            Modifier.clip(CircleShape).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.70f) else Color(0xFFCCFBF1)).border(1.dp, if (dark) Color(0xFF115E59) else Color(0xFF99F6E4), CircleShape).padding(horizontal = 12.dp, vertical = 4.dp),
            style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal700
        )
        Box(Modifier.weight(1f))
        LuIcon(Lu.Eye, 14.dp, Color(0xFF14B8A6))
        Text("${arNum(article.viewsCount)} قراءة", style = twText(12, FontWeight.Medium, 16), color = Tw.slate400)
    }
    Text(article.title, Modifier.padding(bottom = 16.dp), style = twText(20, FontWeight.Black, 25).copy(letterSpacing = (-0.5).sp), color = ink)
    Row(Modifier.padding(bottom = 24.dp).fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min)) {
        Box(Modifier.width(4.dp).fillMaxHeight().background(Color(0xFF14B8A6)))
        Box(Modifier.width(12.dp))
        Text(article.description, Modifier.alpha(0.9f), style = twText(14, FontWeight.Medium, 23), color = ink)
    }

    // بطاقة الكاتب
    val cardShape = RoundedCornerShape(16.dp)
    Row(
        Modifier.padding(bottom = 24.dp).fillMaxWidth().clip(cardShape).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50)
            .border(1.dp, if (dark) Tw.slate700.copy(alpha = 0.80f) else Tw.slate200.copy(alpha = 0.80f), cardShape).padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
    ) {
        Row(Modifier.weight(1f).twClickable { onWriterClick(article.writerId) }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            val av = RoundedCornerShape(16.dp)
            AsyncImage(article.writerAvatar, article.writerName, Modifier.size(48.dp).clip(av).border(2.dp, Color(0xFF14B8A6).copy(alpha = 0.50f), av), contentScale = ContentScale.Crop)
            Column {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(article.writerName, style = twText(14, FontWeight.Bold, 20), color = ink)
                    if (article.writerIsVerified) LuIcon(Lu.CheckCircle2, 16.dp, if (dark) Tw.teal300 else Tw.teal600)
                }
                Text(
                    "نُشر في ${DateFormatAr.formatDateTimeAr(article.publishedAt)} (${DateFormatAr.timeAgoAr(article.publishedAt)}) • ${article.readingTimeMinutes} دقائق قراءة",
                    style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500
                )
            }
        }
        Box(Modifier.width(12.dp))
        Text(
            if (state.isFollowingWriter) "تتابعه" else "+ متابعة",
            Modifier.clip(RoundedCornerShape(12.dp)).background(if (state.isFollowingWriter) (if (dark) Tw.slate700 else Tw.slate200) else Tw.teal600).twClickable(pressScale = 0.95f) { viewModel.toggleFollowWriter() }.padding(horizontal = 16.dp, vertical = 8.dp),
            style = twText(12, FontWeight.Bold, 16), color = if (state.isFollowingWriter) (if (dark) Tw.slate200 else Tw.slate700) else Tw.white
        )
    }

    // الصورة الرئيسية h-64 rounded-3xl
    val imgShape = RoundedCornerShape(24.dp)
    AsyncImage(
        article.featuredImage, article.title,
        Modifier.padding(bottom = 32.dp).fillMaxWidth().height(256.dp).shadow(1.dp, imgShape, clip = false).clip(imgShape).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, imgShape),
        contentScale = ContentScale.Crop
    )

    // النص (مع إعلان منتصفي للمقالات الطويلة)
    val paragraphs = article.content.split("\n\n").filter { it.isNotBlank() }
    val words = article.content.split(Regex("\\s+")).count { it.isNotBlank() }
    val showMid = words >= 500 && paragraphs.size >= 7
    val bodyStyle = twText(font.sp, FontWeight.Normal, font.lh)
    if (!showMid) {
        Text(article.content, style = bodyStyle, color = ink)
    } else {
        val mid = minOf(maxOf((paragraphs.size * 0.4).toInt(), 3), maxOf(paragraphs.size - 3, 3))
        Column {
            paragraphs.forEachIndexed { i, p ->
                Text(p, Modifier.padding(bottom = 16.dp), style = bodyStyle, color = ink)
                if (i == mid - 1) AdSlot(slotId = AdSlotId.ARTICLE_MID)
            }
        }
    }

    // فيديو + مصدر
    val uploaded = article.uploadedVideoUrl
    if (!uploaded.isNullOrBlank()) {
        VideoPlayer(src = uploaded, modifier = Modifier.padding(vertical = 24.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tw.slate950))
    } else if (!article.videoUrl.isNullOrBlank()) {
        Box(Modifier.padding(vertical = 24.dp)) { VideoEmbed(url = article.videoUrl!!) }
    }
    article.sourceUrl?.takeIf { it.isNotBlank() }?.let { src ->
        Row(Modifier.padding(vertical = 16.dp)) {
            Text("المصدر: ", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate400 else Tw.slate500)
            Text(src, style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.teal300 else Tw.teal600)
        }
    }
    AdSlot(slotId = AdSlotId.ARTICLE_BOTTOM)

    // الوسوم
    if (article.tags.isNotEmpty()) {
        Column(Modifier.padding(top = 32.dp)) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate200))
            androidx.compose.foundation.layout.FlowRow(Modifier.padding(top = 24.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("الوسوم:", style = twText(12, FontWeight.Bold, 16), color = Tw.slate400)
                article.tags.forEach { tag ->
                    Text("#$tag", Modifier.clip(RoundedCornerShape(8.dp)).background(if (dark) Tw.slate800 else Tw.slate100).padding(horizontal = 10.dp, vertical = 4.dp), style = twText(12, FontWeight.Medium, 16), color = if (dark) Tw.slate300 else Tw.slate600)
                }
            }
        }
    }

    // التفاعلات + التقييم
    val boxShape = RoundedCornerShape(24.dp)
    Column(
        Modifier.padding(vertical = 32.dp).fillMaxWidth().clip(boxShape).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50)
            .border(1.dp, if (dark) Tw.slate700.copy(alpha = 0.80f) else Tw.slate200, boxShape).padding(16.dp)
    ) {
        Text("ما هو انطباعك عن هذا المقال؟", Modifier.fillMaxWidth().padding(bottom = 12.dp), style = twText(12, FontWeight.Bold, 16).copy(textAlign = TextAlign.Center), color = ink)
        androidx.compose.foundation.layout.FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("love" to ("❤️" to "أحببته"), "insightful" to ("💡" to "ملهم ومفيد"), "funny" to ("😂" to "طريف"), "surprised" to ("😲" to "مدهش"), "sad" to ("😢" to "مؤثر")).forEach { (type, pair) ->
                val on = state.activeReaction == type
                val s = RoundedCornerShape(12.dp)
                Row(
                    Modifier.clip(s).background(if (on) Tw.teal600 else if (dark) Tw.slate800 else Tw.white).border(1.dp, if (on) Tw.teal600 else if (dark) Tw.slate700 else Tw.slate200, s)
                        .twClickable(pressScale = 0.95f) { viewModel.setReaction(type) }.padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(pair.first, style = twText(16, FontWeight.Normal, 24))
                    Text(pair.second, style = twText(12, FontWeight.SemiBold, 16), color = if (on) Tw.white else if (dark) Tw.slate300 else Tw.slate700)
                }
            }
        }
        Box(Modifier.padding(top = 16.dp).fillMaxWidth().height(1.dp).background(if (dark) Tw.slate700 else Tw.slate200))
        Column(Modifier.padding(top = 16.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("تقييم المقال:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Ltr) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        (1..5).forEach { star ->
                            val filled = star <= state.myRating
                            Box(Modifier.twClickable(pressScale = 0.90f) { viewModel.rate(star) }.padding(4.dp), contentAlignment = Alignment.Center) {
                                if (filled) Box(Modifier.size(12.dp).clip(CircleShape).background(Tw.amber400))
                                LuIcon(Lu.Star, 20.dp, if (filled) Tw.amber400 else if (dark) Tw.slate600 else Tw.slate300)
                            }
                        }
                    }
                }
            }
            Text(
                if (article.ratingsCount > 0) "${"%.1f".format(Locale.US, article.rating)} ★ من ${article.ratingsCount} تقييم" else "كن أول من يقيّم هذا المقال",
                style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate400 else Tw.slate500
            )
        }
    }

    // شريط الإعجاب/المشاركة
    Column(Modifier.padding(bottom = 32.dp).fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate200))
        Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            val s = RoundedCornerShape(12.dp)
            Row(
                Modifier.clip(s).background(if (state.isLiked) (if (dark) Color(0xFF4C0519).copy(alpha = 0.50f) else Tw.rose50) else if (dark) Tw.slate800 else Tw.slate100)
                    .border(1.dp, if (state.isLiked) (if (dark) Color(0xFF9F1239) else Tw.rose200) else Color.Transparent, s)
                    .twClickable(pressScale = 0.95f) { viewModel.toggleLike() }.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (state.isLiked) Box(Modifier.size(10.dp).clip(CircleShape).background(Tw.rose600))
                    LuIcon(Lu.Heart, 16.dp, if (state.isLiked) Tw.rose600 else if (dark) Tw.slate300 else Tw.slate700)
                }
                Text("${article.likesCount} إعجاب", style = twText(12, FontWeight.Bold, 16), color = if (state.isLiked) Tw.rose600 else if (dark) Tw.slate300 else Tw.slate700)
            }
            val context = LocalContext.current
            Row(
                Modifier.clip(s).background(if (dark) Tw.slate800 else Tw.slate100).twClickable(pressScale = 0.95f) {
                    val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, (article.description.ifBlank { article.title }) + "\nhttps://literium.ai.studio/?article=${article.id}") }
                    context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); viewModel.shareArticle()
                }.padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                LuIcon(Lu.Share2, 16.dp, if (dark) Tw.slate300 else Tw.slate700)
                Text("مشاركة", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate200))
    }

    // التعليقات
    Row(Modifier.padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LuIcon(Lu.MessageSquare, 20.dp, Tw.teal600)
        Text("التعليقات والمناقشات (${state.comments.size})", style = twText(16, FontWeight.Bold, 24), color = ink)
    }
    val boxS = RoundedCornerShape(16.dp)
    Column(Modifier.padding(bottom = 24.dp).fillMaxWidth().clip(boxS).background(if (dark) Tw.slate800.copy(alpha = 0.80f) else Tw.white).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, boxS).padding(12.dp)) {
        Box(Modifier.fillMaxWidth().heightIn(min = 72.dp)) {
            if (commentText.isEmpty()) Text("أضف رأيك أو سؤالك حول المقال للكاتب والقراء...", style = twText(14, FontWeight.Normal, 20), color = Tw.slate400)
            BasicTextField(commentText, { commentText = it }, minLines = 3, textStyle = twText(14, FontWeight.Normal, 20).copy(color = ink), cursorBrush = SolidColor(Tw.teal600), modifier = Modifier.fillMaxWidth())
        }
        Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(1.dp).background(if (dark) Tw.slate700.copy(alpha = 0.60f) else Tw.slate100))
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("شارك برقي واحترام", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
            val ok = commentText.isNotBlank()
            Row(
                Modifier.alpha(if (ok) 1f else 0.5f).clip(RoundedCornerShape(12.dp)).background(Tw.teal600).twClickable(enabled = ok, pressScale = 0.95f) { viewModel.addComment(commentText); commentText = "" }.padding(horizontal = 16.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("نشر التعليق", style = twText(12, FontWeight.Bold, 16), color = Tw.white)
                LuIcon(Lu.Send, 12.dp, Tw.white, Modifier.rotate(180f))
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        state.comments.forEachIndexed { idx, comm ->
            if (idx == 3 && state.comments.size >= 5) AdSlot(slotId = AdSlotId.COMMENTS_FEED)
            ArticleComment(comm, state.currentUserId, replyingId == comm.id, replyText, { replyText = it }, ink, dark,
                onLike = { viewModel.likeComment(comm.id) },
                onToggleReply = { replyingId = if (replyingId == comm.id) null else comm.id },
                onSubmitReply = { if (replyText.isNotBlank()) { viewModel.replyToComment(comm.id, replyText); replyText = ""; replyingId = null } })
        }
    }
    Box(Modifier.height(48.dp))
}


@Composable
private fun ArticleComment(
    c: Comment, currentUserId: String?, replying: Boolean, replyText: String, onReplyText: (String) -> Unit, ink: Color, dark: Boolean,
    onLike: () -> Unit, onToggleReply: () -> Unit, onSubmitReply: () -> Unit
) {
    val shape = RoundedCornerShape(16.dp)
    val pinned = c.isPinned == true
    Column(
        Modifier.fillMaxWidth().clip(shape)
            .background(if (pinned) (if (dark) Color(0xFF042F2E).copy(alpha = 0.30f) else Color(0xFFF0FDFA).copy(alpha = 0.70f)) else if (dark) Tw.slate800.copy(alpha = 0.50f) else Tw.slate50.copy(alpha = 0.70f))
            .border(1.dp, if (pinned) (if (dark) Color(0xFF115E59) else Color(0xFF99F6E4)) else if (dark) Tw.slate800 else Tw.slate200.copy(alpha = 0.80f), shape).padding(16.dp)
    ) {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AsyncImage(c.userAvatar, c.userName, Modifier.size(32.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                Column {
                    Text(c.userName, style = twText(12, FontWeight.Bold, 16), color = ink)
                    Text(DateFormatAr.timeAgoAr(c.createdAt), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
                }
            }
            if (pinned) Text("📌 تعليق مثبت", Modifier.clip(CircleShape).background(if (dark) Color(0xFF042F2E) else Color(0xFFCCFBF1)).padding(horizontal = 8.dp, vertical = 2.dp), style = twText(10, FontWeight.Bold, 15), color = if (dark) Tw.teal300 else Tw.teal600)
        }
        Text(c.content, Modifier.padding(bottom = 12.dp), style = twText(12, FontWeight.Normal, 20), color = ink)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            val liked = c.likedBy?.contains(currentUserId ?: "") == true
            Row(Modifier.twClickable(pressScale = 0.95f, onClick = onLike), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                LuIcon(Lu.Heart, 14.dp, if (liked) Tw.rose500 else Tw.slate500)
                Text("${c.likesCount}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
            }
            Row(Modifier.twClickable(pressScale = 0.95f, onClick = onToggleReply), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                LuIcon(Lu.CornerDownLeft, 14.dp, Tw.slate500)
                Text("رد", style = twText(12, FontWeight.Medium, 16), color = Tw.slate500)
            }
        }
        if (replying) {
            Row(Modifier.padding(top = 12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                val s = RoundedCornerShape(12.dp)
                Box(Modifier.weight(1f).clip(s).background(if (dark) Tw.slate800 else Tw.white).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, s).padding(horizontal = 12.dp, vertical = 6.dp)) {
                    if (replyText.isEmpty()) Text("رد على ${c.userName}...", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                    BasicTextField(replyText, onReplyText, singleLine = true, textStyle = twText(12, FontWeight.Normal, 16).copy(color = ink), cursorBrush = SolidColor(Tw.teal600), modifier = Modifier.fillMaxWidth())
                }
                Text("إرسال", Modifier.clip(s).background(Tw.teal600).twClickable(pressScale = 0.95f, onClick = onSubmitReply).padding(horizontal = 12.dp, vertical = 6.dp), style = twText(12, FontWeight.Bold, 16), color = Tw.white)
            }
        }
        if (c.replies.isNotEmpty()) {
            Column(Modifier.padding(top = 12.dp).fillMaxWidth().padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                c.replies.forEach { r ->
                    val rs = RoundedCornerShape(12.dp)
                    Column(Modifier.fillMaxWidth().clip(rs).background(if (dark) Tw.slate800.copy(alpha = 0.90f) else Tw.white).border(1.dp, if (dark) Tw.slate700.copy(alpha = 0.60f) else Tw.slate200.copy(alpha = 0.60f), rs).padding(10.dp)) {
                        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                AsyncImage(r.userAvatar, r.userName, Modifier.size(24.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                                Text(r.userName, style = twText(12, FontWeight.Bold, 16), color = ink)
                            }
                            Text(DateFormatAr.timeAgoAr(r.createdAt), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
                        }
                        Text(r.content, Modifier.alpha(0.9f), style = twText(12, FontWeight.Normal, 16), color = ink)
                    }
                }
            }
        }
    }
}
