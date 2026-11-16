package studio.ai.literium.literium_app.ui.screens.admin.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.screens.admin.tabs.Adm
import studio.ai.literium.literium_app.ui.screens.admin.tabs.AdmDialog
import studio.ai.literium.literium_app.ui.screens.admin.tabs.AdmInput
import studio.ai.literium.literium_app.ui.screens.admin.tabs.AdmLabel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/** عتبة المبلغ الكبير (تأكيد ثنائي) — LARGE_ADJUSTMENT_CONFIRM_THRESHOLD في BalanceAdjustModal.tsx. */
private const val LARGE_ADJUSTMENT_CONFIRM_THRESHOLD = 500.0

private data class BalanceField(val key: String, val label: String, val get: (User) -> Double)

private val ADJUSTABLE_FIELDS = listOf(
    BalanceField("walletBalance", "رصيد المحفظة (الإنفاق)") { it.walletBalance ?: 0.0 },
    BalanceField("availableBalance", "متاح للسحب المالي") { it.availableBalance ?: 0.0 },
    BalanceField("pendingEarnings", "أرباح مجمّدة (30 يوماً)") { it.pendingEarnings ?: 0.0 },
    BalanceField("lifetimeEarnings", "إجمالي الأرباح التراكمية") { it.lifetimeEarnings ?: 0.0 }
)

