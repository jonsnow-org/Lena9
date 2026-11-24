package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.diagnostics.diagnoseTouchTarget
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.util.CreatorEligibility

/**
 * "التحليلات" — Compose port of `AdminAnalyticsTab.tsx`'s server-backed
 * half: live `GET /api/analytics/summary` (visitors/page-views/device
 * breakdown/recent visits — real server data, refreshed on open) plus the
 * client-computed signup/content/campaign roll-ups the source derives from
 * the already-loaded `users`/`articles`/`campaigns` collections.
 *
 * The source's "تصفير الإحصائيات" (visits/rejected-request reset) button
 * calls `POST /api/analytics/reset` — deliberately NOT wired into
 * [studio.ai.literium.literium_app.data.remote.LiteriumApiService] (see its
 * file KDoc: excluded from the mobile client's API surface as a
 * destructive ops-only utility). No fabricated call is made for it here;
 * see the final report for this explicitly acknowledged gap.
 */
@Composable
fun AnalyticsTab(
    viewModel: AdminViewModel,
    users: List<User>,
    articles: List<Article>,
    campaigns: List<AdCampaign>,
    depositRequests: List<DepositRequest>,
    payoutRequests: List<PayoutRequest>
) {
    val summary by viewModel.analyticsSummary.collectAsState()
    val isLoading by viewModel.isLoadingAnalytics.collectAsState()
    val error by viewModel.analyticsError.collectAsState()

    LaunchedEffect(Unit) { viewModel.loadAnalyticsSummary() }

    val realUsers = users.filterNot { it.isBot == true }
    val readers = realUsers.count { it.role == "reader" && it.id != "guest" }
    val writers = realUsers.count { it.role == "writer" }
    val advertisers = realUsers.count { it.role == "advertiser" }
    val verified = realUsers.count { it.isVerified == true }
    val registered = realUsers.count { it.id != "guest" }
    val lockedArticles = articles.count { it.isLocked }
    val totalViews = articles.sumOf { it.viewsCount }
    val activeCampaigns = campaigns.count { it.status == "active" }
    val approvedDeposits = depositRequests.count { it.status == "approved" }
    val paidWithdrawals = payoutRequests.count { it.status == "paid" }
    val signupsToday = realUsers.count { it.id != "guest" && CreatorEligibility.getAccountAgeDays(it.createdAt) == 0 }
    val signupsThisWeek = realUsers.count { it.id != "guest" && CreatorEligibility.getAccountAgeDays(it.createdAt) in 0..6 }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Text(
                    "الإحصائيات الحقيقية (مباشر من الخادم)",
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f).padding(end = 8.dp),
                    maxLines = 2,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    onTextLayout = studio.ai.literium.literium_app.ui.diagnostics.rememberOverflowReporter("رأس تبويب التحليلات")
                )
                Button(
                    onClick = { viewModel.loadAnalyticsSummary() },
                    modifier = Modifier.diagnoseTouchTarget("زر تحديث التحليلات")
                ) { Text("تحديث") }
            }
        }

        if (isLoading && summary == null) {
            item { CircularProgressIndicator() }
        }
        error?.let { msg -> item { EmptyHint("تعذر تحميل الإحصائيات الحقيقية: $msg") } }

        summary?.let { s ->
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCard(
                            modifier = Modifier.weight(1f),
                            label = "الزوار (آخر 24 ساعة)",
                            value = s.visitorsLast24h.toString(),
                            unit = "زائر",
                            icon = Icons.Filled.Visibility,
                            accent = Emerald
                        ) {
                            StatFooterLine("المشاهدات: ${s.pageViewsLast24h}", "اليوم: ${s.visitorsToday}")
                        }
                        StatCard(
                            modifier = Modifier.weight(1f),
                            label = "إجمالي الزوار التراكمي",
                            value = s.totalVisitors.toString(),
                            unit = "فريد",
                            icon = Icons.Filled.Public,
                            accent = Teal
                        ) {
                            Text(
                                "إجمالي المشاهدات: ${s.totalPageViews}",
                                fontSize = 11.sp,
                                color = SlateMuted
                            )
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCard(
                            modifier = Modifier.weight(1f),
                            label = "إجمالي المسجلين",
                            value = registered.toString(),
                            unit = "عضو",
                            icon = Icons.Filled.Group,
                            accent = BluePill
                        ) {
                            StatFooterLine("اليوم: +$signupsToday", "الأسبوع: +$signupsThisWeek")
                        }
                        StatCard(
                            modifier = Modifier.weight(1f),
                            label = "الإعلانات والمقالات",
                            value = activeCampaigns.toString(),
                            unit = "بنر نشط",
                            icon = Icons.Filled.Campaign,
                            accent = Amber
                        ) {
                            StatFooterLine("البنرات: ${campaigns.size}", "المقالات: ${articles.size}")
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCard(
                            modifier = Modifier.weight(1f),
                            label = "عمليات الإيداع",
                            value = depositRequests.size.toString(),
                            icon = Icons.Filled.ArrowDownward,
                            accent = Emerald
                        ) {
                            Text("مقبولة: $approvedDeposits", fontSize = 11.sp, color = SlateMuted)
                        }
                        StatCard(
                            modifier = Modifier.weight(1f),
                            label = "عمليات السحب",
                            value = payoutRequests.size.toString(),
                            icon = Icons.Filled.ArrowUpward,
                            accent = Rose
                        ) {
                            Text("مدفوعة: $paidWithdrawals", fontSize = 11.sp, color = SlateMuted)
                        }
                    }
                    StatCard(
                        modifier = Modifier.fillMaxWidth(),
                        label = "المقالات الحصرية المدفوعة",
                        value = lockedArticles.toString(),
                        icon = Icons.Filled.Lock,
                        accent = Amber
                    ) {
                        Text("من إجمالي ${articles.size} مقال", fontSize = 11.sp, color = SlateMuted)
                    }
                }
            }
            item {
                DarkCard {
                    Column(Modifier.padding(14.dp)) {
                        Text("توزيع الأجهزة", fontWeight = FontWeight.Bold, color = Color.White)
                        Text(
                            "جوال: ${s.deviceBreakdown.mobile} • حاسوب: ${s.deviceBreakdown.desktop} • لوحي: ${s.deviceBreakdown.tablet}",
                            fontSize = 12.sp,
                            color = SlateMuted
                        )
                    }
                }
            }
            if (s.recentVisits.isNotEmpty()) {
                item { Text("أحدث الزيارات", fontWeight = FontWeight.Bold) }
                items(s.recentVisits.take(15)) { visit ->
                    DarkCard {
                        Column(Modifier.padding(10.dp)) {
                            Text(visit.pageTitle ?: visit.path ?: "—", fontSize = 12.sp, color = Color.White)
                            Text(visit.timestamp ?: "", fontSize = 10.sp, color = SlateMuted)
                        }
                    }
                }
            }
        }

        item { Text("توزيع المستخدمين المسجَّلين (من Firestore مباشرة)", fontWeight = FontWeight.Bold) }
        item {
            StatGrid(
                listOf(
                    "إجمالي المسجلين" to registered,
                    "قرّاء" to readers,
                    "كتّاب" to writers,
                    "معلنون" to advertisers,
                    "موثقون" to verified,
                    "مقالات حصرية" to lockedArticles,
                    "إجمالي المشاهدات" to totalViews.toInt(),
                    "حملات نشطة" to activeCampaigns,
                    "إيداعات معتمدة" to approvedDeposits,
                    "سحوبات مدفوعة" to paidWithdrawals
                ),
                valueFontSize = 16.sp
            )
        }
    }
}

