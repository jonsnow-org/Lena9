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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.model.Transaction
import studio.ai.literium.literium_app.data.model.TransactionType
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwError
import studio.ai.literium.literium_app.ui.theme.TwInput
import studio.ai.literium.literium_app.ui.theme.TwLabeled
import studio.ai.literium.literium_app.ui.theme.TwLoading
import studio.ai.literium.literium_app.ui.theme.TwPage
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText
import studio.ai.literium.literium_app.util.DateFormatAr

private val Mono = FontFamily.Monospace

/** المحفظة — WalletModal.tsx: تبويبات (نظرة عامة/إيداع/سحب/سجل) بخط سفلي teal، بطاقة الرصيد بتدرّج slate-950→teal-950→slate-900. */
@Composable
fun WalletScreen(navController: NavController, viewModel: WalletViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val uriHandler = LocalUriHandler.current
    val clipboard = LocalClipboardManager.current
    val dark = isDark
    val line = if (dark) Tw.slate800 else Tw.slate200
    val box = RoundedCornerShape(16.dp)
    LaunchedEffect(Unit) { viewModel.openUrl.collect { url -> uriHandler.openUri(url) } }

    val user = state.user
    val spendable = user?.walletBalance ?: 0.0
    val available = user?.availableBalance ?: 0.0
    val pending = user?.pendingEarnings ?: 0.0
    val isKyc = user?.isKycVerified == true

    TwPage(title = "محفظة ليتيريوم المالية", onClose = { navController.popBackStack() }, scroll = false, bodyPadding = 0) {
        // التبويبات
        Row(Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.40f) else Tw.slate50.copy(alpha = 0.40f)).padding(horizontal = 12.dp)) {
            listOf(WalletTab.OVERVIEW to "نظرة عامة", WalletTab.DEPOSIT to "إيداع +", WalletTab.WITHDRAW to "سحب ↑", WalletTab.HISTORY to "السجل").forEach { (tab, label) ->
                val a = state.activeTab == tab
                Column(Modifier.weight(1f).twClickable { viewModel.selectTab(tab) }, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(label, Modifier.padding(vertical = 12.dp), style = twText(12, FontWeight.Bold, 16), color = if (a) (if (dark) Tw.teal300 else Tw.teal600) else Tw.slate500, maxLines = 1)
                    Box(Modifier.fillMaxWidth().height(2.dp).background(if (a) Tw.teal600 else Color.Transparent))
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(line))

        if (state.isLoading) { TwLoading(); return@TwPage }
        androidx.compose.foundation.layout.Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            when (state.activeTab) {
                WalletTab.OVERVIEW -> {
                    val g = RoundedCornerShape(24.dp)
                    Column(Modifier.fillMaxWidth().clip(g).background(Brush.linearGradient(listOf(Tw.slate950, Color(0xFF042F2E), Tw.slate900))).border(1.dp, Color(0xFF115E59).copy(alpha = 0.50f), g).padding(24.dp)) {
                        Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("رصيد الإنفاق (للحملات، المقالات، الاشتراكات)", Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = Color(0xFF99F6E4))
                            LuIcon(Lu.ShieldCheck, 20.dp, Tw.emerald400)
                        }
                        Row(Modifier.padding(bottom = 16.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("%.2f".format(spendable), style = twText(30, FontWeight.Black, 36), color = Tw.white)
                            Text("USD", Modifier.padding(bottom = 4.dp), style = twText(18, FontWeight.Bold, 24), color = Color(0xFF5EEAD4))
                        }
                        Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFF115E59).copy(alpha = 0.60f)))
                        Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Mini("قابل للسحب", "$${"%.2f".format(available)}", Modifier.weight(1f))
                            Mini("معلّق (30 يوماً)", "$${"%.2f".format(pending)}", Modifier.weight(1f))
                            Mini("الحد الأدنى للسحب", "$${studio.ai.literium.literium_app.util.PayoutRules.MIN_PAYOUT_USD.toLong()}", Modifier.weight(1f))
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(Modifier.weight(1f).clip(box).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.40f) else Color(0xFFF0FDFA)).border(1.dp, if (dark) Color(0xFF115E59) else Color(0xFF99F6E4), box).twClickable { viewModel.selectTab(WalletTab.DEPOSIT) }.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                            LuIcon(Lu.ArrowDownToLine, 16.dp, if (dark) Tw.teal300 else Tw.teal700); Text("إيداع رصيد للمحفظة", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal700, maxLines = 1)
                        }
                        Row(Modifier.weight(1f).clip(box).background(if (dark) Tw.slate800 else Tw.slate900).twClickable { viewModel.selectTab(WalletTab.WITHDRAW) }.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                            LuIcon(Lu.ArrowUpFromLine, 16.dp, Tw.white); Text("طلب سحب الرصيد", style = twText(12, FontWeight.Bold, 16), color = Tw.white, maxLines = 1)
                        }
                    }
                }
                WalletTab.DEPOSIT -> {
                    TwLabeled("حدد المبلغ المراد إيداعه ($):") {
                        TwInput(if (state.depositAmount % 1.0 == 0.0) state.depositAmount.toLong().toString() else state.depositAmount.toString(), { viewModel.onDepositAmountChange(it.toDoubleOrNull() ?: 0.0) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(10, 25, 50, 100).forEach { v ->
                            val sel = state.depositAmount == v.toDouble()
                            Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (sel) Tw.teal600 else (if (dark) Tw.slate800 else Tw.slate100)).twClickable { viewModel.onDepositAmountChange(v.toDouble()) }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) { Text("$v$", style = twText(12, FontWeight.Bold, 16), color = if (sel) Tw.white else Tw.slate500) }
                        }
                    }
                    state.stripeDepositError?.let { TwError(it) }; state.cryptoDepositError?.let { TwError(it) }; state.cardBridgeError?.let { TwError(it) }
                    if (state.stripeAutomated) Rail(Color(0xFF0D9488), dark, "دفع فوري بالبطاقة — يُضاف الرصيد تلقائياً خلال ثوانٍ", "ادفع ${"%.0f".format(state.depositAmount)}$ الآن ببطاقتك", state.isStripeDepositBusy) { viewModel.automatedStripeDeposit() }
                    if (state.cryptoAutomated) Rail(Color(0xFFD97706), dark, "دفع فوري بعملة رقمية — يُضاف الرصيد تلقائياً فور تأكيد الشبكة", "ادفع ${"%.0f".format(state.depositAmount)}$ الآن بعملة رقمية", state.isCryptoDepositBusy) { viewModel.automatedCryptoDeposit() }
                    if (state.cryptoAutomated) {
                        val sky = Color(0xFF0284C7)
                        Column(Modifier.fillMaxWidth().clip(box).background(sky.copy(alpha = 0.08f)).border(1.dp, sky.copy(alpha = 0.30f), box).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("الدفع بالفيزا/ماستركارد عبر وسيط خارجي", style = twText(12, FontWeight.Bold, 16), color = sky)
                            Text("أنشئ عنوان استلام أدناه، انسخه، ثم افتح موقع الوسيط والصق العنوان هناك يدوياً، واختر USDT على شبكة TRC20/TRON.", style = twText(11, FontWeight.Normal, 18), color = if (dark) Tw.slate300 else Tw.slate600)
                            if (state.cardBridgeAddress.isBlank()) Btn("أنشئ عنوان استلام لدفع ${"%.0f".format(state.depositAmount)}$ بالبطاقة", sky, state.isCardBridgeBusy) { viewModel.generateCardBridgeAddress() }
                            else {
                                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, sky.copy(alpha = 0.40f), RoundedCornerShape(12.dp)).padding(12.dp)) {
                                    Text("عنوان الاستلام (USDT - شبكة TRC20):", Modifier.padding(bottom = 4.dp), style = twText(10, FontWeight.Bold, 15), color = Tw.slate500)
                                    Text(state.cardBridgeAddress, style = twText(11, FontWeight.Normal, 16).copy(fontFamily = Mono), color = if (dark) Tw.white else Tw.slate900)
                                }
                                Btn("انسخ العنوان", if (dark) Tw.slate700 else Tw.slate800, false) { clipboard.setText(AnnotatedString(state.cardBridgeAddress)) }
                                Btn("افتح موقع الوسيط (Guardarian)", sky, false) { viewModel.openGuardarian() }
                                Box(Modifier.fillMaxWidth().twClickable { viewModel.resetCardBridgeAddress() }.padding(4.dp), contentAlignment = Alignment.Center) { Text("إنشاء عنوان جديد", style = twText(11, FontWeight.Bold, 16), color = sky) }
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate100).twClickable { navController.navigate(Screen.MoneyRequest.of(isDeposit = true)) }.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        LuIcon(Lu.Info, 16.dp, Tw.slate500)
                        Text("تفضّل التحويل اليدوي (بنك/PayPal/Payoneer)؟ أرسل طلب إيداع وستراجعه الإدارة.", Modifier.weight(1f), style = twText(11, FontWeight.Medium, 18), color = if (dark) Tw.slate400 else Tw.slate600)
                    }
                }
                WalletTab.WITHDRAW -> {
                    if (!isKyc) {
                        val am = Color(0xFFD97706)
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Tw.amber500.copy(alpha = 0.10f)).border(1.dp, Tw.amber500.copy(alpha = 0.30f), RoundedCornerShape(24.dp)).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            LuIcon(Lu.ShieldCheck, 32.dp, am)
                            Text("التحقق من الهوية مطلوب قبل السحب", style = twText(16, FontWeight.Bold, 24), color = if (dark) Tw.white else Tw.slate900)
                            Text("لحماية أرباحك ومنع الاحتيال، يجب إتمام التحقق من الهوية (KYC) قبل تقديم طلب السحب.", style = twText(12, FontWeight.Normal, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate400 else Tw.slate600)
                            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(am).twClickable { navController.navigate(Screen.Kyc.route) }.padding(horizontal = 24.dp, vertical = 10.dp)) { Text("إتمام التحقق من الهوية الآن", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
                        }
                    } else if (state.withdrawSuccessMessage != null) {
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Tw.emerald500.copy(alpha = 0.10f)).border(1.dp, Tw.emerald500.copy(alpha = 0.30f), RoundedCornerShape(24.dp)).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            LuIcon(Lu.CheckCircle2, 40.dp, Tw.emerald600)
                            Text(state.withdrawSuccessMessage.orEmpty(), style = twText(14, FontWeight.Bold, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.white else Tw.slate900)
                            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate800).twClickable { viewModel.dismissWithdrawSuccess() }.padding(horizontal = 16.dp, vertical = 6.dp)) { Text("إغلاق", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
                        }
                    } else {
                        state.withdrawError?.let { TwError(it) }
                        TwLabeled("مبلغ السحب (المتاح: ${"%.2f".format(available)}$):") {
                            TwInput(if (state.withdrawAmount % 1.0 == 0.0) state.withdrawAmount.toLong().toString() else state.withdrawAmount.toString(), { viewModel.onWithdrawAmountChange(it.toDoubleOrNull() ?: 0.0) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                        }
                        if (state.stripeAutomated) {
                            val connected = state.payoutAccountStatus?.payoutsEnabled == true
                            Column(Modifier.fillMaxWidth().clip(box).background(Color(0xFF0D9488).copy(alpha = 0.08f)).border(1.dp, Color(0xFF0D9488).copy(alpha = 0.30f), box).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("سحب فوري تلقائي", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal700)
                                if (connected) Btn("اسحب ${"%.0f".format(state.withdrawAmount)}$ الآن تلقائياً", Color(0xFF0D9488), state.isAutomatedWithdrawBusy) { viewModel.automatedWithdraw() }
                                else {
                                    Text("اربط حساب استلام الأموال مرة واحدة (يستغرق دقائق عبر صفحة آمنة) لتفعيل السحب الفوري.", style = twText(11, FontWeight.Normal, 18), color = if (dark) Tw.slate300 else Tw.slate600)
                                    Btn("ربط حساب استلام الأموال", Color(0xFF0D9488), state.isConnectPayoutBusy) { viewModel.connectPayoutAccount() }
                                }
                            }
                        }
                        Text(if (state.stripeAutomated) "أو أرسل طلب سحب يدوي بطريقة أخرى" else "اختر طريقة الاستلام", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                        listOf(listOf("usdt_crypto" to "USDT TRC20 / BEP20", "bank_wire" to "تحويل بنكي IBAN"), listOf("paypal" to "حساب PayPal", "payoneer" to "حساب Payoneer")).forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                row.forEach { (id, label) ->
                                    val sel = state.withdrawMethod == id
                                    Box(Modifier.weight(1f).clip(box).background(if (sel) brand.s500.copy(alpha = 0.10f) else Color.Transparent).border(1.dp, if (sel) brand.s500 else line, box).twClickable { viewModel.onWithdrawMethodChange(id) }.padding(12.dp), contentAlignment = Alignment.Center) {
                                        Text(label, style = twText(12, FontWeight.Bold, 16), color = if (sel) brand.s600 else (if (dark) Tw.slate400 else Tw.slate600))
                                    }
                                }
                            }
                        }
                        TwLabeled(when (state.withdrawMethod) { "usdt_crypto" -> "عنوان محفظة USDT (TRC20 / BEP20)"; "bank_wire" -> "رقم الآيبان البنكي الكامل (IBAN) واسم البنك"; else -> "البريد الإلكتروني المسجل في الحساب" }) {
                            TwInput(state.withdrawAccount, viewModel::onWithdrawAccountChange, ltr = true)
                        }
                        if (state.pendingLargeWithdrawConfirm) {
                            Column(Modifier.fillMaxWidth().clip(box).background(Tw.amber500.copy(alpha = 0.10f)).border(1.dp, Tw.amber500.copy(alpha = 0.30f), box).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("تأكيد سحب مبلغ كبير: ${"%.0f".format(state.withdrawAmount)}$ — هل أنت متأكد من بيانات الاستلام؟", style = twText(12, FontWeight.Bold, 18), color = if (dark) Tw.amber400 else Color(0xFF92400E))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate200).twClickable { viewModel.cancelLargeWithdrawConfirm() }.padding(horizontal = 16.dp, vertical = 6.dp)) { Text("إلغاء", style = twText(12, FontWeight.Bold, 16), color = Tw.slate700) }
                                }
                            }
                        }
                        Btn("إرسال طلب السحب", brand.s600, state.isManualWithdrawSubmitting) { viewModel.submitManualWithdraw() }
                    }
                }
                WalletTab.HISTORY -> {
                    if (state.transactions.isEmpty()) Column(Modifier.fillMaxWidth().padding(vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        LuIcon(Lu.Wallet, 40.dp, Tw.slate400)
                        Text("لا توجد عمليات مالية بعد", Modifier.padding(top = 8.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                    } else Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        state.transactions.forEach { t -> TxRow(t, dark) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Mini(label: String, value: String, modifier: Modifier) {
    Column(modifier) {
        Text(label, Modifier.padding(bottom = 2.dp), style = twText(11, FontWeight.Normal, 16), color = Color(0xFF5EEAD4))
        Text(value, style = twText(12, FontWeight.Bold, 16).copy(fontFamily = Mono), color = Tw.white)
    }
}

@Composable
private fun Rail(tone: Color, dark: Boolean, title: String, cta: String, busy: Boolean, onClick: () -> Unit) {
    val s = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(s).background(tone.copy(alpha = 0.08f)).border(1.dp, tone.copy(alpha = 0.30f), s).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, style = twText(12, FontWeight.Bold, 18), color = tone)
        Btn(cta, tone, busy, onClick)
    }
}

@Composable
private fun Btn(text: String, container: Color, busy: Boolean, onClick: () -> Unit) {
    studio.ai.literium.literium_app.ui.theme.TwButton(text, onClick, loading = busy, container = container)
}

@Composable
private fun TxRow(t: Transaction, dark: Boolean) {
    val credit = t.type == TransactionType.DEPOSIT || t.type.startsWith("earning") || t.type == TransactionType.MANUAL_ADJUSTMENT && t.amount >= 0
    val s = RoundedCornerShape(16.dp)
    Row(Modifier.fillMaxWidth().clip(s).background(if (dark) Tw.slate800.copy(alpha = 0.40f) else Tw.slate50).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(32.dp).clip(RoundedCornerShape(12.dp)).background(if (credit) Tw.emerald500.copy(alpha = 0.15f) else Tw.rose500.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
            LuIcon(if (credit) Lu.ArrowDownToLine else Lu.ArrowUpFromLine, 16.dp, if (credit) Tw.emerald600 else Tw.rose500)
        }
        Column(Modifier.weight(1f)) {
            Text(t.description.ifBlank { t.type }, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900, maxLines = 1)
            Text(DateFormatAr.formatDateTimeAr(t.createdAt), style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
        }
        Text((if (credit) "+" else "-") + "$${"%.2f".format(kotlin.math.abs(t.amount))}", style = twText(12, FontWeight.Black, 16).copy(fontFamily = Mono), color = if (credit) Tw.emerald600 else Tw.rose500)
    }
}
