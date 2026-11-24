package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticlePromotion
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.FraudFlag
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.PurchaseRequest
import studio.ai.literium.literium_app.data.model.AdEvent
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.DarkCard
import studio.ai.literium.literium_app.ui.theme.SlateMuted
import studio.ai.literium.literium_app.util.RevenueShares
import java.util.Locale

/**
 * "نظرة عامة" — Compose port of `AdminOverviewTab.tsx`: the urgent-action
 * banner (pending payouts/deposits/KYC/campaigns, each jumping to the right
 * tab), the four top revenue stat cards, the dual-ad-system explainer, and
 * the recent-fraud + community-stats summary grid.
 */
@Composable
fun OverviewTab(
    viewModel: AdminViewModel,
    users: List<User>,
    articles: List<Article>,
    campaigns: List<AdCampaign>,
    fraudFlags: List<FraudFlag>,
    promotions: List<ArticlePromotion>,
    depositRequests: List<DepositRequest>,
    payoutRequests: List<PayoutRequest>,
    purchaseRequests: List<PurchaseRequest>,
    adEvents: List<AdEvent>,
    onNavigateTab: (String) -> Unit
) {
    val pendingPayouts = payoutRequests.count { it.status == "pending" }
    val pendingDeposits = depositRequests.count { it.status == "pending" }
    val pendingKyc = users.count { it.kycDetails?.status == "pending" }
    val pendingCampaigns = campaigns.count { it.status == "pending" }
    val pendingPromotions = promotions.count { it.status == "pending" }
    val pendingPurchases = purchaseRequests.count { it.status == "pending" }
    val unprocessedEvents = adEvents.count { !it.processed }

    val metrics = remember(campaigns, articles, fraudFlags) {
        viewModel.computeOverviewMetrics(campaigns, articles, fraudFlags)
    }

    val totalActionItems = pendingPayouts + pendingDeposits + pendingKyc + pendingCampaigns +
        pendingPromotions + pendingPurchases + (if (unprocessedEvents > 0) 1 else 0)

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (totalActionItems > 0) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("مركز المهام العاجلة — $totalActionItems إجراءات معلقة", fontWeight = FontWeight.Bold)
                        Text(
                            "هناك طلبات سحب، إيداع، توثيق هوية، أو حملات تنتظر مراجعتك واعتمادك.",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (pendingPayouts > 0) ActionChip("سحب أرباح ($pendingPayouts)") { onNavigateTab("money") }
                            if (pendingDeposits > 0) ActionChip("إيداعات ($pendingDeposits)") { onNavigateTab("money") }
                            if (pendingKyc > 0) ActionChip("فحص KYC ($pendingKyc)") { onNavigateTab("users") }
                            if (pendingCampaigns > 0) ActionChip("حملات ($pendingCampaigns)") { onNavigateTab("campaigns") }
                        }
                    }
                }
            }
        }

        item {
            NonLazyGrid(
                listOf(
                    Triple("إجمالي دخل المنصة الصافي", metrics.netPlatformRevenue, "شامل كل مصادر العوائد"),
                    Triple("إعلانات المنصة العامة (100%)", metrics.totalPlatformAdRevenue, "عائدات كاملة للمالك"),
                    Triple(
                        "إعلانات الكُتّاب التشاركية (${RevenueShares.IN_ARTICLE_ADS.platformPercent}%)",
                        metrics.platformAdSenseCut,
                        "الكُتّاب: $${"%.2f".format(metrics.writersAdSenseCut)}"
                    ),
                    Triple("أموال محمية بدرع الاحتيال", metrics.totalBlockedFraudRevenue, "${fraudFlags.size} محاولات محجوبة")
                )
            ) { (title, value, sub) ->
                DarkCard {
                    Column(Modifier.padding(12.dp)) {
                        Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SlateMuted)
                        Text(
                            "$${"%.2f".format(value)}",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(sub, fontSize = 10.sp, color = SlateMuted)
                    }
                }
            }
        }

        item {
            DarkCard {
                Column(Modifier.padding(16.dp)) {
                    Text("هيكلية النظام الإعلاني المزدوج", fontWeight = FontWeight.Bold)
                    Text(
                        "إعلانات المنصة العامة: 100% للمالك. إعلانات الكُتّاب التشاركية: ${RevenueShares.IN_ARTICLE_ADS.label}. " +
                            "مبيعات المقالات الحصرية: ${RevenueShares.LOCKED_ARTICLES.label}.",
                        fontSize = 12.sp,
                        color = SlateMuted,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }
        }

        item { Text("أحدث إنذارات مكافحة الاحتيال", fontWeight = FontWeight.Bold) }
        if (fraudFlags.isEmpty()) {
            item { EmptyHint("الدرع نشط ومستقر — لا توجد إنذارات احتيال حالياً.") }
        } else {
            items(fraudFlags.take(3)) { flag ->
                DarkCard {
                    Column(Modifier.padding(12.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(flag.details, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text(flag.severity.uppercase(Locale.ROOT), fontSize = 10.sp, color = SlateMuted)
                        }
                        Text("IP: ${flag.userIp} • ${flag.detectedAt}", fontSize = 10.sp, color = SlateMuted)
                    }
                }
            }
        }

        item { Text("إحصائيات المجتمع والمحتوى", fontWeight = FontWeight.Bold) }
        item {
            NonLazyGrid(
                listOf(
                    "إجمالي المستخدمين" to users.size.toString(),
                    "إجمالي المقالات" to articles.size.toString(),
                    "الحملات الإعلانية" to campaigns.size.toString(),
                    "الموثقون رسمياً" to users.count { it.isVerified == true || it.isKycVerified == true }.toString()
                )
            ) { (label, value) ->
                DarkCard {
                    Column(Modifier.padding(12.dp)) {
                        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SlateMuted)
                        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

/**
 * غير-Lazy عمداً: `LazyVerticalGrid` كان متداخلاً هنا داخل `item{}` تابعة
 * لـ `LazyColumn` خارجية بلا ارتفاع محدد — يسبب هذا فوراً
 * `IllegalStateException: Vertically scrollable component was measured with
 * an infinity maximum height constraints` عند فتح هذا التبويب (وهو التبويب
 * الافتراضي الأول عند فتح لوحة التحكم — البلاغ الحقيقي: التطبيق يُغلق قسرياً
 * فوراً عند فتح لوحة التحكم). أعداد البطاقات هنا صغيرة وثابتة فلا حاجة لعنصر
 * Lazy أصلاً؛ [T] يُعرَض بطاقتين في كل صف.
 */
@Composable
internal fun <T> NonLazyGrid(items: List<T>, columns: Int = 2, content: @Composable (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { entry ->
                    Box(Modifier.weight(1f)) { content(entry) }
                }
                repeat(columns - row.size) {
                    Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
internal fun ActionChip(label: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
internal fun EmptyHint(text: String) {
    DarkCard {
        Text(
            text,
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            fontSize = 13.sp,
            color = SlateMuted
        )
    }
}
