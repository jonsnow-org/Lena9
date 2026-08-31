package studio.ai.literium.literium_app.ui.screens.admin.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.KycDocumentResponse
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel

/**
 * "تدقيق وتوثيق الهوية (KYC)" — Compose port of `KycReviewModal.tsx`.
 * Launched from the Users tab on a pending-KYC account (real source shape:
 * a dialog, not its own top-level admin tab). Fetches the admin-only
 * signed document view + Gemini-vision analysis via
 * [AdminViewModel.fetchKycDocument] (`GET /api/kyc/document/{userId}`),
 * then approve/reject writes through [AdminViewModel.approveKyc]/[rejectKyc]
 * (plain client Firestore writes on `users/{userId}`, per `KycRepository`'s
 * own file KDoc).
 */
@Composable
fun KycReviewDialog(
    viewModel: AdminViewModel,
    user: User,
    onDismiss: () -> Unit
) {
    var doc by remember { mutableStateOf<KycDocumentResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(user.id) {
        isLoading = true
        error = null
        viewModel.fetchKycDocument(user.id)
            .onSuccess { doc = it }
            .onFailure { error = it.message ?: "تعذر جلب وثيقة المراجعة." }
        isLoading = false
    }

    val kyc = user.kycDetails

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تدقيق وتوثيق الهوية (KYC)") },
        text = {
            Column {
                Text(user.fullName, fontWeight = FontWeight.Bold)
                Text("@${user.username} • ${user.email}", style = MaterialTheme.typography.labelSmall)

                Column(Modifier.padding(top = 12.dp)) {
                    Text("نوع الوثيقة: ${kyc?.idType ?: "غير محدد"}", style = MaterialTheme.typography.bodySmall)
                    Text("رقم الوثيقة: ${kyc?.idNumber ?: "غير متوفر"}", style = MaterialTheme.typography.bodySmall)
                    kyc?.submittedAt?.let {
                        Text("تاريخ التقديم: $it", style = MaterialTheme.typography.labelSmall)
                    }
                }

                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.padding(top = 12.dp))
                }
                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                }
                doc?.imageUrl?.let { url ->
                    AsyncImage(
                        model = url,
                        contentDescription = "وثيقة KYC",
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp)
                    )
                }
                doc?.let { d ->
                    Column(Modifier.padding(top = 8.dp)) {
                        Text("نتيجة تحليل الذكاء الاصطناعي", fontWeight = FontWeight.Bold)
                        Text("الاسم المستخرَج: ${d.extractedName ?: "تعذّرت القراءة"}", style = MaterialTheme.typography.bodySmall)
                        Text("درجة المطابقة: ${d.matchConfidence ?: "—"}", style = MaterialTheme.typography.bodySmall)
                        d.aiReasoning?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
                    }
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    viewModel.approveKyc(user.id)
                    onDismiss()
                }) { Text("اعتماد وتوثيق") }
                OutlinedButton(onClick = {
                    viewModel.rejectKyc(user.id)
                    onDismiss()
                }) { Text("رفض الطلب") }
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) { Text("إغلاق") }
        }
    )
}
