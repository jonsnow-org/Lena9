package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.local.SavedAccount
import studio.ai.literium.literium_app.data.local.SavedAccountsRepository
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/**
 * تسجيل الدخول — وضع login في AuthModal.tsx: رأس «تسجيل الدخول إلى ليتيريوم»، واختيار حساب محفوظ
 * (زر teal + بطاقات حسابات + حذف)، أو نموذج بريد/كلمة مرور مع «نسيت كلمة المرور؟» وزر الإرسال، وتذييل التبديل للتسجيل.
 */
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit,
    onNavigateToForgotPassword: () -> Unit,
    onNavigateBack: (() -> Unit)? = null,
    viewModel: AuthViewModel = viewModel()
) {
    val state by viewModel.loginState.collectAsState()
    val context = LocalContext.current
    val savedRepo = remember { SavedAccountsRepository(context) }
    val savedAccounts by savedRepo.savedAccounts.collectAsState(initial = emptyList())
    var useNewAccountForm by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val dark = isDark

    LaunchedEffect(state.loginSucceeded) {
        if (state.loginSucceeded) {
            state.loggedInUser?.let { user ->
                savedRepo.rememberAccount(user.id, user.email, user.fullName, user.avatarUrl, user.role)
            }
            viewModel.consumeLoginSuccess()
            onLoginSuccess()
        }
    }

    AuthShell(Lu.LogIn, "تسجيل الدخول إلى ليتيريوم", "مرحباً بعودتك إلى فضاء الأدب والفكر") {
        val showPicker = savedAccounts.isNotEmpty() && !useNewAccountForm
        if (showPicker) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                AuthPrimaryButton("تسجيل الدخول بحساب آخر أو إنشاء حساب جديد", false, icon = Lu.UserCog) {
                    viewModel.onLoginEmailChange(""); viewModel.onLoginPasswordChange(""); useNewAccountForm = true
                }
                Text("أو اختر من الحسابات المحفوظة على هذا الجهاز:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    savedAccounts.forEach { acc ->
                        SavedAccountRow(acc,
                            onPick = { viewModel.onLoginEmailChange(acc.email); viewModel.onLoginPasswordChange(""); useNewAccountForm = true },
                            onForget = { scope.launch { savedRepo.forgetAccount(acc.uid) } })
                    }
                }
                Text("لا تُحفظ كلمات المرور على الجهاز — تُطلب في كل مرة.", Modifier.fillMaxWidth(), style = twText(10, FontWeight.Normal, 16).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate500 else Tw.slate400)
            }
        } else {
            if (savedAccounts.isNotEmpty()) {
                AuthLink("→ العودة إلى الحسابات المحفوظة") {
                    viewModel.onLoginEmailChange(""); viewModel.onLoginPasswordChange(""); useNewAccountForm = false
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                AuthField("البريد الإلكتروني", state.email, viewModel::onLoginEmailChange, "name@example.com", email = true)
                Column {
                    AuthField("كلمة المرور", state.password, viewModel::onLoginPasswordChange, "••••••••", password = true)
                    AuthLink("نسيت كلمة المرور؟", Modifier.padding(top = 6.dp), onNavigateToForgotPassword)
                }
                state.errorMessage?.let { AuthErrorBox(it) }
                AuthPrimaryButton("تسجيل الدخول", state.isLoading, trailing = Lu.ArrowRight, onClick = viewModel::login)
            }
        }
        // تذييل التبديل
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("ليس لديك حساب بعد؟ ", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
            Text(
                "إنشاء حساب جديد", Modifier.twClickable(onClick = onNavigateToRegister),
                style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal600
            )
        }
    }
}

@Composable
private fun SavedAccountRow(account: SavedAccount, onPick: () -> Unit, onForget: () -> Unit) {
    val dark = isDark
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(if (dark) Tw.slate800.copy(alpha = 0.40f) else Tw.slate50.copy(alpha = 0.60f))
            .border(1.dp, if (dark) Tw.slate800 else Tw.slate200, shape).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(Modifier.weight(1f).twClickable(onClick = onPick), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (account.avatarUrl.isNotBlank()) {
                AsyncImage(account.avatarUrl, account.fullName, Modifier.size(36.dp).clip(CircleShape), contentScale = ContentScale.Crop)
            } else {
                Box(Modifier.size(36.dp).clip(CircleShape).background(Tw.teal600.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                    Text((account.fullName.ifBlank { account.email }).take(1).uppercase(), style = twText(14, FontWeight.Black, 20), color = if (dark) Tw.teal300 else Tw.teal600)
                }
            }
            Column(Modifier.weight(1f)) {
                Text(account.fullName, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(account.email, style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Box(Modifier.clip(RoundedCornerShape(12.dp)).twClickable(onClick = onForget).padding(8.dp)) { LuIcon(Lu.Trash2, 16.dp, Tw.slate400) }
    }
}
