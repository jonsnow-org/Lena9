package studio.ai.literium.literium_app.ui.screens.admin.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel

private data class BalanceField(val key: String, val label: String, val get: (User) -> Double)

private val ADJUSTABLE_FIELDS = listOf(
    BalanceField("walletBalance", "رصيد المحفظة (الإنفاق)") { it.walletBalance ?: 0.0 },
    BalanceField("availableBalance", "متاح للسحب المالي") { it.availableBalance ?: 0.0 },
    BalanceField("pendingEarnings", "أرباح مجمّدة (30 يوماً)") { it.pendingEarnings ?: 0.0 },
    BalanceField("lifetimeEarnings", "إجمالي الأرباح التراكمية") { it.lifetimeEarnings ?: 0.0 }
)

/**
 * "تعديل رصيد المستخدم يدوياً" — Compose port of `BalanceAdjustModal.tsx`.
 * Every submission is recorded to the permanent audit log via
 * [AdminViewModel.adjustBalance] (which itself calls
 * `WalletRepository.adminAdjustUserBalance` + `logManualBalanceAdjustment`
 * — the sole legitimate balance-mutation path per that repository's file
 * KDoc; never a fabricated server call).
 */
@Composable
fun BalanceAdjustDialog(
    viewModel: AdminViewModel,
    user: User,
    onDismiss: () -> Unit
) {
    var field by remember { mutableStateOf(ADJUSTABLE_FIELDS[0]) }
    var isAdd by remember { mutableStateOf(true) }
    var amountText by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }

    val amount = amountText.toDoubleOrNull()
    val isValidAmount = amount != null && amount > 0
    val delta = if (isAdd) (amount ?: 0.0) else -(amount ?: 0.0)
    val current = field.get(user)
    val projected = current + delta
    val canSubmit = isValidAmount && reason.trim().length >= 3

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تعديل رصيد المستخدم يدوياً") },
        text = {
            Column {
                Text(user.fullName, fontWeight = FontWeight.Bold)
                Text("@${user.username} • ${user.email}", style = MaterialTheme.typography.labelSmall)

                Text("اختر الحساب المستهدف:", modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
                LazyRow {
                    items(ADJUSTABLE_FIELDS) { f ->
                        FilterChip(
                            selected = field.key == f.key,
                            onClick = { field = f },
                            label = { Text(f.label) },
                            modifier = Modifier.padding(end = 6.dp)
                        )
                    }
                }
                Text("الرصيد الحالي: $${"%.2f".format(current)}", style = MaterialTheme.typography.labelSmall)

                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = isAdd, onClick = { isAdd = true }, label = { Text("+ إضافة") })
                    FilterChip(selected = !isAdd, onClick = { isAdd = false }, label = { Text("- خصم") })
                }

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("المبلغ بالدولار ($)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                )
                Text(
                    "الرصيد بعد التنفيذ: $${"%.2f".format(if (isValidAmount) projected else current)}",
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(top = 4.dp)
                )

                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("سبب التعديل (إلزامي)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                )
            }
        },
        confirmButton = {
            Button(
                enabled = canSubmit,
                onClick = {
                    viewModel.adjustBalance(user, field.key, delta, reason.trim())
                    onDismiss()
                }
            ) { Text("تطبيق التعديل") }
        },
        dismissButton = { OutlinedButton(onClick = onDismiss) { Text("إلغاء") } }
    )
}
