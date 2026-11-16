package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.AdEvent
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.EarningRecord
import studio.ai.literium.literium_app.data.model.ManualBalanceAdjustment
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.PurchaseRequest
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.RevenueShares
import java.time.Instant

/** "المركز المالي وإدارة الحسابات" — ترجمة حرفية لـ AdminFinanceTab.tsx بتبويباته الستة. */
@Composable
fun FinanceTab(
    viewModel: AdminViewModel,
    users: List<User>,
    campaigns: List<AdCampaign>,
    depositRequests: List<DepositRequest>,
    payoutRequests: List<PayoutRequest>,
    purchaseRequests: List<PurchaseRequest>,
    adEvents: List<AdEvent>,
    earningsRecords: List<EarningRecord>,
    manualAdjustments: List<ManualBalanceAdjustment>
) {
    var subTab by remember { mutableStateOf("payouts") }
    val now = remember { Instant.now() }
    val releasable = earningsRecords.filter {
        (it.status == "pending_hold" || it.status == "pending") &&
            runCatching { Instant.parse(it.releasableAt) }.getOrNull()?.isBefore(now) == true
    }
    val unprocessed = adEvents.filter { !it.processed }
    val s16 = RoundedCornerShape(16.dp)

    val tabs = listOf(
        Triple("payouts", "طلبات السحب", Lu.ArrowUpFromLine) to payoutRequests.count { it.status == "pending" },
        Triple("deposits", "طلبات الإيداع", Lu.ArrowDownToLine) to depositRequests.count { it.status == "pending" },
        Triple("releasable", "تحرير الأرباح (30 يوم)", Lu.Clock) to releasable.size,
        Triple("locked_sales", "مبيعات المقالات", Lu.Lock) to purchaseRequests.count { it.status == "pending" },
        Triple("ad_accounting", "احتساب عوائد الإعلانات", Lu.BadgePercent) to unprocessed.size,
        Triple("audit_log", "سجل تعديلات الرصيد", Lu.History) to manualAdjustments.size
    )

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        AdmCard(bg = Tw.slate900.copy(alpha = 0.9f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.DollarSign, 20.dp, Adm.emerald400)
                Text("المركز المالي وإدارة الحسابات", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text("متابعة طلبات السحب، تدقيق الإيداعات، تحرير أرباح الكُتّاب، واحتساب عوائد الإعلانات.", Modifier.padding(top = 2.dp, bottom = 16.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).horizontalScroll(rememberScrollState()).padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                tabs.forEach { (t, badge) ->
                    val on = subTab == t.first
                    Row(Modifier.clip(RoundedCornerShape(8.dp)).background(if (on) Adm.emerald600 else Color.Transparent).twClickable(pressScale = 1f) { subTab = t.first }.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(t.third, 14.dp, if (on) Color.White else Tw.slate400)
                        Text(t.second, style = twText(12, FontWeight.Bold, 16), color = if (on) Color.White else Tw.slate400, maxLines = 1)
                        if (badge > 0) Text(arNum(badge.toLong()), Modifier.clip(RoundedCornerShape(50)).background(if (on) Color.White.copy(alpha = 0.2f) else Tw.slate800).padding(horizontal = 6.dp, vertical = 1.dp),
                            style = twText(10, FontWeight.Bold, 14), color = if (on) Color.White else Color(0xFF6EE7B7), fontFamily = Adm.mono)
                    }
                }
            }
        }

        Column(Modifier.fillMaxWidth().clip(s16).background(Adm.amber500.copy(alpha = 0.10f)).border(1.dp, Adm.amber500.copy(alpha = 0.3f), s16).padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.AlertTriangle, 16.dp, Adm.amber400)
                Text("إرشادات الأمان المالي والتدقيق", style = twText(12, FontWeight.Bold, 16), color = Adm.amber300)
            }
            listOf("لا تعتمد أي إيداع قبل التحقق من وصول الحوالة فعلياً لحسابك البنكي أو محفظة USDT.",
                "راجع سجل أرباح الكاتب ومعدل النقرات قبل تحويل أي مبلغ سحب خارجي.",
                "يتم تسجيل كل تعديل رصيد أو اعتماد مالي في سجل التدقيق الدائم.").forEach {
                Text("• $it", style = twText(11, FontWeight.Normal, 16), color = Color(0xFFFDE68A).copy(alpha = 0.8f))
            }
        }

        when (subTab) {
            "payouts" -> PayoutsSection(viewModel, payoutRequests, users)
            "deposits" -> DepositsSection(viewModel, depositRequests, users)
            "releasable" -> ReleasableSection(viewModel, releasable, users)
            "locked_sales" -> LockedSalesSection(viewModel, purchaseRequests, users)
            "ad_accounting" -> AdAccountingSection(viewModel, unprocessed)
            "audit_log" -> AuditLogSection(manualAdjustments, users)
        }
    }
}

