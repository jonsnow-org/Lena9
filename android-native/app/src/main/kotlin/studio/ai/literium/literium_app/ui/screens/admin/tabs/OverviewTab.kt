package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
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
import studio.ai.literium.literium_app.ui.theme.Card
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
@OptIn(ExperimentalLayoutApi::class)
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

    val blue400 = Color(0xFF60A5FA); val blue300 = Color(0xFF93C5FD); val blue500 = Color(0xFF3B82F6)
    val emerald400 = Color(0xFF34D399); val emerald500 = Color(0xFF10B981)
    val amber400 = Color(0xFFFBBF24); val amber300 = Color(0xFFFCD34D); val amber500 = Color(0xFFF59E0B)
    val red300 = Color(0xFFFCA5A5); val red500 = Color(0xFFEF4444)
    val mono = FontFamily.Monospace
    fun usd(v: Double) = "$" + String.format(Locale.US, "%.2f", v)
    val shape16 = RoundedCornerShape(16.dp)

    @Composable
    fun StatCard(title: String, value: String, valueColor: Color, sub: String, subColor: Color, icon: ImageVector, iconBg: Color, iconTint: Color, border: Color, from: Color) {
        Column(
            Modifier.fillMaxWidth().clip(shape16)
                .background(Brush.linearGradient(listOf(Tw.slate900, from)))
                .border(1.dp, border, shape16).padding(20.dp)
        ) {
            Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(title, Modifier.weight(1f), style = twText(12, FontWeight.SemiBold, 16), color = Tw.slate400)
                Box(Modifier.size(32.dp).clip(RoundedCornerShape(12.dp)).background(iconBg), contentAlignment = Alignment.Center) {
                    LuIcon(icon, 16.dp, iconTint)
                }
            }
            Text(value, style = twText(30, FontWeight.Black, 36), color = valueColor, fontFamily = mono)
            Text(sub, Modifier.padding(top = 8.dp), style = twText(11, FontWeight.Normal, 16), color = subColor)
        }
    }

    @Composable
    fun Bullet(text: String, tint: Color) {
        Row(Modifier.padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LuIcon(Lu.CheckCircle2, 14.dp, tint)
            Text(text, style = twText(12, FontWeight.Normal, 16), color = Tw.slate300)
        }
    }

    @Composable
    fun Pill(text: String, bg: Color, fg: Color, border: Color) {
        Text(
            text,
            Modifier.clip(RoundedCornerShape(8.dp)).background(bg).border(1.dp, border, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 4.dp),
            style = twText(12, FontWeight.Bold, 16), color = fg
        )
    }

    @Composable
    fun MiniStat(icon: ImageVector, tint: Color, label: String, value: String, valueColor: Color, sub: String, modifier: Modifier) {
        Column(modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).padding(14.dp)) {
            Row(Modifier.padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(icon, 14.dp, tint)
                Text(label, style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            }
            Text(value, style = twText(20, FontWeight.Black, 28), color = valueColor, fontFamily = mono)
            Text(sub, Modifier.padding(top = 4.dp), style = twText(10, FontWeight.Normal, 14), color = Tw.slate500)
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        if (totalActionItems > 0) {
            Column(
                Modifier.fillMaxWidth().clip(shape16)
                    .background(Brush.horizontalGradient(listOf(Color(0xFF451A03).copy(alpha = 0.4f), Tw.slate900, brand.s950.copy(alpha = 0.4f))))
                    .border(1.dp, amber500.copy(alpha = 0.3f), shape16).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(amber500.copy(alpha = 0.2f)).border(1.dp, amber500.copy(alpha = 0.3f), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                        LuIcon(Lu.AlertTriangle, 20.dp, amber400)
                    }
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("مركز المهام العاجلة", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                            Text("$totalActionItems إجراءات معلقة", Modifier.clip(RoundedCornerShape(50)).background(amber500).padding(horizontal = 8.dp, vertical = 2.dp),
                                style = twText(12, FontWeight.Bold, 16), color = Tw.slate950, fontFamily = mono)
                        }
                        Text("هناك طلبات سحب، إيداع، توثيق هوية، أو حملات تنتظر مراجعتك واعتمادك.", Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate300)
                    }
                }
                @Composable
                fun ActionBtn(label: String, bg: Color, fg: Color, border: Color?, go: () -> Unit) {
                    val m = Modifier.clip(RoundedCornerShape(12.dp)).background(bg).let { if (border != null) it.border(1.dp, border, RoundedCornerShape(12.dp)) else it }
                    Text(label, m.twClickable { go() }.padding(horizontal = 12.dp, vertical = 6.dp), style = twText(12, FontWeight.Bold, 16), color = fg)
                }
                androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (pendingPayouts > 0) ActionBtn("سحب أرباح ($pendingPayouts)", Color(0xFFD97706), Color.White, null) { onNavigateTab("money") }
                    if (pendingDeposits > 0) ActionBtn("إيداعات معلقة ($pendingDeposits)", Tw.slate800, amber300, amber500.copy(alpha = 0.3f)) { onNavigateTab("money") }
                    if (pendingKyc > 0) ActionBtn("فحص KYC ($pendingKyc)", Tw.slate800, blue300, blue500.copy(alpha = 0.3f)) { onNavigateTab("users") }
                    if (pendingCampaigns > 0) ActionBtn("حملات جديدة ($pendingCampaigns)", Tw.slate800, brand.s300, brand.s500.copy(alpha = 0.3f)) { onNavigateTab("campaigns") }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            StatCard("إجمالي دخل المنصة الصافي", usd(metrics.netPlatformRevenue), Color.White,
                "شامل إعلانات المنصة 100% + حصة المنصة من إعلانات المقالات ${RevenueShares.IN_ARTICLE_ADS.platformPercent}% + من المبيعات ${RevenueShares.LOCKED_ARTICLES.platformPercent}%",
                Tw.slate400, Lu.DollarSign, brand.s500.copy(alpha = 0.2f), brand.s400, brand.s500.copy(alpha = 0.2f), brand.s950.copy(alpha = 0.4f))
            StatCard("إعلانات المنصة العامة (100%)", usd(metrics.totalPlatformAdRevenue), Color.White,
                "عائدات كاملة للمالك بدون أي تقاسم", Tw.slate400, Lu.Megaphone, blue500.copy(alpha = 0.2f), blue400, Tw.slate800, Tw.slate900.copy(alpha = 0.8f))
            StatCard("إعلانات الكُتّاب التشاركية (${RevenueShares.IN_ARTICLE_ADS.platformPercent}%)", usd(metrics.platformAdSenseCut), emerald400,
                "وحصل الكُتّاب على ${usd(metrics.writersAdSenseCut)} (${RevenueShares.IN_ARTICLE_ADS.writerPercent}%)",
                Tw.slate400, Lu.BadgePercent, emerald500.copy(alpha = 0.2f), emerald400, Tw.slate800, Tw.slate900.copy(alpha = 0.8f))
            StatCard("أموال محمية بدرع الاحتيال", usd(metrics.totalBlockedFraudRevenue), amber400,
                "${fraudFlags.size} محاولات محجوبة آلياً", amber300.copy(alpha = 0.8f), Lu.ShieldCheck, amber500.copy(alpha = 0.2f), amber400, amber500.copy(alpha = 0.2f), Tw.slate900.copy(alpha = 0.8f))
        }

        Column(
            Modifier.fillMaxWidth().clip(shape16).background(Tw.slate900.copy(alpha = 0.9f))
                .border(1.dp, brand.s500.copy(alpha = 0.2f), shape16).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.Layers, 20.dp, brand.s400)
                Text("هيكلية النظام الإعلاني المزدوج (Dual Advertising System)", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text("Zero Revenue Leakage Guaranteed", Modifier.clip(RoundedCornerShape(50)).background(brand.s950.copy(alpha = 0.6f)).border(1.dp, brand.s500.copy(alpha = 0.3f), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 4.dp),
                style = twText(12, FontWeight.Normal, 16), color = brand.s300, fontFamily = mono)

            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(listOf(Color(0xFF172554).copy(alpha = 0.3f), Tw.slate900)))
                .border(1.dp, blue500.copy(alpha = 0.2f), RoundedCornerShape(12.dp)).padding(20.dp)) {
                Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Pill("إعلانات المنصة العامة (Platform Ads)", blue500.copy(alpha = 0.2f), blue300, blue500.copy(alpha = 0.3f))
                    Text("100% للمالك", style = twText(12, FontWeight.Black, 16), color = blue400, fontFamily = mono)
                }
                Bullet("تظهر في الصفحة الرئيسية، الاستكشاف، وتغذية المنشورات العامة.", blue400)
                Bullet("لا تخضع لمشاركة الأرباح، وإيراداتها تذهب كاملة للمنصة.", blue400)
                Bullet("تدعم الحجز الثابت (Fixed) ورعاية الأقسام والشبكات الخارجية.", blue400)
                Row(Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(8.dp)).background(Tw.slate900.copy(alpha = 0.8f)).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("إجمالي إيراد المنصة من هذا الباب:", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                    Text(usd(metrics.totalPlatformAdRevenue), style = twText(12, FontWeight.Bold, 16), color = Color.White, fontFamily = mono)
                }
            }
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(listOf(brand.s950.copy(alpha = 0.3f), Tw.slate900)))
                .border(1.dp, brand.s500.copy(alpha = 0.2f), RoundedCornerShape(12.dp)).padding(20.dp)) {
                Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f, fill = false)) { Pill("إعلانات الكُتّاب التشاركية (Writer Ads)", brand.s500.copy(alpha = 0.2f), brand.s300, brand.s500.copy(alpha = 0.3f)) }
                }
                Text("تقاسم ${RevenueShares.IN_ARTICLE_ADS.writerPercent}% كاتب / ${RevenueShares.IN_ARTICLE_ADS.platformPercent}% منصة", Modifier.padding(bottom = 12.dp), style = twText(12, FontWeight.Black, 16), color = brand.s400, fontFamily = mono)
                Bullet("داخل مقالات الكاتب (55% للكاتب / 45% للمنصة) وملفه الشخصي (50% / 50%).", brand.s400)
                Bullet("مبيعات المقالات الحصرية المقفولة: 85% للكاتب / 15% للمنصة.", brand.s400)
                Bullet("محمية بالكامل بدرع منع النقر الذاتي (Self-Click) والتحقق الزمني.", brand.s400)
                Row(Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(8.dp)).background(Tw.slate900.copy(alpha = 0.8f)).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("إجمالي المولد للكُتّاب:", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                    Text(usd(metrics.writersAdSenseCut), style = twText(12, FontWeight.Bold, 16), color = emerald400, fontFamily = mono)
                }
            }
        }

        Column(Modifier.fillMaxWidth().clip(shape16).background(Tw.slate900.copy(alpha = 0.8f)).border(1.dp, Tw.slate800, shape16).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LuIcon(Lu.AlertTriangle, 16.dp, amber400)
                    Text("أحدث إنذارات مكافحة الاحتيال", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                }
                Text("عرض الكل (${fraudFlags.size})", Modifier.twClickable { onNavigateTab("fraud") }, style = twText(12, FontWeight.SemiBold, 16), color = brand.s400)
            }
            if (fraudFlags.isEmpty()) {
                Text("الدرع نشط ومستقر — لا توجد إنذارات احتيال حالياً.", Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950.copy(alpha = 0.6f)).padding(24.dp),
                    style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, textAlign = TextAlign.Center)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    fraudFlags.take(3).forEach { flag ->
                        val high = flag.severity == "high" || flag.severity == "critical"
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950.copy(alpha = 0.7f)).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(flag.details, Modifier.weight(1f, fill = false), style = twText(12, FontWeight.Bold, 16), color = Color.White)
                                    Text(flag.severity.uppercase(Locale.ROOT),
                                        Modifier.clip(RoundedCornerShape(4.dp)).background((if (high) red500 else amber500).copy(alpha = 0.2f))
                                            .border(1.dp, (if (high) red500 else amber500).copy(alpha = 0.3f), RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 1.dp),
                                        style = twText(10, FontWeight.Normal, 14), color = if (high) red300 else amber300, fontFamily = mono)
                                }
                                Text("IP: ${flag.userIp} • ${flag.detectedAt}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = mono)
                            }
                            Text("تم الحجب", Modifier.padding(start = 12.dp).clip(RoundedCornerShape(4.dp)).background(emerald500.copy(alpha = 0.1f)).padding(horizontal = 8.dp, vertical = 4.dp),
                                style = twText(11, FontWeight.Bold, 16), color = emerald400, fontFamily = mono)
                        }
                    }
                }
            }
        }

        Column(Modifier.fillMaxWidth().clip(shape16).background(Tw.slate900.copy(alpha = 0.8f)).border(1.dp, Tw.slate800, shape16).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LuIcon(Lu.Activity, 16.dp, brand.s400)
                    Text("إحصائيات المجتمع والمحتوى", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                }
                Text("مباشر", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MiniStat(Lu.Users, brand.s400, "إجمالي المستخدمين", users.size.toString(), Color.White,
                    "${users.count { it.role == "writer" }} كتاب • ${users.count { it.role == "advertiser" }} معلنين", Modifier.weight(1f))
                MiniStat(Lu.FileText, blue400, "إجمالي المقالات", articles.size.toString(), Color.White,
                    "${articles.count { it.isLocked }} حصرية مقفولة", Modifier.weight(1f))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MiniStat(Lu.Megaphone, amber400, "الحملات الإعلانية", campaigns.size.toString(), Color.White,
                    "${campaigns.count { it.status == "active" }} نشطة حالياً", Modifier.weight(1f))
                MiniStat(Lu.ShieldCheck, emerald400, "الموثقون رسمياً", users.count { it.isVerified == true || it.isKycVerified == true }.toString(), emerald400,
                    "حسابات موثقة بالكامل", Modifier.weight(1f))
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
