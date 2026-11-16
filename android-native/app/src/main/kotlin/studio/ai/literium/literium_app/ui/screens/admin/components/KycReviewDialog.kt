package studio.ai.literium.literium_app.ui.screens.admin.components

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.KycDocumentResponse
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.screens.admin.tabs.Adm
import studio.ai.literium.literium_app.ui.screens.admin.tabs.AdmDialog
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

private val CONFIDENCE_LABEL = mapOf("high" to "مرتفعة جداً", "medium" to "متوسطة", "low" to "منخفضة", "none" to "لا تطابق")

/** "تدقيق وتوثيق الهوية (KYC)" — ترجمة حرفية لـ KycReviewModal.tsx. */
@Composable
fun KycReviewDialog(viewModel: AdminViewModel, user: User, onDismiss: () -> Unit) {
    var doc by remember { mutableStateOf<KycDocumentResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(user.id) {
        isLoading = true; error = null
        viewModel.fetchKycDocument(user.id).onSuccess { doc = it }.onFailure { error = it.message ?: "تعذر جلب وثيقة المراجعة." }
        isLoading = false
    }
    val kyc = user.kycDetails
    val s16 = RoundedCornerShape(16.dp)
    val s12 = RoundedCornerShape(12.dp)

    AdmDialog(onDismiss) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(s16).background(Adm.amber500.copy(alpha = 0.2f)).border(1.dp, Adm.amber500.copy(alpha = 0.3f), s16), contentAlignment = Alignment.Center) { LuIcon(Lu.UserCheck, 20.dp, Adm.amber400) }
                Column {
                    Text("تدقيق وتوثيق الهوية (KYC)", style = twText(16, FontWeight.ExtraBold, 24), color = Color.White)
                    Text("مراجعة بيانات إثبات الشخصية للحساب المالي", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
            }
            Box(Modifier.clip(s12).twClickable { onDismiss() }.padding(6.dp)) { LuIcon(Lu.X, 20.dp, Tw.slate400) }
        }

        Row(Modifier.fillMaxWidth().clip(s16).background(Tw.slate950).border(1.dp, Tw.slate800, s16).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(user.avatarUrl, user.fullName, Modifier.size(48.dp).clip(s12).border(1.dp, brand.s500.copy(alpha = 0.2f), s12), contentScale = ContentScale.Crop)
            Column(Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(user.fullName, style = twText(14, FontWeight.Bold, 20), color = Color.White)
                    if (user.isVerified == true) LuIcon(Lu.CheckCircle2, 16.dp, Adm.blue400)
                }
                Text("@${user.username}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = Adm.mono)
                Text(user.email, style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            }
        }

        Column(Modifier.fillMaxWidth().clip(s16).background(Tw.slate950).border(1.dp, Tw.slate800, s16).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("بيانات الوثيقة الرسمية المقدمة:", style = twText(12, FontWeight.Bold, 16), color = Tw.slate300)
            @Composable
            fun Cell(label: String, value: String, color: Color, mono: Boolean, modifier: Modifier) {
                Column(modifier.clip(s12).background(Tw.slate900).border(1.dp, Tw.slate800, s12).padding(12.dp)) {
                    Text(label, style = twText(10, FontWeight.Normal, 14), color = Tw.slate400)
                    Text(value, Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Bold, 16), color = color, fontFamily = if (mono) Adm.mono else androidx.compose.ui.text.font.FontFamily.Default)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Cell("نوع وثيقة الإثبات", kyc?.idType ?: "بطاقة هوية وطنية / جواز سفر", Color.White, false, Modifier.weight(1f))
                Cell("رقم الوثيقة / الهوية", kyc?.idNumber ?: "غير متوفر", brand.s300, true, Modifier.weight(1f))
            }
            kyc?.submittedAt?.let { Text("تاريخ تقديم الطلب: $it", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400) }

            if (isLoading) {
                Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(16.dp), color = Tw.slate400, strokeWidth = 2.dp)
                    Text("  جاري جلب صورة الوثيقة وتحليل الذكاء الاصطناعي...", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
            }
            error?.let {
                Row(Modifier.fillMaxWidth().clip(s12).background(Color(0xFF450A0A).copy(alpha = 0.4f)).border(1.dp, Color(0xFF991B1B), s12).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                    LuIcon(Lu.AlertTriangle, 16.dp, Color(0xFFF87171), Modifier.padding(top = 2.dp))
                    Text(it, style = twText(12, FontWeight.Normal, 16), color = Color(0xFFFECACA))
                }
            }
            doc?.imageUrl?.let { url ->
                Column {
                    Text("صورة الوثيقة المرفوعة (للأدمن فقط):", Modifier.padding(bottom = 6.dp), style = twText(10, FontWeight.Normal, 14), color = Tw.slate400)
                    Box(Modifier.fillMaxWidth().heightIn(max = 224.dp).clip(s12).background(Tw.slate900).border(1.dp, Tw.slate800, s12), contentAlignment = Alignment.Center) {
                        AsyncImage(url, "وثيقة KYC", Modifier.fillMaxWidth().heightIn(max = 224.dp), contentScale = ContentScale.Fit)
                    }
                }
            }
            doc?.let { d ->
                Column(Modifier.fillMaxWidth().clip(s12).background(Tw.slate900).border(1.dp, Tw.slate800, s12).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        LuIcon(Lu.Sparkles, 14.dp, brand.s300)
                        Text("نتيجة تحليل الذكاء الاصطناعي", style = twText(11, FontWeight.Bold, 16), color = brand.s300)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text("الاسم المستخرَج من الوثيقة", style = twText(10, FontWeight.Normal, 14), color = Tw.slate400)
                            Text(d.extractedName ?: "تعذّرت القراءة", Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Bold, 16), color = Color.White)
                        }
                        Column(Modifier.weight(1f)) {
                            Text("درجة المطابقة مع اسم الحساب", style = twText(10, FontWeight.Normal, 14), color = Tw.slate400)
                            Text(CONFIDENCE_LABEL[d.matchConfidence ?: "none"] ?: (d.matchConfidence ?: "—"), Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Bold, 16), color = Color.White)
                        }
                    }
                    d.aiReasoning?.let { Text(it, style = twText(11, FontWeight.Normal, 18), color = Tw.slate400) }
                }
            }
        }

        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f).clip(s12).background(Tw.slate800).twClickable { onDismiss() }.padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
                Text("إغلاق", style = twText(12, FontWeight.Bold, 16), color = Tw.slate300)
            }
            if (user.isKycVerified != true) {
                Row(Modifier.weight(1f).clip(s12).background(Color(0xFFDC2626)).twClickable { viewModel.rejectKyc(user.id); onDismiss() }.padding(vertical = 10.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    LuIcon(Lu.XCircle, 16.dp, Color.White)
                    Text(" رفض الطلب", style = twText(12, FontWeight.ExtraBold, 16), color = Color.White)
                }
                Row(Modifier.weight(1f).clip(s12).background(Adm.emerald600).twClickable { viewModel.approveKyc(user.id); onDismiss() }.padding(vertical = 10.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    LuIcon(Lu.ShieldCheck, 16.dp, Color.White)
                    Text(" اعتماد وتوثيق", style = twText(12, FontWeight.ExtraBold, 16), color = Color.White)
                }
            }
        }
    }
}