/** "تعديل رصيد المستخدم يدوياً" — ترجمة حرفية لـ BalanceAdjustModal.tsx (السجل عبر AdminViewModel.adjustBalance). */
@Composable
fun BalanceAdjustDialog(viewModel: AdminViewModel, user: User, onDismiss: () -> Unit) {
    var field by remember { mutableStateOf(ADJUSTABLE_FIELDS[0]) }
    var isAdd by remember { mutableStateOf(true) }
    var amountText by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var confirming by remember { mutableStateOf(false) }

    val amount = amountText.toDoubleOrNull()
    val isValidAmount = amount != null && amount > 0
    val delta = if (isAdd) (amount ?: 0.0) else -(amount ?: 0.0)
    val current = field.get(user)
    val projected = Math.round((current + delta) * 100) / 100.0
    val canSubmit = isValidAmount && reason.trim().length >= 3
    val isLarge = (amount ?: 0.0) >= LARGE_ADJUSTMENT_CONFIRM_THRESHOLD

    AdmDialog(onDismiss) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(16.dp)).background(brand.s500.copy(alpha = 0.2f)).border(1.dp, brand.s500.copy(alpha = 0.3f), RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                    LuIcon(Lu.DollarSign, 20.dp, brand.s400)
                }
                Column {
                    Text("تعديل رصيد المستخدم يدوياً", style = twText(16, FontWeight.ExtraBold, 24), color = Color.White)
                    Text("تسجيل حركة مالية رسمية في سجل التدقيق المالي للمنصة", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
            }
            Box(Modifier.clip(RoundedCornerShape(12.dp)).twClickable { onDismiss() }.padding(6.dp)) { LuIcon(Lu.X, 20.dp, Tw.slate400) }
        }

        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(16.dp)).padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(user.avatarUrl, user.fullName, Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, brand.s500.copy(alpha = 0.2f), RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
            Column(Modifier.weight(1f)) {
                Text(user.fullName, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("@${user.username} • ${user.email}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = Adm.mono, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text(user.role, Modifier.clip(RoundedCornerShape(50)).background(brand.s500.copy(alpha = 0.1f)).border(1.dp, brand.s500.copy(alpha = 0.2f), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 2.dp),
                style = twText(10, FontWeight.Bold, 14), color = brand.s300)
        }

        Column {
            AdmLabel("اختر الحساب المستهدف:")
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ADJUSTABLE_FIELDS.forEach { f ->
                    val sel = field.key == f.key
                    val sh = RoundedCornerShape(16.dp)
                    Column(
                        Modifier.fillMaxWidth().clip(sh).background(if (sel) brand.s950.copy(alpha = 0.4f) else Tw.slate950.copy(alpha = 0.6f))
                            .border(if (sel) 2.dp else 1.dp, if (sel) brand.s500 else Tw.slate800, sh)
                            .twClickable { field = f; confirming = false }.padding(12.dp)
                    ) {
                        Text(f.label, style = twText(11, FontWeight.Bold, 16), color = Tw.slate200)
                        Text("الرصيد الحالي: ${Adm.usd(f.get(user))}", Modifier.padding(top = 4.dp), style = twText(12, FontWeight.Black, 16), color = Adm.emerald400, fontFamily = Adm.mono)
                    }
                }
            }
        }

        Column {
            AdmLabel("نوع العملية:")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(true to "+ إضافة رصيد (شحن / مكافأة)", false to "- خصم رصيد (تسوية / تصحيح)").forEach { (add, label) ->
                    val on = isAdd == add
                    val s = RoundedCornerShape(12.dp)
                    Box(
                        Modifier.weight(1f).clip(s).background(if (on) (if (add) Adm.emerald600 else Adm.rose600) else Tw.slate950)
                            .let { if (on) it else it.border(1.dp, Tw.slate800, s) }
                            .twClickable { isAdd = add; confirming = false }.padding(vertical = 8.dp, horizontal = 4.dp),
                        contentAlignment = Alignment.Center
                    ) { Text(label, style = twText(12, FontWeight.Bold, 16), color = if (on) Color.White else Tw.slate400, textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
                }
            }
        }

        Column {
            AdmLabel("المبلغ بالدولار ($):")
            AdmInput(amountText, { amountText = it; confirming = false }, "0.00", mono = true, keyboardType = KeyboardType.Decimal)
        }
        Column {
            AdmLabel("الرصيد بعد التنفيذ:")
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).padding(8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("النتيجة:", style = twText(12, FontWeight.Bold, 16), color = Tw.slate400, fontFamily = Adm.mono)
                Text(Adm.usd(if (isValidAmount) projected else current), style = twText(12, FontWeight.Bold, 16), fontFamily = Adm.mono,
                    color = if (projected < 0) Adm.rose400 else if (projected > current) Adm.emerald400 else Color.White)
            }
        }
        Column {
            AdmLabel("سبب التعديل (إلزامي للتوثيق والتدقيق):")
            AdmInput(reason, { reason = it; confirming = false }, "مثال: تأكيد إيداع يدوي عبر ويسترن يونيون، مكافأة كاتب متميز، خصم حملة إعلانية...", minLines = 2)
        }

        if (isLarge) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Adm.amber500.copy(alpha = 0.10f)).border(1.dp, Adm.amber500.copy(alpha = 0.3f), RoundedCornerShape(12.dp)).padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top
            ) {
                LuIcon(Lu.AlertTriangle, 16.dp, Adm.amber400, Modifier.padding(top = 2.dp))
                Column {
                    Text("مبلغ كبير (${Adm.usd(amount ?: 0.0)})", style = twText(12, FontWeight.Bold, 16), color = Adm.amber300)
                    Text("يتطلب هذا المبلغ تأكيداً ثنائياً لضمان عدم حدوث خطأ كتابي في الرصيد.", Modifier.padding(top = 2.dp), style = twText(11, FontWeight.Normal, 16), color = Adm.amber300.copy(alpha = 0.8f))
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
            Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Tw.slate800).twClickable { onDismiss() }.padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
                Text("إلغاء", style = twText(12, FontWeight.Bold, 16), color = Tw.slate300)
            }
            Row(
                Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                    .background((if (confirming) Adm.amber600 else brand.s600).copy(alpha = if (canSubmit) 1f else 0.4f))
                    .twClickable(enabled = canSubmit) {
                        if (isLarge && !confirming) { confirming = true } else {
                            viewModel.adjustBalance(user, field.key, delta, reason.trim()); onDismiss()
                        }
                    }.padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
            ) {
                LuIcon(Lu.ShieldCheck, 16.dp, Color.White)
                Text("  " + (if (isLarge && confirming) "تأكيد التعديل النهائي" else "تطبيق التعديل"), style = twText(12, FontWeight.ExtraBold, 16), color = Color.White)
            }
        }
    }
}
