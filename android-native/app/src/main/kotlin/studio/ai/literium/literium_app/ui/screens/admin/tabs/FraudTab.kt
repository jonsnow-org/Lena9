package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.data.model.FraudFlag
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel

/**
 * "مركز مكافحة الاحتيال والأمان" — Compose port of `AdminFraudTab.tsx`.
 * Resolve/dismiss goes through [AdCampaignRepository.resolveFraudFlag];
 * ban goes through [AdminRepository.setUserBanned], both plain client
 * Firestore writes.
 */
@Composable
fun FraudTab(
    viewModel: AdminViewModel,
    fraudFlags: List<FraudFlag>,
    users: List<User>,
    totalBlockedFraudRevenue: Double
) {
    var severityFilter by remember { mutableStateOf("all") }

    val filtered = fraudFlags.filter { severityFilter == "all" || it.severity == severityFilter }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text(
                "مركز مكافحة الاحتيال والأمان — الأموال المحمية: $${"%.2f".format(totalBlockedFraudRevenue)}",
                fontWeight = FontWeight.Bold
            )
        }
        item {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(
                    listOf(
                        "إجمالي المحاولات المرصودة" to fraudFlags.size,
                        "عالية الخطورة" to fraudFlags.count { it.severity == "high" || it.severity == "critical" },
                        "بانتظار المراجعة" to fraudFlags.count { it.status == "flagged" || it.status == "auto_blocked" },
                        "تمت المراجعة" to fraudFlags.count { it.status == "reviewed" }
                    )
                ) { (label, value) ->
                    Card {
                        Column(Modifier.padding(12.dp)) {
                            Text(label, style = MaterialTheme.typography.labelSmall)
                            Text(value.toString(), fontSize = 18.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("all" to "الكل", "critical" to "حرجة", "high" to "عالية", "medium" to "متوسطة", "low" to "منخفضة")
                    .forEach { (key, label) -> FilterChip(selected = severityFilter == key, onClick = { severityFilter = key }, label = { Text(label) }) }
            }
        }

        if (filtered.isEmpty()) {
            item { EmptyHint("لا توجد سجلات احتيال تطابق هذا الفلتر حالياً.") }
        } else {
            items(filtered, key = { it.id }) { flag ->
                val suspect = flag.userId?.let { id -> users.find { it.id == id } }
                Card {
                    Column(Modifier.padding(12.dp)) {
                        Text(flag.details, fontWeight = FontWeight.Bold)
                        Text("IP: ${flag.userIp} • ${flag.detectedAt}", style = MaterialTheme.typography.labelSmall)
                        suspect?.let { Text("المشتبه به: ${it.fullName} (@${it.username})", style = MaterialTheme.typography.labelSmall) }
                        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (flag.status != "reviewed") {
                                Button(onClick = { viewModel.resolveFraudFlag(flag.id, "resolved") }) { Text("تأكيد الحجب") }
                                OutlinedButton(onClick = { viewModel.resolveFraudFlag(flag.id, "dismissed") }) { Text("تجاهل") }
                            }
                            if (suspect != null && suspect.isBanned != true) {
                                OutlinedButton(onClick = { viewModel.setUserBanned(suspect.id, true) }) { Text("حظر الحساب") }
                            }
                        }
                    }
                }
            }
        }
    }
}
