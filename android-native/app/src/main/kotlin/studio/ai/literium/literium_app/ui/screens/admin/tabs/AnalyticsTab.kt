package studio.ai.literium.literium_app.ui.screens.admin.tabs

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

private fun parseMs(iso: String?): Long? = iso?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
private fun nf(n: Int) = String.format(java.util.Locale.US, "%,d", n)

/** "مركز الإحصائيات العامة والتحقق اللحظي" — ترجمة حرفية لـ AdminAnalyticsTab.tsx (التصفير مستبعد عمداً من واجهة الجوال البرمجية). */
@Composable
fun AnalyticsTab(
    viewModel: AdminViewModel,
    users: List<User>,
    articles: List<Article>,
    campaigns: List<AdCampaign>,
    depositRequests: List<DepositRequest>,
    payoutRequests: List<PayoutRequest>,
    onOpenUser: (String) -> Unit = {},
    onOpenArticle: (String) -> Unit = {}
) {
    val summary by viewModel.analyticsSummary.collectAsState()
    val isLoading by viewModel.isLoadingAnalytics.collectAsState()
    val error by viewModel.analyticsError.collectAsState()
    var sub by remember { mutableStateOf("overview") }
    var search by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { viewModel.loadAnalyticsSummary() }

    val real = users.filterNot { it.isBot == true }
    val registeredUsers = real.filter { it.id != "guest" }
    val readers = real.count { it.role == "reader" && it.id != "guest" }
    val writers = real.count { it.role == "writer" }
    val advertisers = real.count { it.role == "advertiser" }
    val verified = real.count { it.isVerified == true }
    val startOfToday = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val weekAgo = System.currentTimeMillis() - 7L * 24 * 3600 * 1000
    val signupsToday = registeredUsers.count { (parseMs(it.createdAt) ?: -1) >= startOfToday }
    val signupsWeek = registeredUsers.count { (parseMs(it.createdAt) ?: -1) >= weekAgo }
    val publishingWriters = articles.mapNotNull { it.writerId.takeIf { id -> id.isNotBlank() } }.toSet().size
    val locked = articles.count { it.isLocked }
    val totalViews = articles.sumOf { it.viewsCount }
    val activeCampaigns = campaigns.count { it.status == "active" }
    val q = search.trim().lowercase()

    val s16 = RoundedCornerShape(16.dp)
    val s24 = RoundedCornerShape(24.dp)

    @Composable
    fun BigStat(title: String, value: String, unit: String?, unitColor: Color, icon: ImageVector, iconTint: Color, border: Color, line: @Composable () -> Unit, modifier: Modifier) {
        Column(modifier.clip(s24).background(Tw.slate900).border(1.dp, border, s24).padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(title, Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = Tw.slate400)
                Box(Modifier.clip(RoundedCornerShape(12.dp)).background(iconTint.copy(alpha = 0.1f)).padding(8.dp)) { LuIcon(icon, 16.dp, iconTint) }
            }
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(value, style = twText(24, FontWeight.Black, 32), color = Color.White, fontFamily = Adm.mono)
                if (unit != null) Text(unit, Modifier.padding(bottom = 3.dp), style = twText(12, FontWeight.Bold, 16), color = unitColor)
            }
            Column(Modifier.padding(top = 8.dp)) { line() }
        }
    }
    @Composable
    fun Pair2(a: String, av: String, avColor: Color, b: String, bv: String, bvColor: Color) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Row { Text("$a ", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400); Text(av, style = twText(11, FontWeight.Bold, 16), color = avColor, fontFamily = Adm.mono) }
            Row { Text("$b ", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400); Text(bv, style = twText(11, FontWeight.Bold, 16), color = bvColor, fontFamily = Adm.mono) }
        }
    }
    @Composable
    fun Panel(content: @Composable () -> Unit) {
        Column(Modifier.fillMaxWidth().clip(s24).background(Tw.slate900).border(1.dp, Tw.slate800, s24).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { content() }
    }
    @Composable
    fun Head(icon: ImageVector, tint: Color, title: String, sub: String? = null) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(icon, 16.dp, tint); Text(title, style = twText(14, FontWeight.Bold, 20), color = Color.White)
            }
            if (sub != null) Text(sub, Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(Modifier.fillMaxWidth().clip(s24).background(Tw.slate900).border(1.dp, Tw.slate800, s24).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(listOf(Adm.emerald500, Color(0xFF2DD4BF)))), contentAlignment = Alignment.Center) { LuIcon(Lu.Activity, 24.dp, Tw.slate950) }
                Column {
                    Text("مركز الإحصائيات العامة والتحقق اللحظي", style = twText(16, FontWeight.Black, 24), color = Color.White)
                    Row(Modifier.padding(top = 2.dp).clip(RoundedCornerShape(50)).background(Adm.emerald500.copy(alpha = 0.1f)).border(1.dp, Adm.emerald500.copy(alpha = 0.2f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(Adm.emerald400))
                        Text("بيانات حقيقية من الخادم", style = twText(10, FontWeight.Bold, 14), color = Color(0xFF6EE7B7))
                    }
                }
            }
            Text("كل رقم هنا مسجَّل فعلياً في قاعدة البيانات عند كل زيارة وكل تسجيل — لا توجد أرقام تقديرية.", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            AdmButton("تحديث", { viewModel.loadAnalyticsSummary() }, Tw.slate800, Tw.slate300, icon = Lu.RefreshCw, enabled = !isLoading)
        }

        error?.let {
            Row(Modifier.fillMaxWidth().clip(s16).background(Color(0xFFEF4444).copy(alpha = 0.1f)).border(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f), s16).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                LuIcon(Lu.AlertTriangle, 16.dp, Color(0xFFFCA5A5)); Text(it, style = twText(12, FontWeight.Normal, 16), color = Color(0xFFFCA5A5))
            }
        }

        val sm = summary
        val loadingText = isLoading && sm == null
        AdmStatGrid(listOf(
            { m -> BigStat("الزوار (آخر 24 ساعة)", if (loadingText) "…" else nf(sm?.visitorsLast24h ?: 0), "زائر", Adm.emerald400, Lu.Eye, Adm.emerald400, Adm.emerald500.copy(alpha = 0.3f),
                { Pair2("المشاهدات:", "${sm?.pageViewsLast24h ?: 0}", Tw.slate200, "اليوم:", "${sm?.visitorsToday ?: 0}", Color(0xFF6EE7B7)) }, m) },
            { m -> BigStat("إجمالي الزوار التراكمي", if (loadingText) "…" else nf(sm?.totalVisitors ?: 0), "فريد", Color(0xFF2DD4BF), Lu.Globe, Color(0xFF2DD4BF), Tw.slate800,
                { Pair2("إجمالي المشاهدات:", nf(sm?.totalPageViews ?: 0), Tw.slate200, "", "", Tw.slate200) }, m) },
            { m -> BigStat("إجمالي المسجلين", nf(registeredUsers.size), "عضو", Adm.blue400, Lu.Users, Adm.blue400, Adm.blue500.copy(alpha = 0.3f),
                { Pair2("اليوم:", "+$signupsToday", Adm.emerald400, "هذا الأسبوع:", "+$signupsWeek", Adm.blue300) }, m) },
            { m -> BigStat("الإعلانات والمقالات", "$activeCampaigns", "بنر نشط", Adm.amber400, Lu.Megaphone, Adm.amber400, Adm.amber500.copy(alpha = 0.3f),
                { Pair2("إجمالي البنرات:", "${campaigns.size}", Tw.slate200, "المقالات:", "${articles.size}", Adm.amber300) }, m) }
        ))

        AdmStatGrid(listOf(
            { m -> BigStat("عمليات الإيداع", "${depositRequests.size}", null, Color.White, Lu.ArrowDownRight, Adm.emerald400, Tw.slate800,
                { Pair2("مقبولة:", "${depositRequests.count { it.status == "approved" }}", Adm.emerald400, "قيد الانتظار:", "${depositRequests.count { it.status == "pending" }}", Adm.amber400) }, m) },
            { m -> BigStat("عمليات السحب", "${payoutRequests.size}", null, Color.White, Lu.ArrowUpRight, Adm.rose400, Tw.slate800,
                { Pair2("مدفوعة:", "${payoutRequests.count { it.status == "paid" }}", Adm.emerald400, "قيد الانتظار:", "${payoutRequests.count { it.status == "pending" }}", Adm.amber400) }, m) },
            { m -> BigStat("الكُتّاب الناشرون", "$publishingWriters", null, Color.White, Lu.PenSquare, Color(0xFFC084FC), Tw.slate800,
                { Pair2("من إجمالي", "$writers", Color(0xFFD8B4FE), "حساب كاتب", "", Tw.slate400) }, m) },
            { m -> BigStat("المقالات الحصرية المدفوعة", "$locked", null, Color.White, Lu.Lock, Adm.amber400, Tw.slate800,
                { Pair2("من إجمالي", "${articles.size}", Adm.amber300, "مقال", "", Tw.slate400) }, m) }
        ))

        // شريط التبويبات الفرعية
        Row(Modifier.fillMaxWidth().clip(s16).background(Tw.slate900).border(1.dp, Tw.slate800, s16).horizontalScroll(rememberScrollState()).padding(6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                Triple("overview", "الرسوم والمؤشرات البصرية", Lu.TrendingUp) to null,
                Triple("visitors_stream", "سجل الزيارات الحقيقي", Lu.Eye) to (sm?.recentVisits?.size ?: 0),
                Triple("signups_log", "سجل المسجلين والاشتراكات", Lu.UserPlus) to (users.size - 1).coerceAtLeast(0),
                Triple("content_ads", "أداء المقالات والإعلانات", Lu.FileText) to null
            ).forEach { (t, count) ->
                val on = sub == t.first
                Row(Modifier.clip(RoundedCornerShape(12.dp)).background(if (on) Adm.emerald600 else Color.Transparent).twClickable(pressScale = 1f) { sub = t.first; search = "" }.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LuIcon(t.third, 16.dp, if (on) Color.White else Tw.slate400)
                    Text(t.second, style = twText(12, FontWeight.Bold, 16), color = if (on) Color.White else Tw.slate400, maxLines = 1)
                    if (count != null) Text("$count", Modifier.clip(RoundedCornerShape(50)).background(if (on) Color.White.copy(alpha = 0.2f) else Tw.slate800).padding(horizontal = 6.dp, vertical = 1.dp),
                        style = twText(10, FontWeight.Bold, 14), color = if (on) Color.White else Tw.slate300, fontFamily = Adm.mono)
                }
            }
        }

        when (sub) {
            "overview" -> Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Panel {
                    Head(Lu.Activity, Adm.emerald400, "حركة الزيارات والمشاهدات على مدار الـ 24 ساعة الماضية", "توزيع تدفق الزوار والمشاهدات الحقيقية خلال فترات اليوم (كل عمود = ساعتان).")
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Box(Modifier.size(10.dp).clip(RoundedCornerShape(2.dp)).background(Adm.emerald500)); Text("المشاهدات", style = twText(12, FontWeight.Normal, 16), color = Adm.emerald400, fontFamily = Adm.mono) }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Box(Modifier.size(10.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFF2DD4BF))); Text("الزوار", style = twText(12, FontWeight.Normal, 16), color = Color(0xFF5EEAD4), fontFamily = Adm.mono) }
                    }
                    if (sm == null || sm.hourlyTraffic.all { it.views == 0 }) {
                        Text(if (isLoading) "جارٍ تحميل حركة الزيارات..." else "لا توجد زيارات مسجَّلة بعد خلال آخر 24 ساعة.", Modifier.fillMaxWidth().padding(vertical = 40.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500, textAlign = TextAlign.Center)
                    } else {
                        val maxView = maxOf(sm.hourlyTraffic.maxOf { it.views }, 1)
                        Row(Modifier.fillMaxWidth().height(176.dp).padding(top = 24.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                            sm.hourlyTraffic.forEach { item ->
                                val vh = maxOf(Math.round(item.views.toFloat() / maxView * 100), if (item.views > 0) 8 else 2)
                                val uh = maxOf(Math.round(item.visitors.toFloat() / maxView * 100), if (item.visitors > 0) 5 else 2)
                                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Row(Modifier.fillMaxWidth().height(110.dp), horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom) {
                                        Box(Modifier.weight(1f).fillMaxHeight(vh / 100f).clip(RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp)).background(Brush.verticalGradient(listOf(Adm.emerald400, Adm.emerald600))))
                                        Box(Modifier.weight(1f).fillMaxHeight(uh / 100f).clip(RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp)).background(Brush.verticalGradient(listOf(Color(0xFF5EEAD4), Color(0xFF0D9488)))))
                                    }
                                    Text(item.hour, style = twText(9, FontWeight.Normal, 12), color = Tw.slate500, fontFamily = Adm.mono, maxLines = 1, overflow = TextOverflow.Clip)
                                }
                            }
                        }
                        Box(Modifier.fillMaxWidth().height(1.dp).background(Tw.slate800))
                    }
                }
                Panel {
                    Head(Lu.Smartphone, Adm.blue400, "توزيع الأجهزة (آخر 24 ساعة)")
                    listOf(Triple("الجوال (Mobile)", sm?.deviceBreakdown?.mobile ?: 0, Lu.Smartphone) to Adm.blue500,
                        Triple("الكمبيوتر (Desktop)", sm?.deviceBreakdown?.desktop ?: 0, Lu.Monitor) to Color(0xFFA855F7),
                        Triple("الأجهزة اللوحية (Tablet)", sm?.deviceBreakdown?.tablet ?: 0, Lu.Tablet) to Adm.amber500).forEach { (t, color) ->
                        Column {
                            Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { LuIcon(t.third, 14.dp, color); Text(t.first, style = twText(12, FontWeight.Normal, 16), color = Tw.slate300) }
                                Text("${t.second}%", style = twText(12, FontWeight.Bold, 16), color = Color.White, fontFamily = Adm.mono)
                            }
                            Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)).background(Tw.slate800)) {
                                Box(Modifier.fillMaxHeight().fillMaxWidth((t.second.coerceIn(0, 100)) / 100f).clip(RoundedCornerShape(50)).background(color))
                            }
                        }
                    }
                }
                Panel {
                    Head(Lu.Users, Adm.emerald400, "توزيع أدوار المستخدمين المسجلين")
                    AdmStatGrid(listOf<@Composable (Modifier) -> Unit>(
                        { m -> RoleCell("القُرّاء (Readers)", readers, Color.White, m) },
                        { m -> RoleCell("الكُتّاب (Writers)", writers, Adm.emerald400, m) },
                        { m -> RoleCell("المعلنون (Advertisers)", advertisers, Adm.amber400, m) },
                        { m -> RoleCell("حسابات موثقة (Verified)", verified, Adm.blue400, m) }
                    ))
                }
            }
            "visitors_stream" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                AdmSearch(search, { search = it }, "البحث في الصفحة أو المسار...")
                Row(Modifier.fillMaxWidth().clip(s16).background(Tw.slate900.copy(alpha = 0.6f)).border(1.dp, Tw.slate800, s16).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    LuIcon(Lu.Radio, 16.dp, Adm.emerald400)
                    Text("كل صف هنا زيارة حقيقية سُجِّلت في قاعدة البيانات لحظة حدوثها (دون تخزين عنوان IP حفاظاً على الخصوصية).", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
                val visits = (sm?.recentVisits ?: emptyList()).filter { q.isEmpty() || (it.pageTitle ?: "").lowercase().contains(q) || (it.path ?: "").lowercase().contains(q) }
                if (visits.isEmpty()) Text(if (isLoading) "جارٍ التحميل..." else "لا توجد زيارات مطابقة بعد.", Modifier.fillMaxWidth().padding(vertical = 32.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate500, textAlign = TextAlign.Center)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    visits.forEach { v ->
                        Row(Modifier.fillMaxWidth().clip(s16).background(Tw.slate900).border(1.dp, Tw.slate800, s16).padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                AdmFlow {
                                    AdmBadge(if (v.isRegistered == true) "عضو مسجل" else "زائر غير مسجل", if (v.isRegistered == true) Adm.blue300 else Tw.slate400,
                                        if (v.isRegistered == true) Adm.blue500.copy(alpha = 0.2f) else Tw.slate800, if (v.isRegistered == true) Adm.blue500.copy(alpha = 0.3f) else null, mono = false)
                                    Text(v.pageTitle?.ifBlank { null } ?: v.path ?: "", style = twText(12, FontWeight.Bold, 16), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                Text("المسار: ${v.path ?: ""}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = Adm.mono)
                            }
                            Column(Modifier.padding(start = 8.dp), horizontalAlignment = Alignment.End) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    LuIcon(when (v.device) { "mobile" -> Lu.Smartphone; "tablet" -> Lu.Tablet; else -> Lu.Monitor }, 14.dp,
                                        when (v.device) { "mobile" -> Adm.blue400; "tablet" -> Adm.amber400; else -> Color(0xFFC084FC) })
                                    Text(v.browser ?: "", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                                }
                                Text(v.timestamp?.let { DateFormatAr.timeAgoAr(it) } ?: "", style = twText(10, FontWeight.Normal, 14), color = Tw.slate500, fontFamily = Adm.mono)
                            }
                        }
                    }
                }
            }
            "signups_log" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                AdmSearch(search, { search = it }, "البحث في المسجلين بالاسم، البريد، أو المعرف...")
                val list = registeredUsers.sortedByDescending { parseMs(it.createdAt) ?: 0L }.filter {
                    q.isEmpty() || it.fullName.lowercase().contains(q) || it.username.lowercase().contains(q) || it.email.lowercase().contains(q) || it.role.lowercase().contains(q)
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    list.forEach { u ->
                        val (bg, fg) = when (u.role) {
                            "admin" -> Color(0xFFA855F7).copy(alpha = 0.2f) to Color(0xFFD8B4FE)
                            "writer" -> Adm.emerald500.copy(alpha = 0.2f) to Color(0xFF6EE7B7)
                            "advertiser" -> Adm.amber500.copy(alpha = 0.2f) to Adm.amber300
                            else -> Adm.blue500.copy(alpha = 0.2f) to Adm.blue300
                        }
                        Column(Modifier.fillMaxWidth().clip(s16).background(Tw.slate900).border(1.dp, Tw.slate800, s16).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                AsyncImage(u.avatarUrl.ifBlank { "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" }, u.fullName, Modifier.size(40.dp).clip(CircleShape).border(1.dp, Tw.slate700, CircleShape), contentScale = ContentScale.Crop)
                                Column(Modifier.weight(1f)) {
                                    AdmFlow {
                                        Text(u.fullName, style = twText(12, FontWeight.Bold, 16), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        if (u.isVerified == true) LuIcon(Lu.CheckCircle2, 14.dp, Adm.blue400)
                                        Text(u.role.uppercase(), Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 2.dp), style = twText(9, FontWeight.Bold, 12), color = fg, fontFamily = Adm.mono)
                                    }
                                    Text("@${u.username} • ${u.email}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("انضم: ${u.createdAt?.let { DateFormatAr.timeAgoAr(it) } ?: "عضو مسجل"}", style = twText(11, FontWeight.Bold, 16), color = Adm.emerald400, fontFamily = Adm.mono)
                                Text("معاينة الحساب ←", Modifier.twClickable { onOpenUser(u.id) }, style = twText(11, FontWeight.Bold, 16), color = Adm.blue400)
                            }
                        }
                    }
                }
            }
            else -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                @Composable
                fun Mini(title: String, value: String, color: Color, note: String, noteColor: Color) {
                    Column(Modifier.fillMaxWidth().clip(s16).background(Tw.slate900).border(1.dp, Tw.slate800, s16).padding(16.dp)) {
                        Text(title, style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                        Text(value, Modifier.padding(top = 4.dp), style = twText(24, FontWeight.Black, 32), color = color, fontFamily = Adm.mono)
                        Text(note, Modifier.padding(top = 4.dp), style = twText(11, FontWeight.Normal, 16), color = noteColor)
                    }
                }
                Mini("إجمالي المقالات المنشورة", "${articles.size}", Color.White, "$locked مقال حصري مدفوع", Adm.emerald400)
                Mini("إجمالي قراءات المقالات", nf(totalViews.toInt()), Adm.emerald400, "متوسط: ${Math.round(totalViews.toDouble() / maxOf(articles.size, 1))} قراءة لكل مقال", Tw.slate400)
                Mini("الحملات الإعلانية النشطة", "$activeCampaigns", Adm.amber400, "من إجمالي ${campaigns.size} حملة", Tw.slate400)
                Panel {
                    Head(Lu.FileText, Adm.emerald400, "المقالات الأكثر قراءة ومشاهدة على المنصة")
                    articles.sortedByDescending { it.viewsCount }.take(6).forEach { art ->
                        Row(Modifier.fillMaxWidth().clip(s16).background(Tw.slate950).border(1.dp, Tw.slate800, s16).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(art.title, style = twText(12, FontWeight.Bold, 16), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("الكاتب: ${art.writerName} • ${art.category}" + if (art.isLocked) " • حصري $${art.lockedPrice ?: 0}" else "", Modifier.padding(top = 2.dp), style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                            }
                            Column(Modifier.padding(start = 8.dp), horizontalAlignment = Alignment.End) {
                                Text("${nf(art.viewsCount.toInt())} قراءة", style = twText(12, FontWeight.Bold, 16), color = Adm.emerald400, fontFamily = Adm.mono)
                                Text("معاينة", Modifier.twClickable { onOpenArticle(art.id) }, style = twText(10, FontWeight.Normal, 14), color = Tw.slate400)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoleCell(label: String, value: Int, color: Color, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(16.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(16.dp)).padding(12.dp)) {
        Text(label, Modifier.padding(bottom = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
        Text("$value", style = twText(18, FontWeight.Black, 28), color = color, fontFamily = Adm.mono)
    }
}
