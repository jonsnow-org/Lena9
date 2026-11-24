package studio.ai.literium.literium_app.ui.screens.wallet

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.model.MoneyRequestStatus
import java.util.Locale

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun MoneyRequestScreen(navController: NavController, isDeposit: Boolean) {
    val viewModel: MoneyRequestViewModel = viewModel(
        key = "money_request_$isDeposit",
        factory = viewModelFactory { initializer { MoneyRequestViewModel(isDeposit) } }
    )
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isDeposit) "شحن المحفظة" else "سحب الأرباح") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "عودة")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) { Snackbar(it) } }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp)) {
            if (state.isDone) {
                Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(10.dp))
                    Text("تم إرسال طلبك", fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        if (isDeposit) "سيُضاف الرصيد إلى محفظتك بعد تأكيد وصول المبلغ من إدارة المنصة."
                        else "سيُحوَّل المبلغ بعد مراجعة الطلب واعتماده من إدارة المنصة.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { navController.popBackStack() }) { Text("إغلاق") }
                }
                return@Column
            }

            // Balance summary
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    if (isDeposit) {
                        SummaryRow("رصيد المحفظة الحالي", state.walletBalance)
                    } else {
                        SummaryRow("الأرباح المتاحة للسحب", state.availableBalance)
                        SummaryRow("أرباح مجمّدة (30 يوماً)", state.pendingEarnings)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = if (state.amount == 0.0) "" else state.amount.toInt().toString(),
                onValueChange = { it.toDoubleOrNull()?.let(viewModel::onAmountChange) },
                label = { Text("المبلغ بالدولار (الحد الأدنى ${state.minAmount.toInt()}$)") },
                modifier = Modifier.fillMaxWidth()
            )
            if (!isDeposit && state.amount > state.availableBalance) {
                Text("المبلغ يتجاوز رصيدك المتاح للسحب.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
            }

            Spacer(Modifier.height(16.dp))
            Text(if (isDeposit) "طريقة التحويل:" else "طريقة الاستلام:", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            state.methods.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                    row.forEach { (id, label) ->
                        Card(
                            modifier = Modifier.weight(1f).clickable { viewModel.onMethodChange(id) },
                            colors = CardDefaults.cardColors(
                                containerColor = if (state.method == id) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Text(label, modifier = Modifier.padding(10.dp), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            if (isDeposit) {
                OutlinedTextField(
                    value = state.reference,
                    onValueChange = viewModel::onReferenceChange,
                    label = { Text("رقم العملية أو مرجع التحويل") },
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                OutlinedTextField(
                    value = state.destination,
                    onValueChange = viewModel::onDestinationChange,
                    label = { Text("بيانات الاستلام (رقم الحساب أو عنوان المحفظة)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(Modifier.height(14.dp))
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Row(Modifier.padding(12.dp)) {
                    Icon(Icons.Filled.Info, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "تتم مراجعة طلبات الإيداع والسحب يدوياً من إدارة المنصة خلال 24 إلى 48 ساعة." +
                            if (isDeposit) " لن يُضاف الرصيد قبل تأكيد وصول المبلغ فعلياً."
                            else " تبقى الأرباح مجمّدة 30 يوماً من تاريخ تسجيلها قبل أن تصبح قابلة للسحب.",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            Spacer(Modifier.height(18.dp))
            Button(onClick = viewModel::submit, enabled = state.canSubmit, modifier = Modifier.fillMaxWidth()) {
                if (state.isSubmitting) {
                    CircularProgressIndicator(Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(Modifier.width(8.dp))
                    Text("جارٍ الإرسال…")
                } else {
                    Text(if (isDeposit) "إرسال طلب الإيداع" else "إرسال طلب السحب")
                }
            }

            val previousRequests: List<Pair<Double, String>> = if (isDeposit) {
                state.depositRequests.take(5).map { it.amount to it.status }
            } else {
                state.payoutRequests.take(5).map { it.amount to it.status }
            }
            if (previousRequests.isNotEmpty()) {
                Spacer(Modifier.height(20.dp))
                Text("طلباتك السابقة:", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                previousRequests.forEach { (amount, status) ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(String.format(Locale.US, "%.2f$", amount), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                        Text(statusLabel(status), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: Double) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(String.format(Locale.US, "$%.2f", value), fontWeight = FontWeight.Black, style = MaterialTheme.typography.bodyMedium)
    }
}

private fun statusLabel(status: String): String = when (status) {
    MoneyRequestStatus.PENDING -> "بانتظار المراجعة"
    MoneyRequestStatus.APPROVED -> "معتمد"
    MoneyRequestStatus.PAID -> "تم الدفع"
    else -> "مرفوض"
}
