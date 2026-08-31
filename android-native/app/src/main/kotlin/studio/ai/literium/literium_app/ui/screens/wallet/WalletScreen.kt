package studio.ai.literium.literium_app.ui.screens.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.util.PayoutRules
import studio.ai.literium.literium_app.util.RevenueShares
import java.util.Locale

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun WalletScreen(navController: NavController, viewModel: WalletViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(Unit) {
        viewModel.openUrl.collect { url -> uriHandler.openUri(url) }
    }
    LaunchedEffect(state.stripeDepositError, state.cryptoDepositError, state.cardBridgeError, state.withdrawError) {
        val msg = state.stripeDepositError ?: state.cryptoDepositError ?: state.cardBridgeError ?: state.withdrawError
        if (msg != null) {
            snackbarHostState.showSnackbar(msg)
            viewModel.clearDepositErrors()
            viewModel.clearWithdrawError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("محفظة ليتيريوم المالية") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "عودة")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) { Snackbar(it) } }
    ) { padding ->
        if (state.isLoading || state.user == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }
        val user = state.user!!

        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = state.activeTab.ordinal) {
                listOf(
                    WalletTab.OVERVIEW to "نظرة عامة",
                    WalletTab.DEPOSIT to "إيداع رصيد +",
                    WalletTab.WITHDRAW to "سحب الأرباح ↑",
                    WalletTab.HISTORY to "سجل العمليات"
                ).forEach { (tab, label) ->
                    Tab(selected = state.activeTab == tab, onClick = { viewModel.selectTab(tab) }, text = { Text(label) })
                }
            }

            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                when (state.activeTab) {
                    WalletTab.OVERVIEW -> OverviewTab(
                        spendable = user.walletBalance ?: 0.0,
                        withdrawable = user.availableBalance ?: 0.0,
                        pending = user.pendingEarnings ?: 0.0,
                        onDeposit = { viewModel.selectTab(WalletTab.DEPOSIT) },
                        onWithdraw = { viewModel.selectTab(WalletTab.WITHDRAW) }
                    )
                    WalletTab.DEPOSIT -> DepositTab(state, viewModel)
                    WalletTab.WITHDRAW -> WithdrawTab(state, viewModel, navController)
                    WalletTab.HISTORY -> HistoryTab(state)
                }
            }
        }
    }
}

