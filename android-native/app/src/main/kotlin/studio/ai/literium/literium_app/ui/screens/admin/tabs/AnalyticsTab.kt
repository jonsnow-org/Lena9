package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel

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

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("الإحصائيات الحقيقية (مباشر من الخادم)", fontWeight = FontWeight.Bold)
                Button(onClick = { viewModel.loadAnalyticsSummary() }) { Text("تحديث") }
            }
        }

        if (isLoading && summary == null) {
            item { CircularProgressIndicator() }
        }
        error?.let { msg -> item { EmptyHint("تعذر تحميل الإحصائيات الحقيقية: $msg") } }

        summary?.let { s ->
            item {
                StatGrid(
                    listOf(
                        "إجمالي الزوار" to s.totalVisitors,
                        "زوار اليوم" to s.visitorsToday,
                        "زوار آخر 24 ساعة" to s.visitorsLast24h,
                        "إجمالي المشاهدات" to s.totalPageViews,
                        "مشاهدات اليوم" to s.pageViewsToday,
                        "مشاهدات آخر 24 ساعة" to s.pageViewsLast24h
                    ),
                    valueFontSize = 18.sp
                )
            }
            item {
                Card {
                    Column(Modifier.padding(12.dp)) {
                        Text("توزيع الأجهزة", fontWeight = FontWeight.Bold)
                        Text(
                            "جوال: ${s.deviceBreakdown.mobile} • حاسوب: ${s.deviceBreakdown.desktop} • لوحي: ${s.deviceBreakdown.tablet}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
            if (s.recentVisits.isNotEmpty()) {
                item { Text("أحدث الزيارات", fontWeight = FontWeight.Bold) }
                items(s.recentVisits.take(15)) { visit ->
                    Card {
                        Column(Modifier.padding(10.dp)) {
                            Text(visit.pageTitle ?: visit.path ?: "—", style = MaterialTheme.typography.bodySmall)
                            Text(visit.timestamp ?: "", style = MaterialTheme.typography.labelSmall)
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
                    Card(modifier = Modifier.weight(1f)) {
                        Column(Modifier.padding(12.dp)) {
                            Text(label, style = MaterialTheme.typography.labelSmall)
                            Text(value.toString(), fontSize = valueFontSize, fontWeight = FontWeight.Black)
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
