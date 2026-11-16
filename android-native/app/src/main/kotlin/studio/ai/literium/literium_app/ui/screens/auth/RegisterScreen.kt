package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.local.SavedAccountsRepository
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/**
 * إنشاء حساب — وضع register في AuthModal.tsx: شارة «كاتب ومؤلف»، الاسم، سطر «تخصيص الملف الشخصي (اختياري)»
 * القابل للطي (نبذة/تخصصات منسدلة/صور)، البريد وكلمة المرور (6 أحرف)، الخطأ فوق الزر، وزر الإنشاء.
 * شروط احتساب الأرباح مخفية كما في الويب لأن WRITER_MONETIZATION_ENABLED=false.
 */
@Composable
fun RegisterScreen(
    onRegisterSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateBack: (() -> Unit)? = null,
    viewModel: AuthViewModel = viewModel()
) {
    val state by viewModel.registerState.collectAsState()
    val context = LocalContext.current
    val savedRepo = remember { SavedAccountsRepository(context) }
    var showExtras by remember { mutableStateOf(false) }
    var specialtyOpen by remember { mutableStateOf(false) }
    val dark = isDark

    LaunchedEffect(state.registerSucceeded) {
        if (state.registerSucceeded) {
            state.registeredUser?.let { u -> savedRepo.rememberAccount(u.id, u.email, u.fullName, u.avatarUrl, u.role) }
            viewModel.consumeRegisterSuccess()
            onRegisterSuccess()
        }
    }

    AuthShell(Lu.UserPlus, "إنشاء حساب جديد", "انضم ككاتب ومؤلف واستمتع بكافة مميزات المنصة") {
        // شارة الدور الموحّد
        val badgeShape = RoundedCornerShape(16.dp)
        Row(
            Modifier.fillMaxWidth().clip(badgeShape).background(Color(0xFF14B8A6).copy(alpha = 0.10f))
                .border(2.dp, Color(0xFF14B8A6).copy(alpha = 0.20f), badgeShape).border(1.dp, Color(0xFF14B8A6).copy(alpha = 0.60f), badgeShape).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Tw.teal600.copy(alpha = 0.20f)), contentAlignment = Alignment.Center) {
                LuIcon(Lu.PenTool, 20.dp, if (dark) Tw.teal300 else Tw.teal600)
            }
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("كاتب ومؤلف", style = twText(12, FontWeight.Black, 16), color = if (dark) Color(0xFF99F6E4) else Color(0xFF134E4A))
                    Text(
                        "شامل القراءة والنشر والإعلان",
                        Modifier.clip(CircleShape).background(Tw.teal600.copy(alpha = 0.20f)).padding(horizontal = 8.dp, vertical = 2.dp),
                        style = twText(10, FontWeight.Bold, 15), color = if (dark) Tw.teal300 else Tw.teal700
                    )
                }
                Text(
                    "نشر مقالات مع القراءة الحرة وإطلاق الإعلانات", Modifier.padding(top = 2.dp),
                    style = twText(11, FontWeight.Normal, 18), color = (if (dark) Tw.teal300 else Tw.teal700).copy(alpha = 0.80f)
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                AuthField("الاسم الكامل / الاسم الأدبي", state.name, viewModel::onRegisterNameChange, "مثال: د. طارق المنصور", small = true)
                // تخصيص الملف الشخصي (اختياري)
                val rowShape = RoundedCornerShape(12.dp)
                Row(
                    Modifier.fillMaxWidth().clip(rowShape).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50)
                        .border(1.dp, if (dark) Tw.slate700 else Tw.slate200, rowShape).twClickable { showExtras = !showExtras }.padding(horizontal = 14.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LuIcon(Lu.PenTool, 14.dp, if (dark) Tw.slate300 else Tw.slate600)
                        Text("تخصيص الملف الشخصي (اختياري)", style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate600)
                    }
                    LuIcon(Lu.ChevronDown, 14.dp, if (dark) Tw.slate300 else Tw.slate600, Modifier.rotate(if (showExtras) 180f else 0f))
                }
                if (showExtras) {
                    Column(
                        Modifier.fillMaxWidth().clip(rowShape).background(if (dark) Tw.slate800.copy(alpha = 0.30f) else Tw.slate50.copy(alpha = 0.60f))
                            .border(1.dp, if (dark) Tw.slate700 else Tw.slate200, rowShape).padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        AuthField("نبذة تعريفية قصيرة", state.bio, viewModel::onRegisterBioChange, "نبذة عن مسيرتك الأدبية واهتماماتك الكتابية", small = true, multiline = true)
                        Column {
                            Text("التخصصات والاهتمامات:", Modifier.padding(bottom = 6.dp), style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                            Row(
                                Modifier.fillMaxWidth().clip(rowShape).background(if (dark) Tw.slate800 else Tw.white).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, rowShape)
                                    .twClickable { specialtyOpen = !specialtyOpen }.padding(horizontal = 14.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    if (state.specialties.isNotEmpty()) state.specialties.joinToString("، ") else "اختر تخصصاً واحداً أو أكثر",
                                    Modifier.weight(1f), style = twText(12, FontWeight.Medium, 16), color = if (dark) Tw.slate300 else Tw.slate700, maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                                LuIcon(Lu.ChevronDown, 14.dp, Tw.slate400, Modifier.rotate(if (specialtyOpen) 180f else 0f))
                            }
                            if (specialtyOpen) {
                                Column(
                                    Modifier.padding(top = 6.dp).fillMaxWidth().heightIn(max = 224.dp).clip(rowShape).background(if (dark) Tw.slate800 else Tw.white)
                                        .border(1.dp, if (dark) Tw.slate700 else Tw.slate200, rowShape).verticalScroll(rememberScrollState()).padding(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    WRITER_SPECIALTY_PRESETS.forEach { spec ->
                                        val checked = spec in state.specialties
                                        Row(
                                            Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (checked) Tw.teal600.copy(alpha = 0.10f) else Color.Transparent)
                                                .twClickable { viewModel.toggleSpecialty(spec) }.padding(horizontal = 10.dp, vertical = 6.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(spec, style = twText(11, FontWeight.Bold, 16), color = if (checked) (if (dark) Tw.teal300 else Tw.teal700) else (if (dark) Tw.slate400 else Tw.slate600))
                                            if (checked) LuIcon(Lu.CheckCircle2, 14.dp, Tw.teal600)
                                        }
                                    }
                                    Box(
                                        Modifier.padding(top = 4.dp).fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Tw.teal600).twClickable { specialtyOpen = false }.padding(vertical = 6.dp),
                                        contentAlignment = Alignment.Center
                                    ) { Text("تم", style = twText(11, FontWeight.Bold, 16), color = Tw.white) }
                                }
                            }
                        }
                        Column {
                            Text("صورة الملف الأدبي:", Modifier.padding(bottom = 6.dp), style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                WRITER_AVATAR_PRESETS.forEach { url ->
                                    val sel = state.avatarUrl == url
                                    AsyncImage(
                                        url, null, contentScale = ContentScale.Crop,
                                        modifier = Modifier.size(40.dp).alpha(if (sel) 1f else 0.6f).clip(CircleShape)
                                            .border(2.dp, if (sel) Color(0xFF14B8A6) else Color.Transparent, CircleShape)
                                            .twClickable { viewModel.onRegisterAvatarSelected(url) }
                                    )
                                }
                            }
                        }
                        Text("يمكن تعديل كل ما سبق لاحقاً من إعدادات الملف الشخصي.", style = twText(10, FontWeight.Normal, 15), color = if (dark) Tw.slate500 else Tw.slate400)
                    }
                }
            }
            AuthField("البريد الإلكتروني", state.email, viewModel::onRegisterEmailChange, "name@example.com", email = true)
            AuthField("كلمة المرور", state.password, viewModel::onRegisterPasswordChange, "••••••••", password = true, hint = "6 أحرف على الأقل")
            state.errorMessage?.let { AuthErrorBox(it) }
            AuthPrimaryButton("إنشاء الحساب والبدء (كاتب ومؤلف)", state.isLoading, trailing = Lu.ArrowRight, onClick = viewModel::register)
        }

        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("لديك حساب بالفعل؟ ", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
            Text("تسجيل الدخول", Modifier.twClickable(onClick = onNavigateToLogin), style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal600)
        }
    }
}
