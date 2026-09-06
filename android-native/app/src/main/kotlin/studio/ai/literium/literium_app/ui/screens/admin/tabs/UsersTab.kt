package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.diagnostics.diagnoseTouchTarget
import studio.ai.literium.literium_app.ui.diagnostics.reportIfLowContrast
import studio.ai.literium.literium_app.ui.diagnostics.rememberOverflowReporter
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.screens.admin.components.BalanceAdjustDialog
import studio.ai.literium.literium_app.ui.screens.admin.components.BroadcastDialog
import studio.ai.literium.literium_app.ui.screens.admin.components.KycReviewDialog

private val ROLE_OPTIONS = listOf("reader" to "قارئ", "writer" to "كاتب", "advertiser" to "معلن", "admin" to "مدير")

/**
 * "إدارة المستخدمين والحسابات" — Compose port of `AdminUsersTab.tsx`:
 * search/role/status filters, per-user role change / verified-badge toggle
 * / ban / KYC review / balance adjust / profile preview, plus the
 * mass-broadcast entry point. KYC review and balance adjustment open as
 * dialogs (matching the source's modal pattern), not separate tabs.
 */
@Composable
fun UsersTab(
    viewModel: AdminViewModel,
    users: List<User>,
    currentUser: User,
    onOpenProfile: (String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var roleFilter by remember { mutableStateOf("all") }
    var statusFilter by remember { mutableStateOf("all") }
    var kycTarget by remember { mutableStateOf<User?>(null) }
    var balanceTarget by remember { mutableStateOf<User?>(null) }
    var showBroadcast by remember { mutableStateOf(false) }

    val pendingKycCount = users.count { it.kycDetails?.status == "pending" }

    val filtered = users.filter { u ->
        if (roleFilter != "all" && u.role != roleFilter) return@filter false
        if (statusFilter == "verified" && u.isVerified != true && u.isKycVerified != true) return@filter false
        if (statusFilter == "kyc_pending" && u.kycDetails?.status != "pending") return@filter false
        if (statusFilter == "banned" && u.isBanned != true) return@filter false
        if (searchQuery.isNotBlank()) {
            val q = searchQuery.trim().lowercase()
            val matches = u.fullName.lowercase().contains(q) || u.email.lowercase().contains(q) ||
                u.username.lowercase().contains(q) || u.id.lowercase().contains(q)
            if (!matches) return@filter false
        }
        true
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Text(
                    "إدارة المستخدمين (${users.size})",
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f).padding(end = 8.dp),
                    maxLines = 2,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    onTextLayout = rememberOverflowReporter("رأس تبويب المستخدمين")
                )
                Button(
                    onClick = { showBroadcast = true },
                    modifier = Modifier.diagnoseTouchTarget("زر إرسال تعميم")
                ) {
                    Icon(Icons.Filled.Campaign, contentDescription = null, modifier = Modifier.size(16.dp))
                    Text(" إرسال تعميم", modifier = Modifier.padding(start = 4.dp))
                }
            }
        }
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("البحث بالاسم أو البريد أو المعرّف...") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("all" to "الكل", "admin" to "الإدارة", "writer" to "الكتاب", "advertiser" to "المعلنون", "reader" to "القراء")
                    .forEach { (key, label) ->
                        FilterChip(selected = roleFilter == key, onClick = { roleFilter = key }, label = { Text(label) })
                    }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(
                    "all" to "الحالة: الكل", "verified" to "موثق",
                    "kyc_pending" to "بانتظار KYC ($pendingKycCount)", "banned" to "محظور"
                ).forEach { (key, label) ->
                    FilterChip(selected = statusFilter == key, onClick = { statusFilter = key }, label = { Text(label) })
                }
            }
        }

        if (filtered.isEmpty()) {
            item { EmptyHint("لا يوجد مستخدمون يطابقون شروط البحث الحالية.") }
        } else {
            items(filtered, key = { it.id }) { u -> UserRow(u, currentUser, viewModel, onOpenProfile, { kycTarget = u }, { balanceTarget = u }) }
        }
    }

    kycTarget?.let { u -> KycReviewDialog(viewModel, u) { kycTarget = null } }
    balanceTarget?.let { u -> BalanceAdjustDialog(viewModel, u) { balanceTarget = null } }
    if (showBroadcast) BroadcastDialog(viewModel, users.size) { showBroadcast = false }
}

/**
 * Rounded colored-pill icon toggle matching `AdminUsersTab.tsx`'s verify/ban buttons — a plain
 * default-tint [IconButton] rendered as flat gray/black with no fill at all, which is what made these
 * look "colorless" compared to the web's `bg-blue-500/20`/`bg-rose-500` pills. Inactive state uses a
 * dim outlined pill (`bg-slate-950`/`border-slate-800`) so it still reads as a real button, not just a
 * bare icon.
 */
