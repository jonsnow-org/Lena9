package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
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
import studio.ai.literium.literium_app.util.RevenueShares
import java.time.Instant

/**
 * "المركز المالي وإدارة الحسابات" — Compose port of `AdminFinanceTab.tsx`'s
 * six sub-sections. Every write here is a plain client Firestore write
 * through [studio.ai.literium.literium_app.data.repository.WalletRepository]
 * (per that repository's file KDoc: no server endpoint backs any of it) —
 * except purchase-request review, which has no repository method yet and
 * is implemented locally in [AdminViewModel] (see its own KDoc on that gap).
 *
 * "احتساب عوائد الإعلانات" uses [AdminViewModel.processAdEvents] — a
 * simplified stand-in for the source's un-ported `evaluateAdEventBatch`
 * fraud-filter pass (see that method's KDoc for the exact, acknowledged gap).
 */
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
    val unprocessedEvents = adEvents.filter { !it.processed }

    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            listOf(
                "payouts" to "السحب (${payoutRequests.count { it.status == "pending" }})",
                "deposits" to "الإيداع (${depositRequests.count { it.status == "pending" }})",
                "releasable" to "تحرير الأرباح (${releasable.size})",
                "locked_sales" to "مبيعات المقالات (${purchaseRequests.count { it.status == "pending" }})",
                "ad_accounting" to "عوائد الإعلانات (${unprocessedEvents.size})",
                "audit_log" to "سجل التعديلات"
            ).forEach { (key, label) ->
                FilterChip(selected = subTab == key, onClick = { subTab = key }, label = { Text(label) })
            }
        }

        when (subTab) {
            "payouts" -> PayoutsList(viewModel, payoutRequests, users)
            "deposits" -> DepositsList(viewModel, depositRequests, users)
            "releasable" -> ReleasableList(viewModel, releasable, users)
            "locked_sales" -> LockedSalesList(viewModel, purchaseRequests, users)
            "ad_accounting" -> AdAccountingSection(viewModel, unprocessedEvents, campaigns, users)
            "audit_log" -> AuditLogList(manualAdjustments, users)
        }
    }
}