@Composable
private fun StatusPill(text: String, bg: Color, fg: Color) {
    Text(text, Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 2.dp), style = twText(10, FontWeight.Black, 14), color = fg)
}

@Composable
private fun SectionTitle(text: String, sub: String? = null) {
    Column {
        Text(text, style = twText(14, FontWeight.Black, 20), color = Color.White)
        if (sub != null) Text(sub, Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
    }
}

@Composable
private fun AmountBlock(amount: Double, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.End) {
        Text(Adm.usd(amount), style = twText(16, FontWeight.Black, 24), color = color, fontFamily = Adm.mono)
        Text(label, style = twText(10, FontWeight.Normal, 14), color = Tw.slate400)
    }
}

@Composable
private fun UserName(u: User?, fallback: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(u?.fullName ?: fallback, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (u != null) Text("(@${u.username})", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = Adm.mono)
    }
}

@Composable
private fun PayoutsSection(vm: AdminViewModel, requests: List<PayoutRequest>, users: List<User>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle("طلبات سحب أرباح الكُتّاب (${requests.size} طلب إجمالي)")
        if (requests.isEmpty()) AdmEmpty("لا توجد طلبات سحب حالياً.")
        else requests.forEach { req ->
            val u = users.find { it.id == req.userId }
            AdmCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (req.status) {
                        "pending" -> StatusPill("بانتظار المراجعة والتحويل", Adm.amber500, Tw.slate950)
                        "paid" -> StatusPill("تم الدفع بنجاح ✓", Adm.emerald500, Tw.slate950)
                        "approved" -> StatusPill("معتمد — بانتظار إتمام الدفع", Color(0xFF0EA5E9), Tw.slate950)
                        else -> StatusPill("مرفوض ✗", Adm.rose500, Color.White)
                    }
                    Text(req.method, style = twText(12, FontWeight.SemiBold, 16), color = Tw.slate400)
                }
                UserName(u, req.userId)
                req.destination?.let { Text("الوجهة / الحساب: $it", style = twText(12, FontWeight.Normal, 16), color = brand.s300, fontFamily = Adm.mono) }
                if (req.createdAt.isNotBlank()) Text("تاريخ الطلب: ${req.createdAt.take(10)}", style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    AmountBlock(req.amount, "مبلغ السحب", Adm.emerald400)
                    if (req.status != "paid" && req.status != "rejected") {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AdmButton("تأكيد الدفع", { vm.setPayoutRequestStatus(req.id, "paid") }, Adm.emerald600)
                            AdmButton("رفض", { vm.setPayoutRequestStatus(req.id, "rejected") }, Tw.slate800, Tw.slate300)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DepositsSection(vm: AdminViewModel, requests: List<DepositRequest>, users: List<User>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle("طلبات إيداع وشحن المحفظة (${requests.size} طلب إجمالي)")
        if (requests.isEmpty()) AdmEmpty("لا توجد طلبات إيداع حالياً.")
        else requests.forEach { req ->
            val u = users.find { it.id == req.userId }
            AdmCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (req.status) {
                        "pending" -> StatusPill("بانتظار التحقق من التحويل", Adm.amber500, Tw.slate950)
                        "approved" -> StatusPill("معتمد وتم الشحن ✓", Adm.emerald500, Tw.slate950)
                        else -> StatusPill("مرفوض ✗", Adm.rose500, Color.White)
                    }
                    Text(req.method, style = twText(12, FontWeight.SemiBold, 16), color = Tw.slate400)
                }
                UserName(u, req.userId)
                req.reference?.let { Text("رقم المرجع / الحوالة: $it", style = twText(12, FontWeight.Normal, 16), color = Adm.amber300, fontFamily = Adm.mono) }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    AmountBlock(req.amount, "مبلغ الإيداع", Adm.emerald400)
                    if (req.status == "pending") {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AdmButton("تأكيد الاستلام والشحن", { vm.setDepositRequestStatus(req.id, "approved") }, Adm.emerald600)
                            AdmButton("رفض", { vm.setDepositRequestStatus(req.id, "rejected") }, Tw.slate800, Tw.slate300)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReleasableSection(vm: AdminViewModel, releasable: List<EarningRecord>, users: List<User>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle("أرباح انقضت فترة تجميدها (30 يوماً) وجاهزة للتحرير للسحب (${releasable.size})",
            "هذه المبالغ استوفت فترة الضمان، والضغط على \"تحرير المبلغ\" ينقلها من الأرباح المجمّدة إلى الرصيد المتاح للسحب.")
        if (releasable.isEmpty()) AdmEmpty("لا توجد أرباح تجاوزت فترة التجميد (30 يوماً) في الوقت الحالي.")
        else releasable.forEach { e ->
            val u = users.find { it.id == e.userId }
            AdmCard {
                Text(u?.fullName ?: e.userId, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${e.description ?: e.source} • جاهز منذ ${e.releasableAt.take(10)}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(Adm.usd(e.amount), style = twText(16, FontWeight.Black, 24), color = Adm.emerald400, fontFamily = Adm.mono)
                    AdmButton("تحرير للسحب المباشر", { vm.releaseEarning(e) }, Adm.emerald600)
                }
            }
        }
    }
}

@Composable
private fun LockedSalesSection(vm: AdminViewModel, requests: List<PurchaseRequest>, users: List<User>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle("طلبات شراء ومبيعات المقالات الحصرية (${requests.size})")
        if (requests.isEmpty()) AdmEmpty("لا توجد طلبات شراء مقالات حالياً.")
        else requests.forEach { req ->
            val buyer = users.find { it.id == req.buyerId || it.id == req.userId }
            val writer = users.find { it.id == req.writerId }
            val writerShare = req.amount * RevenueShares.LOCKED_ARTICLES.writer
            AdmCard {
                when (req.status) {
                    "pending" -> StatusPill("بانتظار الاعتماد", Adm.amber500, Tw.slate950)
                    "approved" -> StatusPill("معتمد ومفتوح للمشتري ✓", Adm.emerald500, Tw.slate950)
                    else -> StatusPill("مرفوض ✗", Adm.rose500, Color.White)
                }
                Text(req.articleTitle ?: req.articleId, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("المشتري: ${buyer?.fullName ?: req.buyerId} • الكاتب: ${writer?.fullName ?: req.writerId}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    AmountBlock(req.amount, "حصة الكاتب 85%: ${Adm.usd(writerShare)}", Adm.amber400)
                    if (req.status == "pending") {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AdmButton("اعتماد", { vm.reviewPurchaseRequest(req.id, "approved") }, Adm.emerald600)
                            AdmButton("رفض", { vm.reviewPurchaseRequest(req.id, "rejected") }, Tw.slate800, Tw.slate300)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdAccountingSection(vm: AdminViewModel, unprocessed: List<AdEvent>) {
    val external = unprocessed.filter { it.isExternalAdView == true }
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        AdmCard {
            Text("احتساب أرباح إعلانات الكُتّاب وتصفية الأحداث", style = twText(14, FontWeight.Black, 20), color = Color.White)
            Text("يتم جمع أحداث المشاهدات والنقرات من القراء تلقائياً. يقوم النظام أدناه بفحص كل حدث، وعزل النقرات المشبوهة أو السريعة، ثم احتساب الحصص الصالحة وإيداعها في الأرباح المجمّدة للكتاب.",
                Modifier.padding(top = 4.dp), style = twText(12, FontWeight.Normal, 20), color = Tw.slate400)
        }
        AdmStatGrid(listOf(
            { m -> AdmStat("${unprocessed.size}", "أحداث غير معالجة", Color.White, Tw.slate800, m) },
            { m -> AdmStat("${unprocessed.count { it.eventType == "click" }}", "نقرات غير معالجة", Adm.emerald400, Adm.emerald500.copy(alpha = 0.3f), m) },
            { m -> AdmStat("${unprocessed.count { it.eventType != "click" }}", "ظهور غير معالج", Adm.amber400, Adm.amber500.copy(alpha = 0.3f), m) },
            { m -> AdmStat("${external.size}", "مشاهدات شبكات خارجية", Adm.blue400, Adm.blue500.copy(alpha = 0.3f), m) }
        ))
        if (unprocessed.isNotEmpty()) {
            Text("احتساب الأحداث الصالحة وإيداع الأرباح للكتّاب الآن",
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Adm.emerald600).twClickable { vm.processAdEvents() }.padding(vertical = 14.dp),
                style = twText(12, FontWeight.ExtraBold, 16), color = Color.White, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
        AdmCard {
            Text("عائد الكُتّاب من إعلانات الشبكات الخارجية", style = twText(14, FontWeight.Black, 20), color = Color.White)
            Text("مشاهدات موثّقة (نفس شرط الرؤية الحقيقية) لإعلانات الشبكة الخارجية داخل مقالات/ملفات الكُتّاب، محسوبة بسعر تقديري ثابت لكل 1000 مشاهدة (قابل للتعديل من قسم الشبكات الخارجية)، مستقلة تماماً عن أرباحك الحقيقية في لوحة الشبكة نفسها.",
                Modifier.padding(top = 4.dp), style = twText(12, FontWeight.Normal, 20), color = Tw.slate400)
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("${external.size}", style = twText(20, FontWeight.Black, 28), color = Color.White, fontFamily = Adm.mono)
                    Text("مشاهدة غير معالَجة", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                }
            }
            if (external.isNotEmpty()) {
                Text("احتساب عائد الإعلانات الخارجية وإيداعه للكُتّاب الآن",
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFF2563EB)).twClickable { vm.processExternalAdRevenue() }.padding(vertical = 12.dp),
                    style = twText(12, FontWeight.ExtraBold, 16), color = Color.White, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
    }
}

@Composable
private fun AuditLogSection(adjustments: List<ManualBalanceAdjustment>, users: List<User>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        AdmCard {
            Text("سجل تعديلات الرصيد اليدوية (${adjustments.size})", style = twText(14, FontWeight.Black, 20), color = Color.White)
            Text("أي رصيد في حساب مستخدم (بما فيه حساب المالك) لا يقابله إيداع حقيقي أو ربح فعلي من مبيعات/إعلانات، فمصدره على الأرجح أحد التعديلات المسجَّلة هنا — من عدّله، لمن، كم، ولماذا.",
                Modifier.padding(top = 4.dp), style = twText(12, FontWeight.Normal, 20), color = Tw.slate400)
        }
        if (adjustments.isEmpty()) AdmEmpty("لا توجد أي تعديلات رصيد يدوية مسجَّلة — كل الأرصدة الحالية جاءت من إيداعات أو أرباح حقيقية فقط.")
        else adjustments.forEach { adj ->
            val target = users.find { it.id == adj.userId }
            val adjuster = users.find { it.id == adj.adjustedBy }
            val fieldLabel = when (adj.field) {
                "walletBalance" -> "رصيد المحفظة"; "availableBalance" -> "الرصيد القابل للسحب"
                "pendingEarnings" -> "أرباح مجمَّدة"; "lifetimeEarnings" -> "إجمالي الأرباح"; else -> adj.field
            }
            AdmCard {
                AdmFlow {
                    AdmBadge(fieldLabel, Tw.slate300, Tw.slate800, null)
                }
                UserName(target, adj.userId)
                Text("عدَّله: ${adjuster?.fullName ?: adj.adjustedBy.ifBlank { "غير معروف" }}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                if (adj.reason.isNotBlank()) Text("السبب: ${adj.reason}", style = twText(12, FontWeight.Normal, 16), color = brand.s300)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Column(horizontalAlignment = Alignment.End) {
                        Text("${if (adj.amount >= 0) "+" else ""}${Adm.usd(adj.amount)}", style = twText(16, FontWeight.Black, 24), color = if (adj.amount >= 0) Adm.emerald400 else Adm.rose400, fontFamily = Adm.mono)
                        Text("الرصيد الجديد: ${Adm.usd(adj.newValue)}", style = twText(10, FontWeight.Normal, 14), color = Tw.slate400)
                    }
                }
            }
        }
    }
}
