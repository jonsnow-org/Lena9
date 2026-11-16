package studio.ai.literium.literium_app.ui.screens.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwButton
import studio.ai.literium.literium_app.ui.theme.TwError
import studio.ai.literium.literium_app.ui.theme.TwInput
import studio.ai.literium.literium_app.ui.theme.TwLabeled
import studio.ai.literium.literium_app.ui.theme.TwPage
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

private val Mono = FontFamily.Monospace

/** شحن المحفظة / سحب الأرباح — MoneyRequestModal.tsx: ملخّص الرصيد، مبلغ، طرق (3 أعمدة)، مرجع/بيانات الاستلام، تنبيه مراجعة، زر، وطلبات سابقة. */
@Composable
fun MoneyRequestScreen(navController: NavController, isDeposit: Boolean) {
    val viewModel: MoneyRequestViewModel = viewModel(
        key = "money_request_$isDeposit",
        factory = viewModelFactory { initializer { MoneyRequestViewModel(isDeposit) } }
    )
    val state by viewModel.state.collectAsState()
    val dark = isDark
    val tone = if (isDeposit) Tw.emerald600 else brand.s600
    val box = RoundedCornerShape(16.dp)

    TwPage(title = if (isDeposit) "شحن المحفظة" else "سحب الأرباح", onClose = { navController.popBackStack() }) {
        Text(if (isDeposit) "إيداع رصيد لتمويل حملاتك الإعلانية" else "طلب تحويل أرباحك المتاحة", style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
        if (state.isDone) {
            Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(56.dp).clip(CircleShape).background(Tw.emerald500.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) { LuIcon(Lu.CheckCircle2, 28.dp, Tw.emerald600) }
                Text("تم إرسال طلبك", style = twText(16, FontWeight.ExtraBold, 24), color = if (dark) Tw.white else Tw.slate900)
                Text(if (isDeposit) "سيُضاف الرصيد إلى محفظتك بعد تأكيد وصول المبلغ من إدارة المنصة." else "سيُحوَّل المبلغ بعد مراجعة الطلب واعتماده من إدارة المنصة.", style = twText(12, FontWeight.Normal, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate400 else Tw.slate500)
                Box(Modifier.clip(box).background(if (dark) Tw.slate100 else Tw.slate900).twClickable { viewModel.reset(); navController.popBackStack() }.padding(horizontal = 24.dp, vertical = 10.dp)) {
                    Text("إغلاق", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate900 else Tw.white)
                }
            }
        } else {
            Column(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.50f) else Tw.slate50).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, box).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (isDeposit) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("رصيد المحفظة الحالي", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                    Text("$${"%.2f".format(state.walletBalance)}", style = twText(12, FontWeight.Black, 16).copy(fontFamily = Mono), color = if (dark) Tw.white else Tw.slate900)
                } else {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("الأرباح المتاحة للسحب", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                        Text("$${"%.2f".format(state.availableBalance)}", style = twText(12, FontWeight.Black, 16).copy(fontFamily = Mono), color = if (dark) Tw.emerald400 else Tw.emerald600)
                    }
                    Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate700 else Tw.slate200))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            LuIcon(Lu.Clock, 14.dp, if (dark) Tw.slate400 else Tw.slate500)
                            Text("أرباح مجمّدة (30 يوماً)", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                        }
                        Text("$${"%.2f".format(state.pendingEarnings)}", style = twText(12, FontWeight.Bold, 16).copy(fontFamily = Mono), color = if (dark) Tw.amber400 else Tw.amber600)
                    }
                }
            }
            state.error?.let { TwError(it) }

            TwLabeled("المبلغ بالدولار (الحد الأدنى $${state.minAmount.toLong()}):") {
                TwInput(
                    if (state.amount % 1.0 == 0.0) state.amount.toLong().toString() else state.amount.toString(),
                    { viewModel.onAmountChange(it.toDoubleOrNull() ?: 0.0) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                if (!isDeposit && state.amount > state.availableBalance) Text("المبلغ يتجاوز رصيدك المتاح للسحب.", style = twText(11, FontWeight.Bold, 16), color = Tw.rose500)
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (isDeposit) "طريقة التحويل:" else "طريقة الاستلام:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                state.methods.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { (id, label) ->
                            val sel = state.method == id
                            Box(
                                Modifier.weight(1f).clip(box).background(if (sel) brand.s500.copy(alpha = 0.10f) else Color.Transparent)
                                    .border(1.dp, if (sel) brand.s500 else (if (dark) Tw.slate800 else Tw.slate200), box).twClickable { viewModel.onMethodChange(id) }.padding(10.dp),
                                contentAlignment = Alignment.Center
                            ) { Text(label, style = twText(12, FontWeight.Bold, 16).copy(textAlign = TextAlign.Center), color = if (sel) brand.s600 else (if (dark) Tw.slate400 else Tw.slate600)) }
                        }
                        repeat(3 - row.size) { Box(Modifier.weight(1f)) {} }
                    }
                }
            }

            if (isDeposit) TwLabeled("رقم العملية أو مرجع التحويل:") { TwInput(state.reference, viewModel::onReferenceChange, placeholder = "أدخل رقم العملية بعد إتمام التحويل") }
            else TwLabeled("بيانات الاستلام:") { TwInput(state.destination, viewModel::onDestinationChange, placeholder = "رقم الحساب أو عنوان المحفظة") }

            Row(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate100).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LuIcon(Lu.Info, 16.dp, if (dark) Tw.slate400 else Tw.slate500, Modifier.padding(top = 2.dp))
                Text("تتم مراجعة طلبات الإيداع والسحب يدوياً من إدارة المنصة خلال 24 إلى 48 ساعة." + (if (isDeposit) " لن يُضاف الرصيد قبل تأكيد وصول المبلغ فعلياً." else " تبقى الأرباح مجمّدة 30 يوماً من تاريخ تسجيلها قبل أن تصبح قابلة للسحب."), style = twText(11, FontWeight.Normal, 18), color = if (dark) Tw.slate400 else Tw.slate500)
            }
            TwButton(if (state.isSubmitting) "جارٍ الإرسال…" else if (isDeposit) "إرسال طلب الإيداع" else "إرسال طلب السحب", { viewModel.submit() }, enabled = state.canSubmit, loading = state.isSubmitting, container = tone)

            val history: List<Pair<Double, String>> = if (isDeposit) state.depositRequests.map { it.amount to it.status } else state.payoutRequests.map { it.amount to it.status }
            if (history.isNotEmpty()) Column(Modifier.fillMaxWidth().padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate800 else Tw.slate200))
                Text("طلباتك السابقة:", Modifier.padding(top = 8.dp), style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                history.take(5).forEach { (amt, st) ->
                    val (label, fg) = when (st) {
                        "pending" -> "بانتظار المراجعة" to (if (dark) Tw.amber400 else Tw.amber600)
                        "approved" -> "معتمد" to (if (dark) Tw.emerald400 else Tw.emerald600)
                        "paid" -> "تم الدفع" to (if (dark) Tw.emerald400 else Tw.emerald600)
                        else -> "مرفوض" to (if (dark) Tw.rose400 else Tw.rose600)
                    }
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800.copy(alpha = 0.40f) else Tw.slate50).padding(10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("$${"%.2f".format(amt)}", style = twText(12, FontWeight.Bold, 16).copy(fontFamily = Mono), color = if (dark) Tw.slate200 else Tw.slate700)
                        Box(Modifier.clip(CircleShape).background(fg.copy(alpha = 0.20f)).padding(horizontal = 8.dp, vertical = 2.dp)) { Text(label, style = twText(10, FontWeight.Bold, 15), color = fg) }
                    }
                }
            }
        }
    }
}