/**
 * غير-Lazy عمداً: كان `LazyVerticalGrid` هنا متداخلاً داخل `item{}` تابعة لـ
 * `LazyColumn` خارجية بلا ارتفاع محدد — يتسبب هذا في
 * `IllegalStateException: Vertically scrollable component was measured with
 * an infinity maximum height constraints` فوراً عند فتح هذا التبويب (البلاغ
 * الحقيقي: إغلاق قسري عند فتح لوحة التحكم). أعداد البطاقات هنا صغيرة وثابتة
 * (≤10) فلا حاجة لعنصر Lazy أصلاً.
 */
@Composable
private fun StatGrid(items: List<Pair<String, Any>>, valueFontSize: androidx.compose.ui.unit.TextUnit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, value) ->
                    DarkCard(modifier = Modifier.weight(1f)) {
                        Column(Modifier.padding(12.dp)) {
                            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SlateMuted)
                            Text(value.toString(), fontSize = valueFontSize, fontWeight = FontWeight.Black, color = Color.White)
                        }
                    }
                }
                if (row.size == 1) {
                    androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

// ألوان مطابقة لنظام Tailwind على الويب (slate/emerald/teal/blue/amber/rose-500 وما شابه) — نفس
// القيم الست عشرية حرفياً، لا تقريب، حتى تتطابق البطاقات هنا مع لوحة تحكم الويب فعلياً بدل الاكتفاء
// بألوان Material الافتراضية التي كانت السبب الحقيقي في أن هذا التبويب بدا "بلا تصميم" مقارنة بالويب.
private val SlateCardBg = Color(0xFF0F172A) // slate-900
private val SlateMuted = Color(0xFF94A3B8) // slate-400
private val Emerald = Color(0xFF10B981) // emerald-500
private val Teal = Color(0xFF14B8A6) // teal-500
private val BluePill = Color(0xFF3B82F6) // blue-500
private val Amber = Color(0xFFF59E0B) // amber-500
private val Rose = Color(0xFFF43F5E) // rose-500

@Composable
private fun DarkCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(
        color = SlateCardBg,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Color(0xFF1E293B)),
        modifier = modifier
    ) { content() }
}

/** بطاقة إحصائية مطابقة لتصميم `AdminAnalyticsTab.tsx` — خلفية داكنة، أيقونة في دائرة ملوّنة، رقم
 *  كبير أبيض، ووحدة/لون مميّز لكل بطاقة. هذا بالضبط ما كان غائباً: التبويب كان يستخدم `Card` الافتراضية
 *  (بيضاء بلا أيقونة ولا لون) بينما الويب يستخدم هذا التصميم في كل مكان. */
@Composable
private fun StatCard(
    label: String,
    value: String,
    icon: ImageVector,
    accent: Color,
    modifier: Modifier = Modifier,
    unit: String? = null,
    footer: @Composable () -> Unit
) {
    Surface(
        color = SlateCardBg,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.3f)),
        modifier = modifier
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SlateMuted, modifier = Modifier.weight(1f))
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(accent.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(15.dp))
                }
            }
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
                Text(value, fontSize = 22.sp, fontWeight = FontWeight.Black, color = Color.White)
                if (unit != null) {
                    Text(unit, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = accent, modifier = Modifier.padding(bottom = 3.dp))
                }
            }
            Column(Modifier.padding(top = 6.dp)) { footer() }
        }
    }
}

@Composable
private fun StatFooterLine(left: String, right: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(left, fontSize = 11.sp, color = SlateMuted)
        Text(right, fontSize = 11.sp, color = SlateMuted)
    }
}
