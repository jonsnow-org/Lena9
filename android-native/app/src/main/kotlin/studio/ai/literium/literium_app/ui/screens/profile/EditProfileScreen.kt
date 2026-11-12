package studio.ai.literium.literium_app.ui.screens.profile

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/** تعديل الملف الشخصي — EditProfileModal.tsx كصفحة: رأس، ثم p-6 space-y-5 (صورة 96dp، اسم، نبذة، زر حفظ brand-600). */
@Composable
fun EditProfileScreen(navController: NavController, viewModel: EditProfileViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val dark = isDark
    val line = if (dark) Tw.slate800 else Tw.slate200
    val txt = if (dark) Tw.white else Tw.slate900
    val shell = RoundedCornerShape(24.dp)

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let { viewModel.uploadAvatar(context, it) } }

    Box(Modifier.fillMaxSize().padding(8.dp)) {
        Column(Modifier.fillMaxSize().shadow(16.dp, shell, clip = false).clip(shell).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, line, shell)) {
            Row(
                Modifier.fillMaxWidth().background(if (dark) Tw.slate900.copy(alpha = 0.80f) else Tw.slate50.copy(alpha = 0.80f)).padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Text("تعديل الملف الشخصي", style = twText(16, FontWeight.Black, 24), color = txt)
                Box(Modifier.twClickable { navController.popBackStack() }.padding(8.dp)) { LuIcon(Lu.X, 20.dp, Tw.slate400) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(line))

            if (state.isLoading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }
            } else Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                state.error?.let { err ->
                    val es = RoundedCornerShape(16.dp)
                    Row(Modifier.fillMaxWidth().clip(es).background(Tw.rose500.copy(alpha = 0.10f)).border(1.dp, Tw.rose500.copy(alpha = 0.20f), es).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(Lu.AlertCircle, 16.dp, Tw.rose500)
                        Text(err, style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.rose400 else Tw.rose600)
                    }
                }

                // الصورة
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box {
                        val avShape = RoundedCornerShape(24.dp)
                        AsyncImage(state.avatarUrl, state.name, Modifier.size(96.dp).shadow(3.dp, avShape, clip = false).clip(avShape).border(4.dp, brand.s500.copy(alpha = 0.20f), avShape), contentScale = ContentScale.Crop)
                        if (state.isUploadingAvatar) Box(Modifier.matchParentSize().clip(avShape).background(Tw.slate950.copy(alpha = 0.60f)), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(24.dp), color = Tw.white, strokeWidth = 2.dp) }
                    }
                    if (state.uploadConfigured) {
                        Row(
                            Modifier.clip(RoundedCornerShape(12.dp)).background(if (dark) Tw.slate800 else Tw.slate100).then(if (state.isUploadingAvatar) Modifier.alpha(0.5f) else Modifier)
                                .twClickable(enabled = !state.isUploadingAvatar) { pickImage.launch("image/*") }.padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            LuIcon(Lu.Camera, 14.dp, if (dark) Tw.slate200 else Tw.slate700)
                            Text("تغيير الصورة", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate700)
                        }
                    } else Field("رابط صورة خارجي", state.avatarUrl, viewModel::onAvatarUrlChange, dark, placeholder = "https://...")
                }

                Field(state.nameFieldLabel, state.name, viewModel::onNameChange, dark, bold = true)

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("نبذة تعريفية (الحالة)", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                        Text("${state.bio.length}/160", style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
                    }
                    InputBox(dark, Modifier.heightIn(min = 84.dp)) {
                        if (state.bio.isEmpty()) Text("اكتب نبذة قصيرة تظهر في ملفك الشخصي...", style = twText(12, FontWeight.Normal, 20), color = Tw.slate400)
                        BasicTextField(state.bio, viewModel::onBioChange, minLines = 3, textStyle = twText(12, FontWeight.Normal, 20).copy(color = txt), cursorBrush = SolidColor(brand.s500), modifier = Modifier.fillMaxWidth())
                    }
                }

                Field("الموقع الإلكتروني", state.socialWebsite, { viewModel.onSocialChange("website", it) }, dark, ltr = true)
                Field("X (تويتر)", state.socialTwitter, { viewModel.onSocialChange("twitter", it) }, dark, ltr = true)
                Field("انستغرام", state.socialInstagram, { viewModel.onSocialChange("instagram", it) }, dark, ltr = true)
                Field("لينكدإن", state.socialLinkedin, { viewModel.onSocialChange("linkedin", it) }, dark, ltr = true)
                Field("فيسبوك", state.socialFacebook, { viewModel.onSocialChange("facebook", it) }, dark, ltr = true)
                Field("يوتيوب", state.socialYoutube, { viewModel.onSocialChange("youtube", it) }, dark, ltr = true)
                Field("واتساب", state.socialWhatsapp, { viewModel.onSocialChange("whatsapp", it) }, dark, ltr = true)
                Field("تيليجرام", state.socialTelegram, { viewModel.onSocialChange("telegram", it) }, dark, ltr = true)

                val busy = state.isSaving || state.isUploadingAvatar
                val bs = RoundedCornerShape(16.dp)
                Row(
                    Modifier.fillMaxWidth().clip(bs).background(brand.s600).then(if (busy) Modifier.alpha(0.6f) else Modifier)
                        .twClickable(enabled = !busy, pressScale = 0.95f) { viewModel.save { navController.popBackStack() } }.padding(horizontal = 24.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically
                ) {
                    when {
                        state.isSaving -> { CircularProgressIndicator(Modifier.size(16.dp), color = Tw.white, strokeWidth = 2.dp); Text("جارٍ الحفظ…", style = twText(12, FontWeight.ExtraBold, 16), color = Tw.white) }
                        state.saved -> { LuIcon(Lu.CheckCircle2, 16.dp, Tw.white); Text("تم الحفظ", style = twText(12, FontWeight.ExtraBold, 16), color = Tw.white) }
                        else -> { LuIcon(Lu.Save, 16.dp, Tw.white); Text("حفظ التعديلات", style = twText(12, FontWeight.ExtraBold, 16), color = Tw.white) }
                    }
                }
            }
        }
    }
}

@Composable
private fun InputBox(dark: Boolean, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Box(modifier.fillMaxWidth().clip(s).background(if (dark) Tw.slate800 else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, s).padding(horizontal = 14.dp, vertical = 10.dp)) { content() }
}

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit, dark: Boolean, bold: Boolean = false, ltr: Boolean = false, placeholder: String = "") {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
        InputBox(dark) {
            if (value.isEmpty() && placeholder.isNotEmpty()) Text(placeholder, style = twText(12, FontWeight.Normal, 20), color = Tw.slate400)
            val st: TextStyle = twText(if (bold) 14 else 12, if (bold) FontWeight.Bold else FontWeight.Normal, 20).copy(color = if (dark) Tw.white else Tw.slate900)
            BasicTextField(value, onChange, singleLine = true, textStyle = if (ltr) st.copy(textDirection = androidx.compose.ui.text.style.TextDirection.Ltr) else st, cursorBrush = SolidColor(brand.s500), modifier = Modifier.fillMaxWidth())
        }
    }
}
