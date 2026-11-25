package studio.ai.literium.literium_app.ui.screens.kyc

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwButton
import studio.ai.literium.literium_app.ui.theme.TwError
import studio.ai.literium.literium_app.ui.theme.TwInput
import studio.ai.literium.literium_app.ui.theme.TwLabeled
import studio.ai.literium.literium_app.ui.theme.TwLoading
import studio.ai.literium.literium_app.ui.theme.TwPage
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/** التحقق من الهوية — KycModal.tsx: ثلاث حالات (موثّق/قيد المراجعة/نموذج) وبطاقات إشعار rounded-2xl. */
@Composable
fun KycScreen(navController: NavController, viewModel: KycViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val dark = isDark
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let { viewModel.onImagePicked(context, it) } }

    TwPage(title = "التحقق من الهوية (KYC)", onClose = { navController.popBackStack() }) {
        when {
            state.isLoading -> TwLoading()
            state.isVerified -> Result(Lu.CheckCircle2, Tw.emerald500, "حسابك موثق ومعتمد بنجاح ✓",
                "تمت مراجعة الوثيقة الرسمية (${state.idType}: ${state.idNumber}) واعتماد حسابك. يمكنك الآن سحب وإيداع الأرباح بحرية كاملة.",
                "إتمام والعودة للتطبيق") { navController.popBackStack() }
            state.isPending || state.justSubmitted -> Result(Lu.Clock, Tw.amber500, "تم إرسال طلب التوثيق — قيد المراجعة",
                "استلمنا وثيقتك (${state.idType}: ${state.idNumber}) وسيراجعها فريق ليتيريوم يدوياً خلال 24 إلى 48 ساعة. سيصلك إشعار فور اعتماد حسابك.",
                "حسناً، فهمت") { navController.popBackStack() }
            else -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (state.isRejected) Notice(Lu.AlertCircle, Color(0xFFDC2626), "تم رفض طلب التوثيق السابق. راجع بياناتك وأرسل طلباً جديداً بمعلومات ووثيقة صحيحة وواضحة.", dark, red = true)
                state.error?.let { Notice(Lu.AlertCircle, Color(0xFFDC2626), it, dark, red = true) }
                Notice(Lu.Lock, Tw.teal600, "صورة وثيقتك تُرفع مباشرة إلى خوادمنا الداخلية بشكل آمن ومشفَّر، ولا يمكن لأي طرف — بما فيك أنت بعد اعتمادها — عرضها مرة أخرى. تُستخدم فقط لمطابقة اسمها مع اسم حسابك آلياً، وتحسباً لأي أمور قانونية مستقبلية.", dark, red = false)

                TwLabeled("نوع الوثيقة الرسمية") {
                    var open by remember { mutableStateOf(false) }
                    Box {
                        val s = RoundedCornerShape(12.dp)
                        Row(Modifier.fillMaxWidth().clip(s).background(if (dark) Tw.slate800 else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, s).twClickable { open = true }.padding(horizontal = 14.dp, vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(state.idType, style = twText(14, FontWeight.Normal, 20), color = if (dark) Tw.white else Tw.slate900)
                            LuIcon(Lu.ChevronDown, 16.dp, Tw.slate400)
                        }
                        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = if (dark) Tw.slate800 else Tw.white) {
                            KYC_ID_TYPES.forEach { opt -> DropdownMenuItem(text = { Text(opt, style = twText(13, FontWeight.Medium, 20)) }, onClick = { viewModel.onIdTypeChange(opt); open = false }) }
                        }
                    }
                }
                TwLabeled("رقم الوثيقة / الهوية") { TwInput(state.idNumber, viewModel::onIdNumberChange, placeholder = "مثال: SA1092841...") }
                TwLabeled("صورة واضحة للوثيقة (يظهر فيها اسمك كاملاً)") {
                    val picked = state.previewUri
                    if (picked != null) {
                        val s = RoundedCornerShape(16.dp)
                        AsyncImage(picked, "معاينة الوثيقة", Modifier.fillMaxWidth().height(160.dp).clip(s).border(2.dp, Tw.teal600, s).twClickable { pickImage.launch("image/*") }, contentScale = ContentScale.Crop)
                    } else {
                        val s = RoundedCornerShape(16.dp)
                        Column(Modifier.fillMaxWidth().clip(s).border(2.dp, if (dark) Tw.slate700 else Tw.slate300, s).twClickable { pickImage.launch("image/*") }.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            LuIcon(Lu.Camera, 24.dp, Tw.slate500)
                            Text("انقر لاختيار صورة الوثيقة", style = twText(12, FontWeight.Bold, 16), color = Tw.slate500)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                LuIcon(Lu.Upload, 12.dp, Tw.slate500)
                                Text("JPG أو PNG، حتى 8 ميغابايت", style = twText(10, FontWeight.Normal, 15), color = Tw.slate500)
                            }
                        }
                    }
                }
                TwButton(if (state.isSubmitting) "جاري رفع الوثيقة والتحقق..." else "إرسال طلب التوثيق (KYC)", { viewModel.submit(context) }, enabled = state.canSubmit, loading = state.isSubmitting, container = Tw.teal600)
            }
        }
    }
}

@Composable
private fun Notice(icon: androidx.compose.ui.graphics.vector.ImageVector, tone: Color, text: String, dark: Boolean, red: Boolean) {
    val s = RoundedCornerShape(16.dp)
    val bg = if (red) (if (dark) Color(0xFF450A0A).copy(alpha = 0.40f) else Color(0xFFFEF2F2)) else (if (dark) Color(0xFF042F2E).copy(alpha = 0.40f) else Color(0xFFF0FDFA))
    val br = if (red) (if (dark) Color(0xFF991B1B) else Color(0xFFFECACA)) else (if (dark) Color(0xFF115E59) else Color(0xFF99F6E4))
    val fg = if (red) (if (dark) Color(0xFFFECACA) else Color(0xFF7F1D1D)) else (if (dark) Color(0xFF99F6E4) else Color(0xFF134E4A))
    Row(Modifier.fillMaxWidth().clip(s).background(bg).border(1.dp, br, s).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LuIcon(icon, 16.dp, tone, Modifier.padding(top = 2.dp))
        Text(text, style = twText(12, FontWeight.Normal, 20), color = fg)
    }
}

@Composable
private fun Result(icon: androidx.compose.ui.graphics.vector.ImageVector, tone: Color, title: String, body: String, cta: String, onDone: () -> Unit) {
    val dark = isDark
    Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(Modifier.size(64.dp).clip(RoundedCornerShape(24.dp)).background(tone.copy(alpha = 0.10f)), contentAlignment = Alignment.Center) { LuIcon(icon, 40.dp, tone) }
        Text(title, style = twText(18, FontWeight.Black, 28).copy(textAlign = TextAlign.Center), color = if (dark) Tw.white else Tw.slate900)
        Text(body, style = twText(12, FontWeight.Normal, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate400 else Tw.slate500)
        TwButton(cta, onDone, container = Tw.teal600)
    }
}
