package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.foundation.layout.ExperimentalLayoutApi
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.local.SavedAccountsRepository
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.ui.theme.LiteriumTheme
import studio.ai.literium.literium_app.util.CreatorEligibility
import studio.ai.literium.literium_app.util.RevenueShares

/**
 * The single merged registration form (spec §3.2) — `AuthModal.tsx`'s `mode === 'register'` half,
 * ported in full: there is deliberately no separate "register as a reader" vs "register as a
 * writer" flow (spec §1.3), every new account is created with `role = 'writer'` in
 * [AuthViewModel.register], and this screen shows the exact same monetization-eligibility
 * conditions card and revenue-split numbers `AuthModal.tsx` renders (sourced live from
 * [CreatorEligibility] / [RevenueShares], never hardcoded separately, so it can't drift). Also
 * remembers the fresh account on this device on success, matching `App.tsx`'s own `rememberAccount`
 * call in its `onAuthStateChanged` handler (see [LoginScreen] for the picker itself).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RegisterScreen(
    onRegisterSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateBack: (() -> Unit)? = null,
    viewModel: AuthViewModel = viewModel()
) {
    val state by viewModel.registerState.collectAsState()
    var passwordVisible by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val savedAccountsRepository = remember { SavedAccountsRepository(context) }

    LaunchedEffect(state.registerSucceeded) {
        if (state.registerSucceeded) {
            state.registeredUser?.let { user ->
                savedAccountsRepository.rememberAccount(
                    uid = user.id, email = user.email, fullName = user.fullName,
                    avatarUrl = user.avatarUrl, role = user.role
                )
            }
            viewModel.consumeRegisterSuccess()
            onRegisterSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("إنشاء حساب جديد") },
                navigationIcon = {
                    if (onNavigateBack != null) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.Filled.ArrowBack, contentDescription = "رجوع")
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            Text(
                text = "انضم ككاتب ومؤلف واستمتع بكافة مميزات المنصة",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 14.dp)
            )

            if (state.errorMessage != null) {
                AuthErrorBanner(state.errorMessage!!)
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Unified role badge — "كاتب ومؤلف" (spec §3.2 UNIFIED_REGISTER_ROLE_INFO)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BrandTeal.copy(alpha = 0.08f), RoundedCornerShape(18.dp))
                    .border(1.dp, BrandTeal.copy(alpha = 0.4f), RoundedCornerShape(18.dp))
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier.size(40.dp).background(BrandTeal.copy(alpha = 0.15f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Edit, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(20.dp))
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("كاتب ومؤلف", fontWeight = FontWeight.Black, fontSize = 13.sp, color = BrandTeal)
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier.background(BrandTeal.copy(alpha = 0.18f), RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("شامل القراءة والنشر والإعلان", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
                        }
                    }
                    Text(
                        text = "نشر مقالات وجني أرباح ${RevenueShares.LOCKED_ARTICLES.writerPercent}-${RevenueShares.IN_ARTICLE_ADS.writerPercent}% مع القراءة الحرة وإطلاق الإعلانات",
                        fontSize = 11.sp,
                        color = BrandTeal.copy(alpha = 0.85f),
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Writer profile fields card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BrandTeal.copy(alpha = 0.05f), RoundedCornerShape(18.dp))
                    .padding(14.dp)
            ) {
                Text("بيانات الكاتب والملف الأدبي:", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = BrandTeal)
                Spacer(modifier = Modifier.height(10.dp))

                // Eligibility conditions card
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp))
                        .border(1.dp, BrandTeal.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                        .padding(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Info, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("شروط الانضمام لبرنامج شركاء المحتوى (احتساب الأرباح)", fontWeight = FontWeight.Black, fontSize = 11.sp)
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "الكتابة والقراءة والنشر متاحة فوراً لأي حساب مسجل دون قيد. لكن احتساب أرباح الإعلانات ومبيعات المقالات المقفلة يبدأ فقط بعد تحقيق كل الشروط التالية معاً:",
                        fontSize = 10.5.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    listOf(
                        "${CreatorEligibility.MIN_FOLLOWERS} متابع على الأقل",
                        "${CreatorEligibility.MIN_VALID_VIEWS} مشاهدة موثوقة على الأقل لمقالاتك المنشورة",
                        "${CreatorEligibility.MIN_ACCOUNT_AGE_DAYS} يوماً على الأقل على عمر الحساب",
                        "${CreatorEligibility.MIN_PUBLISHED_ARTICLES} مقالات منشورة على الأقل",
                        "توثيق الهوية (KYC) — شرط إلزامي لسحب الأرباح"
                    ).forEach { condition ->
                        Row(modifier = Modifier.padding(vertical = 1.dp), verticalAlignment = Alignment.Top) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = BrandTeal, modifier = Modifier.size(12.dp).padding(top = 2.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(condition, fontSize = 10.5.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("حصة الكاتب من الأرباح بعد تحقيق الأهلية:", fontWeight = FontWeight.Bold, fontSize = 10.5.sp)
                    Text("• إعلانات داخل المقالات: ${RevenueShares.IN_ARTICLE_ADS.label}", fontSize = 10.5.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("• إعلانات الملف الشخصي: ${RevenueShares.WRITER_PROFILE_ADS.label}", fontSize = 10.5.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("• مبيعات المقالات المقفلة: ${RevenueShares.LOCKED_ARTICLES.label}", fontSize = 10.5.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Promotion note
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF06B6D4).copy(alpha = 0.08f), RoundedCornerShape(14.dp))
                        .padding(10.dp)
                ) {
                    Icon(Icons.Filled.Campaign, contentDescription = null, tint = Color(0xFF0891B2), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        buildString {
                            append("للراغبين بالإعلان والترويج: ")
                            append("الترويج والإعلان متاح لجميع الحسابات المسجلة ولا يتطلب أي اشتراك خاص، بل يحتاج فقط لفتح حساب في المنصة وإيداع الرصيد في محفظتك لإطلاق حملاتك فوراً.")
                        },
                        fontSize = 10.5.sp,
                        color = Color(0xFF0E7490)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = state.name,
                    onValueChange = viewModel::onRegisterNameChange,
                    label = { Text("الاسم الكامل / الاسم الأدبي *") },
                    placeholder = { Text("مثال: د. طارق المنصور") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = state.bio,
                    onValueChange = viewModel::onRegisterBioChange,
                    label = { Text("نبذة تعريفية قصيرة") },
                    placeholder = { Text("نبذة عن مسيرتك الأدبية واهتماماتك الكتابية") },
                    minLines = 2,
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))
                Text("التخصصات والاهتمامات (اختر واحد أو أكثر):", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                Spacer(modifier = Modifier.height(6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    WRITER_SPECIALTY_PRESETS.forEach { spec ->
                        val selected = spec in state.specialties
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (selected) BrandTeal else Color.Transparent, RoundedCornerShape(50))
                                .border(1.dp, if (selected) BrandTeal else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(50))
                                .clickable { viewModel.toggleSpecialty(spec) }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = spec,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
                Text("صورة الملف الأدبي:", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    WRITER_AVATAR_PRESETS.forEach { url ->
                        val selected = url == state.avatarUrl
                        AsyncImage(
                            model = url,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .border(if (selected) 2.dp else 1.dp, if (selected) BrandTeal else Color.Transparent, CircleShape)
                                .clickable { viewModel.onRegisterAvatarSelected(url) }
                        )
                    }
                }
                Text(
                    "يمكن تغييرها لاحقاً من إعدادات الملف الشخصي.",
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = state.email,
                onValueChange = viewModel::onRegisterEmailChange,
                label = { Text("البريد الإلكتروني") },
                placeholder = { Text("name@example.com") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp)
            )
            Spacer(modifier = Modifier.height(10.dp))
            OutlinedTextField(
                value = state.password,
                onValueChange = viewModel::onRegisterPasswordChange,
                label = { Text("كلمة المرور") },
                placeholder = { Text("••••••••") },
                singleLine = true,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, contentDescription = null)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp)
            )
            Text("6 أحرف على الأقل", fontSize = 9.5.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))

            Spacer(modifier = Modifier.height(18.dp))
            Button(
                onClick = viewModel::register,
                enabled = !state.isLoading,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandTeal)
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text("إنشاء الحساب والبدء (كاتب ومؤلف)", fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                Text("لديك حساب بالفعل؟ ", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = onNavigateToLogin) {
                    Text("تسجيل الدخول", color = BrandTeal, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun RegisterScreenPreview() {
    LiteriumTheme {
        RegisterScreen(onRegisterSuccess = {}, onNavigateToLogin = {})
    }
}
