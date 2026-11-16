package studio.ai.literium.literium_app.ui.screens.admin.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.screens.admin.tabs.Adm
import studio.ai.literium.literium_app.ui.screens.admin.tabs.AdmDialog
import studio.ai.literium.literium_app.ui.screens.admin.tabs.AdmInput
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/** "رسالة تعميم جماعية" — نموذج التعميم في AdminUsersTab.tsx (isBroadcastOpen). */
@Composable
fun BroadcastDialog(viewModel: AdminViewModel, recipientCount: Int, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf("") }
    var sentMessage by remember { mutableStateOf<String?>(null) }
    val s12 = RoundedCornerShape(12.dp)

    AdmDialog(onDismiss) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                LuIcon(Lu.Megaphone, 16.dp, brand.s400)
                Text("رسالة تعميم جماعية إلى $recipientCount مستخدم", style = twText(12, FontWeight.Bold, 16), color = Color.White)
            }
            Text("إغلاق", Modifier.twClickable { onDismiss() }, style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
        }
        if (sentMessage != null) {
            Text(sentMessage!!, Modifier.fillMaxWidth().clip(s12).background(Adm.emerald500.copy(alpha = 0.2f)).padding(16.dp),
                style = twText(12, FontWeight.Bold, 16), color = Color(0xFF6EE7B7), textAlign = TextAlign.Center)
        } else {
            AdmInput(text, { text = it }, "اكتب نص الرسالة الرسمية من إدارة المنصة...", minLines = 2)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                val en = text.isNotBlank()
                Row(
                    Modifier.clip(s12).background(brand.s600.copy(alpha = if (en) 1f else 0.4f)).twClickable(enabled = en) {
                        viewModel.broadcastMessage(text.trim()) { sent, failed ->
                            sentMessage = "تم الإرسال إلى $sent مستخدم" + if (failed > 0) " (فشل $failed)" else ""
                        }
                    }.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    LuIcon(Lu.Send, 14.dp, Color.White)
                    Text("إرسال التعميم الآن", style = twText(12, FontWeight.Bold, 16), color = Color.White)
                }
            }
        }
    }
}
