package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import studio.ai.literium.literium_app.data.model.FraudFlag
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.twText

/** "مركز مكافحة الاحتيال والأمان" — ترجمة حرفية لـ AdminFraudTab.tsx. */
@Composable
fun FraudTab(
    viewModel: AdminViewModel,
    fraudFlags: List<FraudFlag>,
    users: List<User>,
    totalBlockedFraudRevenue: Double
) {
    var severityFilter by remember { mutableStateOf("all") }
    var searchQuery by remember { mutableStateOf("") }
    val q = searchQuery.trim().lowercase()
    val filtered = fraudFlags.filter { f ->
        if (severityFilter != "all" && f.severity != severityFilter) return@filter false
        if (q.isNotEmpty()) {
            val ok = f.userIp.lowercase().contains(q) || f.details.lowercase().contains(q) || (f.userId?.lowercase()?.contains(q) == true)
            if (!ok) return@filter false
        }
        true
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        AdmCard(bg = Tw.slate900.copy(alpha = 0.9f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.ShieldAlert, 20.dp, Adm.amber400)
                Text("مركز مكافحة الاحتيال والأمان (Anti-Fraud SOC)", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text("الرصد الفوري للنقر الذاتي، البوتات، وحماية ميزانيات المعلنين وأرباح المنصة.", Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            Row(
                Modifier.padding(top = 16.dp).clip(RoundedCornerShape(12.dp)).background(Adm.amber500.copy(alpha = 0.1f))
                    .border(1.dp, Adm.amber500.copy(alpha = 0.3f), RoundedCornerShape(12.dp)).padding(8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                LuIcon(Lu.ShieldCheck, 16.dp, Adm.amber400)
                Text("الأموال المحمية:", style = twText(12, FontWeight.Normal, 16), color = Tw.slate300)
                Text(Adm.usd(totalBlockedFraudRevenue), style = twText(12, FontWeight.Bold, 16), color = Adm.amber400, fontFamily = Adm.mono)
            }
        }

        AdmStatGrid(listOf(
            { m -> AdmStat(fraudFlags.size.toString(), "إجمالي المحاولات المرصودة", Color.White, Tw.slate800, m) },
            { m -> AdmStat(fraudFlags.count { it.severity == "high" || it.severity == "critical" }.toString(), "عالية الخطورة (حرجة)", Adm.rose400, Adm.rose500.copy(alpha = 0.3f), m) },
            { m -> AdmStat(fraudFlags.count { it.status == "flagged" || it.status == "auto_blocked" }.toString(), "بانتظار المراجعة", Adm.amber400, Adm.amber500.copy(alpha = 0.3f), m) },
            { m -> AdmStat(fraudFlags.count { it.status == "reviewed" }.toString(), "تمت المراجعة والتحييد", Adm.emerald400, Adm.emerald500.copy(alpha = 0.3f), m) }
        ))

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            AdmSearch(searchQuery, { searchQuery = it }, "البحث في عنوان IP، المعرف، أو تفاصيل الإنذار...")
            AdmSegment(
                listOf("all" to "الخطورة: الكل", "critical" to "حرجة", "high" to "عالية", "medium" to "متوسطة", "low" to "منخفضة"),
                severityFilter, Adm.amber600
            ) { severityFilter = it }
        }

        if (filtered.isEmpty()) {
            AdmEmpty("لا توجد سجلات احتيال تطابق هذا الفلتر حالياً.")
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                filtered.forEach { flag ->
                    val suspect = flag.userId?.let { id -> users.find { it.id == id } }
                    val resolved = flag.status == "reviewed"
                    val high = flag.severity == "critical" || flag.severity == "high"
                    AdmCard {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            AdmFlow {
                                AdmBadge(flag.severity.uppercase(), if (high) Adm.rose300 else Adm.amber300,
                                    (if (high) Adm.rose500 else Adm.amber500).copy(alpha = 0.2f), (if (high) Adm.rose500 else Adm.amber500).copy(alpha = 0.3f))
                                Text(flag.details, style = twText(14, FontWeight.Bold, 20), color = Color.White)
                            }
                            Text(
                                "IP: ${flag.userIp} • الموقع: ${flag.articleId ?: flag.campaignId ?: "عام"} • ${flag.detectedAt}",
                                style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = Adm.mono
                            )
                            if (suspect != null) {
                                Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("المستخدم المشتبه به:", style = twText(12, FontWeight.Normal, 16), color = Adm.amber300)
                                    Text(suspect.fullName, style = twText(12, FontWeight.Bold, 16), color = Adm.amber300)
                                    Text("(@${suspect.username})", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = Adm.mono)
                                }
                            }
                        }
                        AdmFlow {
                            if (!resolved) {
                                AdmButton("تأكيد الحجب والمراجعة", { viewModel.resolveFraudFlag(flag.id, "resolved") }, Adm.emerald600, icon = Lu.CheckCircle2)
                                AdmButton("تجاهل الإنذار", { viewModel.resolveFraudFlag(flag.id, "dismissed") }, Tw.slate800, Tw.slate400)
                            }
                            if (suspect != null && suspect.isBanned != true) {
                                AdmButton("حظر الحساب", { viewModel.setUserBanned(suspect.id, true) }, Adm.rose600.copy(alpha = 0.2f), Adm.rose300, Adm.rose500.copy(alpha = 0.3f), Lu.Ban)
                            }
                        }
                    }
                }
            }
        }
    }
}
