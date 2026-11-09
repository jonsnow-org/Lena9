package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import studio.ai.literium.literium_app.ui.theme.Lu

/** نسيت كلمة المرور — العرض المصغّر داخل AuthModal (isForgotPassword): صندوق توضيح، حقل بريد، زر الإرسال. */
@Composable
fun ForgotPasswordScreen(
    onNavigateBackToLogin: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    val state by viewModel.forgotPasswordState.collectAsState()
    AuthShell(Lu.LogIn, "تسجيل الدخول إلى ليتيريوم", "مرحباً بعودتك إلى فضاء الأدب والفكر") {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            AuthInfoBox("أدخل بريدك الإلكتروني المسجَّل، وسنرسل لك رابط إعادة تعيين كلمة المرور.")
            if (state.isSent) {
                AuthSuccessBox("تم إرسال رابط إعادة التعيين إلى ${state.email}. افتح بريدك واتبع الرابط.")
            } else {
                state.errorMessage?.let { AuthErrorBox(it) }
                AuthField("البريد الإلكتروني", state.email, viewModel::onForgotPasswordEmailChange, "name@example.com", email = true)
                AuthPrimaryButton("إرسال رابط إعادة التعيين", state.isSubmitting, onClick = viewModel::submitPasswordReset)
            }
            AuthLink("→ العودة لتسجيل الدخول", Modifier, onNavigateBackToLogin)
        }
    }
}