@Composable
private fun OverviewTab(spendable: Double, withdrawable: Double, pending: Double, onDeposit: () -> Unit, onWithdraw: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(Modifier.padding(20.dp)) {
            Text("رصيد الإنفاق (للحملات، المقالات، الاشتراكات)", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(6.dp))
            Text(
                String.format(Locale.US, "%.2f USD", spendable),
                color = MaterialTheme.colorScheme.onPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Black
            )
            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                MiniStat("قابل للسحب", String.format(Locale.US, "%.2f$", withdrawable))
                MiniStat("معلّق (30 يوماً)", String.format(Locale.US, "%.2f$", pending))
                MiniStat("الحد الأدنى للسحب", String.format(Locale.US, "%.2f$", PayoutRules.MIN_PAYOUT_USD))
            }
        }
    }

    Spacer(Modifier.height(16.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        OutlinedButton(onClick = onDeposit, modifier = Modifier.weight(1f)) {
            Icon(Icons.Filled.ArrowDownward, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("إيداع رصيد")
        }
        Button(onClick = onWithdraw, modifier = Modifier.weight(1f)) {
            Icon(Icons.Filled.ArrowUpward, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("طلب سحب")
        }
    }

    Spacer(Modifier.height(16.dp))
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text("قواعد توزيع وتقاسم العوائد المالية:", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text("• إعلانات داخل مقالات الكاتب: ${RevenueShares.IN_ARTICLE_ADS.label}.", style = MaterialTheme.typography.bodySmall)
            Text("• إعلانات صفحة الكاتب الشخصية: ${RevenueShares.WRITER_PROFILE_ADS.label}.", style = MaterialTheme.typography.bodySmall)
            Text("• المقالات المقفولة الحصرية: ${RevenueShares.LOCKED_ARTICLES.label}.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.75f))
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimary)
    }
}

@Composable
private fun DepositTab(state: WalletUiState, viewModel: WalletViewModel) {
    Text("حدد المبلغ المراد إيداعه ($):", fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(PayoutRules.MIN_DEPOSIT_USD, 25.0, 50.0, 100.0, 250.0).forEach { amt ->
            FilterChip(
                selected = state.depositAmount == amt,
                onClick = { viewModel.onDepositAmountChange(amt) },
                label = { Text("${amt.toInt()}$") }
            )
        }
    }
    Spacer(Modifier.height(10.dp))
    OutlinedTextField(
        value = if (state.depositAmount == 0.0) "" else state.depositAmount.toInt().toString(),
        onValueChange = { it.toDoubleOrNull()?.let(viewModel::onDepositAmountChange) },
        label = { Text("المبلغ ($)") },
        modifier = Modifier.fillMaxWidth()
    )

    if (state.stripeAutomated) {
        Spacer(Modifier.height(16.dp))
        PaymentOptionCard(
            title = "دفع فوري بالبطاقة — يُضاف الرصيد تلقائياً خلال ثوانٍ",
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ) {
            Button(onClick = viewModel::automatedStripeDeposit, enabled = !state.isStripeDepositBusy, modifier = Modifier.fillMaxWidth()) {
                if (state.isStripeDepositBusy) CircularProgressIndicator(Modifier.size(16.dp)) else Icon(Icons.Filled.CreditCard, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("ادفع ${state.depositAmount.toInt()}$ الآن ببطاقتك")
            }
        }
    }

    if (state.cryptoAutomated) {
        Spacer(Modifier.height(12.dp))
        PaymentOptionCard(
            title = "دفع فوري بعملة رقمية — يُضاف الرصيد تلقائياً فور تأكيد الشبكة",
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        ) {
            Button(onClick = viewModel::automatedCryptoDeposit, enabled = !state.isCryptoDepositBusy, modifier = Modifier.fillMaxWidth()) {
                if (state.isCryptoDepositBusy) CircularProgressIndicator(Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("ادفع ${state.depositAmount.toInt()}$ الآن بعملة رقمية")
            }
        }

        Spacer(Modifier.height(12.dp))
        PaymentOptionCard(
            title = "الدفع بالفيزا/ماستركارد عبر وسيط خارجي",
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        ) {
            Text(
                "أنشئ عنوان استلام أدناه، انسخه، ثم افتح موقع الوسيط (Guardarian) والصق العنوان هناك يدوياً، واختر USDT على شبكة TRC20/TRON. قد يطلب منك الوسيط تأكيد هويتك (KYC) الخاص قبل إتمام أول عملية.",
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(Modifier.height(8.dp))
            if (state.cardBridgeAddress.isEmpty()) {
                Button(onClick = viewModel::generateCardBridgeAddress, enabled = !state.isCardBridgeBusy, modifier = Modifier.fillMaxWidth()) {
                    if (state.isCardBridgeBusy) CircularProgressIndicator(Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("أنشئ عنوان استلام لدفع ${state.depositAmount.toInt()}$ بالبطاقة")
                }
            } else {
                val clipboard = LocalClipboardManager.current
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(10.dp)) {
                        Text("عنوان الاستلام (USDT - شبكة TRC20):", style = MaterialTheme.typography.labelSmall)
                        Text(state.cardBridgeAddress, style = MaterialTheme.typography.bodySmall)
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = { clipboard.setText(AnnotatedString(state.cardBridgeAddress)) }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("انسخ العنوان")
                }
                Spacer(Modifier.height(8.dp))
                Button(onClick = viewModel::openGuardarian, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("افتح موقع الوسيط (Guardarian)")
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "إنشاء عنوان جديد",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable(onClick = viewModel::resetCardBridgeAddress).padding(4.dp)
                )
            }
        }
    }
}

@Composable
private fun PaymentOptionCard(title: String, containerColor: Color, content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = containerColor)) {
        Column(Modifier.padding(14.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun WithdrawTab(state: WalletUiState, viewModel: WalletViewModel, navController: NavController) {
    val user = state.user!!
    val isKycVerified = user.isKycVerified == true || user.kycDetails?.status == "verified"
    val availableBalance = user.availableBalance ?: 0.0

    if (!isKycVerified) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.size(36.dp))
                Spacer(Modifier.height(8.dp))
                Text("التحقق من الهوية مطلوب قبل السحب", fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text(
                    "لحماية أرباحك ومنع الاحتيال، يجب إتمام التحقق من الهوية (KYC) قبل تقديم أي طلب سحب.",
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(Modifier.height(12.dp))
                Button(onClick = { navController.navigate(Screen.Kyc.route) }) { Text("إتمام التحقق من الهوية الآن") }
            }
        }
        return
    }

    if (state.withdrawSuccessMessage != null) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(40.dp))
                Spacer(Modifier.height(8.dp))
                Text(state.withdrawSuccessMessage!!, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(10.dp))
                Button(onClick = viewModel::dismissWithdrawSuccess) { Text("حسناً") }
            }
        }
        return
    }

    if (state.stripeAutomated) {
        PaymentOptionCard(title = "سحب فوري تلقائي", containerColor = MaterialTheme.colorScheme.primaryContainer) {
            if (state.payoutAccountStatus?.payoutsEnabled == true) {
                Button(
                    onClick = viewModel::automatedWithdraw,
                    enabled = !state.isAutomatedWithdrawBusy && state.withdrawAmount in PayoutRules.MIN_PAYOUT_USD..availableBalance,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("اسحب ${state.withdrawAmount.toInt()}$ الآن تلقائياً") }
            } else {
                Text("اربط حساب استلام الأموال مرة واحدة لتفعيل السحب الفوري لاحقاً.", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = viewModel::connectPayoutAccount, enabled = !state.isConnectPayoutBusy, modifier = Modifier.fillMaxWidth()) {
                    Text("ربط حساب استلام الأموال")
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Text("أو أرسل طلب سحب يدوي بطريقة أخرى — الحد الأدنى ${PayoutRules.MIN_PAYOUT_USD.toInt()}$:", fontWeight = FontWeight.Bold)
    } else {
        Text("طريقة استلام الأرباح:", fontWeight = FontWeight.Bold)
    }

    Spacer(Modifier.height(8.dp))
    Column {
        WITHDRAW_METHODS.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEach { (id, labelDesc) ->
                    val (label, desc) = labelDesc
                    Card(
                        modifier = Modifier.weight(1f).clickable { viewModel.onWithdrawMethodChange(id) },
                        colors = CardDefaults.cardColors(
                            containerColor = if (state.withdrawMethod == id) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(Modifier.padding(10.dp)) {
                            Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            Text(desc, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }

    OutlinedTextField(
        value = if (state.withdrawAmount == 0.0) "" else state.withdrawAmount.toInt().toString(),
        onValueChange = { it.toDoubleOrNull()?.let(viewModel::onWithdrawAmountChange) },
        label = { Text("مبلغ السحب (المتاح: ${String.format(Locale.US, "%.2f", availableBalance)}$، الحد الأدنى ${PayoutRules.MIN_PAYOUT_USD.toInt()}$)") },
        modifier = Modifier.fillMaxWidth()
    )
    Spacer(Modifier.height(10.dp))
    OutlinedTextField(
        value = state.withdrawAccount,
        onValueChange = viewModel::onWithdrawAccountChange,
        label = {
            Text(
                when (state.withdrawMethod) {
                    "usdt_crypto" -> "عنوان محفظة USDT (TRC20 / BEP20)"
                    "bank_wire" -> "رقم الآيبان البنكي الكامل (IBAN) واسم البنك"
                    else -> "البريد الإلكتروني المسجل في الحساب"
                }
            )
        },
        modifier = Modifier.fillMaxWidth()
    )

    if (state.pendingLargeWithdrawConfirm) {
        Spacer(Modifier.height(10.dp))
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
            Column(Modifier.padding(12.dp)) {
                Text(
                    "هذا مبلغ كبير (≥ ${LARGE_WITHDRAW_CONFIRM_THRESHOLD.toInt()}$). تأكد من صحة بيانات الاستلام قبل المتابعة.",
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodySmall
                )
                Text(
                    "إلغاء والتعديل",
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable(onClick = viewModel::cancelLargeWithdrawConfirm).padding(top = 6.dp)
                )
            }
        }
    }

    Spacer(Modifier.height(14.dp))
    Button(
        onClick = viewModel::submitManualWithdraw,
        enabled = availableBalance >= PayoutRules.MIN_PAYOUT_USD && !state.isManualWithdrawSubmitting,
        modifier = Modifier.fillMaxWidth()
    ) {
        if (state.isManualWithdrawSubmitting) CircularProgressIndicator(Modifier.size(16.dp))
        Text(
            if (state.pendingLargeWithdrawConfirm) "تأكيد نهائي: سحب ${state.withdrawAmount.toInt()}$"
            else "تأكيد طلب سحب ${state.withdrawAmount.toInt()}$"
        )
    }
}

@Composable
private fun HistoryTab(state: WalletUiState) {
    if (state.transactions.isEmpty()) {
        Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
            Text("لا توجد عمليات سابقة", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }
    state.transactions.forEach { tx ->
        val isCredit = tx.type == "deposit" || tx.type.startsWith("earning")
        Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
            Row(
                Modifier.padding(12.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(tx.description, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                    Text("${tx.createdAt} • ${tx.paymentMethod}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    "${if (isCredit) "+" else "-"}${String.format(Locale.US, "%.2f", tx.amount)}$",
                    fontWeight = FontWeight.Black,
                    color = if (isCredit) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
