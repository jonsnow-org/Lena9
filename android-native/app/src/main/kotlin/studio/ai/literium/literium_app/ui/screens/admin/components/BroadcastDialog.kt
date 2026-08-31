package studio.ai.literium.literium_app.ui.screens.admin.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
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
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel

/**
 * "إرسال تعميم لجميع المستخدمين" — Compose port of the broadcast form
 * embedded in `AdminUsersTab.tsx`. Delivers via
 * [AdminViewModel.broadcastMessage] → `MessageRepository.broadcastMessageToAllUsers`,
 * which fans the text out as a real 1:1 conversation message to every user
 * id currently loaded (spec §4.27) — not a separate notification channel.
 */
@Composable
fun BroadcastDialog(
    viewModel: AdminViewModel,
    recipientCount: Int,
    onDismiss: () -> Unit
) {
    var text by remember { mutableStateOf("") }
    var sentMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("رسالة تعميم جماعية إلى $recipientCount مستخدم") },
        text = {
            if (sentMessage != null) {
                Text(sentMessage!!, color = MaterialTheme.colorScheme.primary)
            } else {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    label = { Text("اكتب نص الرسالة الرسمية من إدارة المنصة...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
            }
        },
        confirmButton = {
            if (sentMessage == null) {
                Button(
                    enabled = text.isNotBlank(),
                    onClick = {
                        viewModel.broadcastMessage(text.trim()) { sent, failed ->
                            sentMessage = "تم الإرسال إلى $sent مستخدم" + if (failed > 0) " (فشل $failed)" else ""
                        }
                    }
                ) { Text("إرسال التعميم الآن") }
            } else {
                Button(onClick = onDismiss) { Text("تم") }
            }
        },
        dismissButton = { OutlinedButton(onClick = onDismiss) { Text("إغلاق") } }
    )
}