@Composable
private fun PayoutsList(viewModel: AdminViewModel, requests: List<PayoutRequest>, users: List<User>) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (requests.isEmpty()) {
            item { EmptyHint("لا توجد طلبات سحب حالياً.") }
        } else {
            items(requests, key = { it.id }) { req ->
                val u = users.find { it.id == req.userId }
                Card {
                    Column(Modifier.padding(12.dp)) {
                        Text(u?.fullName ?: req.userId, fontWeight = FontWeight.Bold)
                        Text("${req.method} • $${"%.2f".format(req.amount)}", style = MaterialTheme.typography.labelSmall)
                        req.destination?.let { Text("الوجهة: $it", style = MaterialTheme.typography.labelSmall) }
                        Text(statusLabelPayout(req.status), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        if (req.status != "paid" && req.status != "rejected") {
                            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(onClick = { viewModel.setPayoutRequestStatus(req.id, "paid") }) { Text("تأكيد الدفع") }
                                OutlinedButton(onClick = { viewModel.setPayoutRequestStatus(req.id, "rejected") }) { Text("رفض") }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun statusLabelPayout(status: String) = when (status) {
    "pending" -> "بانتظار المراجعة والتحويل"
    "approved" -> "معتمد — بانتظار إتمام الدفع"
    "paid" -> "تم الدفع بنجاح ✓"
    else -> "مرفوض ✗"
}

@Composable
private fun DepositsList(viewModel: AdminViewModel, requests: List<DepositRequest>, users: List<User>) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (requests.isEmpty()) {
            item { EmptyHint("لا توجد طلبات إيداع حالياً.") }
        } else {
            items(requests, key = { it.id }) { req ->
                val u = users.find { it.id == req.userId }
                Card {
                    Column(Modifier.padding(12.dp)) {
                        Text(u?.fullName ?: req.userId, fontWeight = FontWeight.Bold)
                        Text("${req.method} • $${"%.2f".format(req.amount)}", style = MaterialTheme.typography.labelSmall)
                        req.reference?.let { Text("المرجع: $it", style = MaterialTheme.typography.labelSmall) }
                        if (req.status == "pending") {
                            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(onClick = { viewModel.setDepositRequestStatus(req.id, "approved") }) { Text("تأكيد الاستلام والشحن") }
                                OutlinedButton(onClick = { viewModel.setDepositRequestStatus(req.id, "rejected") }) { Text("رفض") }
                            }
                        } else {
                            Text(if (req.status == "approved") "معتمد وتم الشحن ✓" else "مرفوض ✗", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReleasableList(viewModel: AdminViewModel, releasable: List<EarningRecord>, users: List<User>) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("أرباح جاهزة للتحرير للسحب (${releasable.size})", fontWeight = FontWeight.Bold) }
        if (releasable.isEmpty()) {
            item { EmptyHint("لا توجد أرباح تجاوزت فترة التجميد (30 يوماً) حالياً.") }
        } else {
            items(releasable, key = { it.id }) { earning ->
                val u = users.find { it.id == earning.userId }
                Card {
                    Column(Modifier.padding(12.dp)) {
                        Text(u?.fullName ?: earning.userId, fontWeight = FontWeight.Bold)
                        Text(earning.description ?: earning.source, style = MaterialTheme.typography.labelSmall)
                        Text("$${"%.2f".format(earning.amount)}", fontWeight = FontWeight.Black)
                        Button(onClick = { viewModel.releaseEarning(earning) }, modifier = Modifier.padding(top = 6.dp)) {
                            Text("تحرير للسحب المباشر")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LockedSalesList(viewModel: AdminViewModel, requests: List<PurchaseRequest>, users: List<User>) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("طلبات شراء المقالات الحصرية (${requests.size})", fontWeight = FontWeight.Bold) }
        if (requests.isEmpty()) {
            item { EmptyHint("لا توجد طلبات شراء مقالات حالياً.") }
        } else {
            items(requests, key = { it.id }) { req ->
                val buyer = users.find { it.id == req.buyerId || it.id == req.userId }
                val writer = users.find { it.id == req.writerId }
                val writerShare = req.amount * RevenueShares.LOCKED_ARTICLES.writer
                Card {
                    Column(Modifier.padding(12.dp)) {
                        Text(req.articleTitle ?: req.articleId, fontWeight = FontWeight.Bold)
                        Text(
                            "المشتري: ${buyer?.fullName ?: req.buyerId} • الكاتب: ${writer?.fullName ?: req.writerId}",
                            style = MaterialTheme.typography.labelSmall
                        )
                        Text("$${"%.2f".format(req.amount)} — حصة الكاتب: $${"%.2f".format(writerShare)}", fontWeight = FontWeight.Bold)
                        if (req.status == "pending") {
                            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(onClick = { viewModel.reviewPurchaseRequest(req.id, "approved") }) { Text("اعتماد") }
                                OutlinedButton(onClick = { viewModel.reviewPurchaseRequest(req.id, "rejected") }) { Text("رفض") }
                            }
                        } else {
                            Text(if (req.status == "approved") "معتمد ومفتوح للمشتري ✓" else "مرفوض ✗", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdAccountingSection(viewModel: AdminViewModel, unprocessed: List<AdEvent>, campaigns: List<AdCampaign>, users: List<User>) {
    val externalUnprocessed = unprocessed.filter { it.isExternalAdView == true }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text(
                "احتساب أرباح إعلانات الكُتّاب وتصفية الأحداث — ${unprocessed.size} حدث غير معالَج. " +
                    "التحقق من صحة النقر/الظهور يتم عند تسجيل الحدث نفسه؛ ليس هناك إعادة تقييم دفعية للاحتيال " +
                    "في هذه النسخة (فلتر evaluateAdEventBatch من الموقع لم يُنقَل بعد — انظر التقرير النهائي).",
                style = MaterialTheme.typography.bodySmall
            )
        }
        item {
            Button(
                enabled = unprocessed.isNotEmpty(),
                onClick = { viewModel.processAdEvents() }
            ) { Text("احتساب الأحداث وإيداع الأرباح للكتّاب الآن") }
        }
        item {
            Text(
                "عائد الكُتّاب من مشاهدات الشبكات الخارجية (Adsterra/PropellerAds) — ${externalUnprocessed.size} " +
                    "مشاهدة غير محتسَبة، بسعر تقديري ثابت لكل 1000 مشاهدة (يُضبط من تبويب الإعلانات).",
                style = MaterialTheme.typography.bodySmall
            )
        }
        item {
            OutlinedButton(
                enabled = externalUnprocessed.isNotEmpty(),
                onClick = { viewModel.processExternalAdRevenue() }
            ) { Text("احتساب مشاهدات الشبكات الخارجية وإيداع حصص الكُتّاب") }
        }
        if (unprocessed.isNotEmpty()) {
            item { Text("الأحداث غير المعالجة:", fontWeight = FontWeight.Bold) }
            items(unprocessed.take(30), key = { it.id }) { ev ->
                Card {
                    Column(Modifier.padding(10.dp)) {
                        Text("${if (ev.eventType == "click") "نقرة" else "ظهور"} — ${ev.slotId}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun AuditLogList(adjustments: List<ManualBalanceAdjustment>, users: List<User>) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("سجل تعديلات الرصيد اليدوية (${adjustments.size})", fontWeight = FontWeight.Bold) }
        if (adjustments.isEmpty()) {
            item { EmptyHint("لا توجد تعديلات رصيد يدوية مسجَّلة.") }
        } else {
            items(adjustments, key = { it.id }) { adj ->
                val target = users.find { it.id == adj.userId }
                val adjuster = users.find { it.id == adj.adjustedBy }
                Card {
                    Column(Modifier.padding(12.dp)) {
                        Text("الحساب: ${target?.fullName ?: adj.userId}", fontWeight = FontWeight.Bold)
                        Text("عدَّله: ${adjuster?.fullName ?: adj.adjustedBy}", style = MaterialTheme.typography.labelSmall)
                        if (adj.reason.isNotBlank()) Text("السبب: ${adj.reason}", style = MaterialTheme.typography.labelSmall)
                        Text(
                            "${if (adj.amount >= 0) "+" else ""}$${"%.2f".format(adj.amount)} → الرصيد الجديد: $${"%.2f".format(adj.newValue)}",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
