package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.ManageAccounts
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.local.SavedAccount
import studio.ai.literium.literium_app.data.local.SavedAccountsRepository
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.ui.theme.LiteriumTheme

/**
 * Email/password sign-in — the real, sole interactive auth path (spec §3.1). Full port of the `mode
 * === 'login'` half of `AuthModal.tsx`, including its "saved accounts on this device" quick-picker
 * ([SavedAccountsRepository], a Kotlin port of `src/utils/savedAccounts.ts` — no password ever
 * stored, only prefills the email and still always prompts for the password, exactly like the web).
 *
 * Presented as its own navigation destination (per [studio.ai.literium.literium_app.navigation.Screen.Login])
 * rather than a modal, since this app models auth as real nav-graph screens instead of the web's
 * single toggleable `AuthModal` — a structural adaptation, not a missing feature.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit,
    onNavigateToForgotPassword: () -> Unit,
    onNavigateBack: (() -> Unit)? = null,
    viewModel: AuthViewModel = viewModel()
) {
    val state by viewModel.loginState.collectAsState()
    var passwordVisible by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val savedAccountsRepository = remember { SavedAccountsRepository(context) }
    val savedAccounts by savedAccountsRepository.savedAccounts.collectAsState(initial = emptyList())
    var useNewAccountForm by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(state.loginSucceeded) {
        if (state.loginSucceeded) {
            state.loggedInUser?.let { user ->
                savedAccountsRepository.rememberAccount(
                    uid = user.id, email = user.email, fullName = user.fullName,
                    avatarUrl = user.avatarUrl, role = user.role
                )
            }
            viewModel.consumeLoginSuccess()
            onLoginSuccess()
        }
    }

    Scaffold(
        topBar = {
            if (onNavigateBack != null) {
                TopAppBar(
                    title = { Text("تسجيل الدخول") },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.Filled.ArrowBack, contentDescription = "رجوع")
                        }
                    }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(BrandTeal.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.Login, contentDescription = null, tint = BrandTeal)
            }
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = "تسجيل الدخول إلى ليتيريوم",
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = "مرحباً بعودتك إلى فضاء الأدب والفكر",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp, bottom = 20.dp)
            )

            val showSavedAccountsPicker = savedAccounts.isNotEmpty() && !useNewAccountForm

            if (showSavedAccountsPicker) {
                Button(
                    onClick = {
                        viewModel.onLoginEmailChange(""); viewModel.onLoginPasswordChange("")
                        useNewAccountForm = true
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandTeal)
                ) {
                    Icon(Icons.Filled.ManageAccounts, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("تسجيل الدخول بحساب آخر أو إنشاء حساب جديد", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    "أو اختر من الحسابات المحفوظة على هذا الجهاز:",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                savedAccounts.forEach { account ->
                    SavedAccountRow(
                        account = account,
                        onClick = {
                            viewModel.onLoginEmailChange(account.email)
                            viewModel.onLoginPasswordChange("")
                            useNewAccountForm = true
                        },
                        onForget = { coroutineScope.launch { savedAccountsRepository.forgetAccount(account.uid) } }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    "لا تُحفظ كلمات المرور على الجهاز — تُطلب في كل مرة.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                if (savedAccounts.isNotEmpty()) {
                    TextButton(onClick = { useNewAccountForm = false }) {
                        Text("← العودة إلى الحسابات المحفوظة", color = BrandTeal, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                }

                if (state.errorMessage != null) {
                    AuthErrorBanner(state.errorMessage!!)
                    Spacer(modifier = Modifier.height(12.dp))
                }

                OutlinedTextField(
                    value = state.email,
                    onValueChange = viewModel::onLoginEmailChange,
                    label = { Text("البريد الإلكتروني") },
                    placeholder = { Text("name@example.com") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = state.password,
                    onValueChange = viewModel::onLoginPasswordChange,
                    label = { Text("كلمة المرور") },
                    placeholder = { Text("••••••••") },
                    singleLine = true,
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                contentDescription = null
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                )

                Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onNavigateToForgotPassword) {
                        Text("نسيت كلمة المرور؟", color = BrandTeal, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = viewModel::login,
                    enabled = !state.isLoading,
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandTeal)
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text("تسجيل الدخول", fontWeight = FontWeight.ExtraBold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("ليس لديك حساب بعد؟ ", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = onNavigateToRegister) {
                    Text("إنشاء حساب جديد", color = BrandTeal, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}

/** Shared error banner used by all three auth screens — matches `AuthModal.tsx`'s rose error card. */
@Composable
internal fun AuthErrorBanner(message: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF43F5E).copy(alpha = 0.10f), RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = message, color = Color(0xFFE11D48), fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

/** One saved-account card — matches `AuthModal.tsx`'s device account-picker row (avatar/initial,
 *  name, email, and a trash icon that only removes this entry via [onForget], never the others). */
@Composable
private fun SavedAccountRow(account: SavedAccount, onClick: () -> Unit, onForget: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier.weight(1f).clickable(onClick = onClick).padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (account.avatarUrl.isNotBlank()) {
                AsyncImage(
                    model = account.avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.size(36.dp).background(BrandTeal.copy(alpha = 0.15f), CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier.size(36.dp).background(BrandTeal.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        (account.fullName.ifBlank { account.email }).first().uppercase(),
                        fontWeight = FontWeight.Black,
                        color = BrandTeal,
                        fontSize = 14.sp
                    )
                }
            }
            Column(modifier = Modifier.padding(start = 10.dp)) {
                Text(account.fullName, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1)
                Text(account.email, fontSize = 10.5.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            }
        }
        IconButton(onClick = onForget) {
            Icon(Icons.Filled.Delete, contentDescription = "إزالة هذا الحساب من القائمة", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun LoginScreenPreview() {
    LiteriumTheme {
        LoginScreen(onLoginSuccess = {}, onNavigateToRegister = {}, onNavigateToForgotPassword = {})
    }
}