@Composable
private fun StatusPillIconButton(
    active: Boolean,
    activeContainer: androidx.compose.ui.graphics.Color,
    activeContent: androidx.compose.ui.graphics.Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit
) {
    val inactiveContainer = androidx.compose.ui.graphics.Color(0xFF020617)
    val inactiveContent = androidx.compose.ui.graphics.Color(0xFF94A3B8)
    val inactiveBorder = androidx.compose.ui.graphics.Color(0xFF1E293B)
    val resolvedContainer = if (active) activeContainer else inactiveContainer
    val resolvedContent = if (active) activeContent else inactiveContent
    reportIfLowContrast(
        tag = "زر $contentDescription (${if (active) "مفعّل" else "غير مفعّل"})",
        foreground = resolvedContent,
        background = resolvedContainer
    )
    androidx.compose.material3.Surface(
        onClick = onClick,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
        color = resolvedContainer,
        border = if (active) null else androidx.compose.foundation.BorderStroke(1.dp, inactiveBorder),
        modifier = Modifier.size(36.dp).diagnoseTouchTarget("زر $contentDescription")
    ) {
        Box(Modifier.fillMaxWidth().padding(6.dp), contentAlignment = androidx.compose.ui.Alignment.Center) {
            Icon(
                icon,
                contentDescription = contentDescription,
                tint = if (active) activeContent else inactiveContent,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
private fun UserRow(
    u: User,
    currentUser: User,
    viewModel: AdminViewModel,
    onOpenProfile: (String) -> Unit,
    onOpenKyc: () -> Unit,
    onOpenBalance: () -> Unit
) {
    val isSelf = u.id == currentUser.id
    val isKycPending = u.kycDetails?.status == "pending"
    var roleMenuOpen by remember { mutableStateOf(false) }

    studio.ai.literium.literium_app.ui.theme.DarkCard {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                AsyncImage(
                    model = u.avatarUrl, contentDescription = u.fullName,
                    modifier = Modifier.size(44.dp).clip(CircleShape)
                )
                Column(Modifier.padding(start = 10.dp).weight(1f)) {
                    Text(u.fullName, fontWeight = FontWeight.Bold)
                    Text("@${u.username} • ${u.email}", fontSize = 11.sp, color = studio.ai.literium.literium_app.ui.theme.SlateMuted)
                    Text(
                        "المحفظة: $${"%.2f".format(u.walletBalance ?: 0.0)} • للسحب: $${"%.2f".format(u.availableBalance ?: 0.0)} • مجمّد: $${"%.2f".format(u.pendingEarnings ?: 0.0)}",
                        fontSize = 11.sp, color = studio.ai.literium.literium_app.ui.theme.SlateMuted
                    )
                    if (u.isBanned == true) Text("محظور", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                    if (isKycPending) Text("طلب توثيق KYC جديد ⏳", color = MaterialTheme.colorScheme.tertiary, fontWeight = FontWeight.Bold)
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (!isSelf) {
                    Box {
                        OutlinedButton(onClick = { roleMenuOpen = true }) {
                            Text(ROLE_OPTIONS.firstOrNull { it.first == u.role }?.second ?: u.role)
                        }
                        DropdownMenu(expanded = roleMenuOpen, onDismissRequest = { roleMenuOpen = false }) {
                            ROLE_OPTIONS.forEach { (key, label) ->
                                DropdownMenuItem(text = { Text(label) }, onClick = {
                                    viewModel.setUserRole(u.id, key)
                                    roleMenuOpen = false
                                })
                            }
                        }
                    }
                }
                if (isKycPending) {
                    Button(
                        onClick = onOpenKyc,
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = studio.ai.literium.literium_app.ui.theme.BrandAmber,
                            contentColor = androidx.compose.ui.graphics.Color(0xFF020617)
                        )
                    ) { Text("تدقيق الهوية") }
                }
                OutlinedButton(onClick = onOpenBalance) { Text("تعديل الرصيد") }
                if (!isSelf) {
                    StatusPillIconButton(
                        active = u.isVerified == true,
                        activeContainer = androidx.compose.ui.graphics.Color(0xFF3B82F6).copy(alpha = 0.2f),
                        activeContent = androidx.compose.ui.graphics.Color(0xFF93C5FD),
                        icon = Icons.Filled.CheckCircle,
                        contentDescription = "توثيق",
                        onClick = { viewModel.setUserVerified(u.id, u.isVerified != true) }
                    )
                    StatusPillIconButton(
                        active = u.isBanned == true,
                        activeContainer = androidx.compose.ui.graphics.Color(0xFFF43F5E),
                        activeContent = androidx.compose.ui.graphics.Color.White,
                        icon = Icons.Filled.Block,
                        contentDescription = "حظر",
                        onClick = { viewModel.setUserBanned(u.id, u.isBanned != true) }
                    )
                }
                IconButton(onClick = { onOpenProfile(u.id) }) {
                    Icon(Icons.Filled.Visibility, contentDescription = "معاينة")
                }
            }
        }
    }
}
