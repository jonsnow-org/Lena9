package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twText

/** تعيين كلمة مرور جديدة — ResetPasswordModal.tsx (max-w-md). */
@Composable
fun ResetPasswordScreen(
    oobCode: String,
    onSuccess: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    val state by viewModel.resetPasswordState.collectAsState()
    val dark = isDark
    LaunchedEffect(oobCode) { viewModel.verifyResetCode(oobCode) }

    AuthShell(Lu.KeyRound, "تعيين كلمة مرور جديدة", null, maxWidth = 448.dp) {
        when {
            state.verifying -> Row(
                Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically
            ) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Tw.slate500)
                Text("جارٍ التحقق من الرابط...", style = twText(14, FontWeight.Normal, 20), color = if (dark) Tw.slate400 else Tw.slate500)
            }
            state.linkError != null -> AuthErrorBox(state.linkError!!)
            state.success -> Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(48.dp).clip(CircleShape).background(Tw.emerald500.copy(alpha = 0.10f)), contentAlignment = Alignment.Center) { LuIcon(Lu.CheckCircle2, 24.dp, Tw.emerald500) }
                Text("تم تعيين كلمة المرور الجديدة بنجاح.", style = twText(14, FontWeight.Bold, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate200 else Tw.slate800)
                AuthPrimaryButton("تسجيل الدخول الآن", false, onClick = onSuccess)
            }
            else -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                state.email?.let {
                    Row {
                        Text("إعادة تعيين كلمة المرور لحساب: ", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                        Text(it, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate800)
                    }
                }
                state.submitError?.let { AuthErrorBox(it) }
                AuthField("كلمة المرور الجديدة", state.newPassword, viewModel::onNewPasswordChange, "••••••••", password = true)
                AuthField("تأكيد كلمة المرور", state.confirmPassword, viewModel::onConfirmPasswordChange, "••••••••", password = true)
                AuthPrimaryButton("تعيين كلمة المرور", state.isSubmitting, onClick = { viewModel.submitNewPassword(oobCode) })
            }
        }
    }
}
