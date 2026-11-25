package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.screens.admin.components.BalanceAdjustDialog
import studio.ai.literium.literium_app.ui.screens.admin.components.BroadcastDialog
import studio.ai.literium.literium_app.ui.screens.admin.components.KycReviewDialog
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

private val ROLE_OPTIONS = listOf("reader" to "قارئ", "writer" to "كاتب", "advertiser" to "معلن", "admin" to "مدير / Admin")

/** "إدارة المستخدمين والحسابات" — ترجمة حرفية لـ AdminUsersTab.tsx. */
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
    val q = searchQuery.trim().lowercase()
    val filtered = users.filter { u ->
        if (roleFilter != "all" && u.role != roleFilter) return@filter false
        if (statusFilter == "verified" && u.isVerified != true && u.isKycVerified != true) return@filter false
        if (statusFilter == "kyc_pending" && u.kycDetails?.status != "pending") return@filter false
        if (statusFilter == "banned" && u.isBanned != true) return@filter false
        if (q.isNotEmpty() && !(u.fullName.lowercase().contains(q) || u.email.lowercase().contains(q) || u.username.lowercase().contains(q) || u.id.lowercase().contains(q))) return@filter false
        true
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        AdmCard(bg = Tw.slate900.copy(alpha = 0.9f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.Users, 20.dp, brand.s400)
                Text("إدارة المستخدمين والحسابات", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text("التحكم في الرتب، توثيق الهوية KYC، تعديل الأرصدة، وإرسال التعميمات الجماعية.", Modifier.padding(top = 2.dp, bottom = 16.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            AdmButton("إرسال تعميم لجميع المستخدمين", { showBroadcast = true }, brand.s600, icon = Lu.Megaphone, size = 12, modifier = Modifier)
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            AdmSearch(searchQuery, { searchQuery = it }, "البحث بالاسم، المعرف (@)، البريد الإلكتروني أو ID...")
            AdmSegment(listOf("all" to "الكل", "admin" to "الإدارة", "writer" to "الكتاب", "advertiser" to "المعلنون", "reader" to "القراء"), roleFilter, brand.s600) { roleFilter = it }
            AdmSegment(
                listOf("all" to "الحالة: الكل", "verified" to "موثق", "kyc_pending" to "بانتظار KYC ($pendingKycCount)", "banned" to "محظور"),
                statusFilter, Color(0xFF2563EB)
            ) { statusFilter = it }
        }

        if (filtered.isEmpty()) {
            AdmEmpty("لا يوجد مستخدمون يطابقون شروط البحث الحالية.")
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                filtered.forEach { u -> UserRow(u, currentUser, viewModel, onOpenProfile, { kycTarget = u }, { balanceTarget = u }) }
            }
        }
    }

    kycTarget?.let { u -> KycReviewDialog(viewModel, u) { kycTarget = null } }
    balanceTarget?.let { u -> BalanceAdjustDialog(viewModel, u) { balanceTarget = null } }
    if (showBroadcast) BroadcastDialog(viewModel, users.size) { showBroadcast = false }
}

@Composable
private fun IconPill(icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, activeBg: Color, activeFg: Color, activeBorder: Color?, onClick: () -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Box(
        Modifier.clip(s).background(if (active) activeBg else Tw.slate950)
            .border(1.dp, if (active) (activeBorder ?: Color.Transparent) else Tw.slate800, s)
            .twClickable { onClick() }.padding(6.dp),
        contentAlignment = Alignment.Center
    ) { LuIcon(icon, 16.dp, if (active) activeFg else Tw.slate400) }
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
    val kycPending = u.kycDetails?.status == "pending"
    val banned = u.isBanned == true
    var roleMenu by remember { mutableStateOf(false) }

    AdmCard(
        bg = if (banned) Color(0xFF4C0519).copy(alpha = 0.10f) else if (kycPending) Color(0xFF451A03).copy(alpha = 0.10f) else Tw.slate900,
        border = if (banned) Adm.rose500.copy(alpha = 0.4f) else if (kycPending) Adm.amber500.copy(alpha = 0.4f) else Tw.slate800
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(u.avatarUrl, u.fullName, Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).border(1.dp, Tw.slate800, RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                AdmFlow {
                    Text(u.fullName, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (u.isVerified == true) LuIcon(Lu.CheckCircle2, 16.dp, Adm.blue400)
                    if (u.isKycVerified == true) LuIcon(Lu.ShieldCheck, 16.dp, Adm.emerald400)
                    if (banned) AdmBadge("محظور", Color.White, Adm.rose500, null, mono = false)
                    if (kycPending) AdmBadge("طلب توثيق KYC جديد ⏳", Tw.slate950, Adm.amber500, null, mono = false)
                }
                Text("@${u.username} • ${u.email}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400, fontFamily = Adm.mono, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("المحفظة: ${Adm.usd(u.walletBalance ?: 0.0)} • متاح للسحب: ${Adm.usd(u.availableBalance ?: 0.0)} • أرباح مجمّدة: ${Adm.usd(u.pendingEarnings ?: 0.0)}",
                    Modifier.padding(top = 2.dp), style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
            }
        }
        AdmFlow {
            if (!isSelf) {
                Box {
                    Row(
                        Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp))
                            .twClickable { roleMenu = true }.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(ROLE_OPTIONS.firstOrNull { it.first == u.role }?.second ?: u.role, style = twText(12, FontWeight.Bold, 16), color = Tw.slate300)
                        LuIcon(Lu.ChevronDown, 14.dp, Tw.slate400)
                    }
                    DropdownMenu(expanded = roleMenu, onDismissRequest = { roleMenu = false }) {
                        ROLE_OPTIONS.forEach { (key, label) ->
                            DropdownMenuItem(text = { Text(label) }, onClick = { viewModel.setUserRole(u.id, key); roleMenu = false })
                        }
                    }
                }
            }
            if (kycPending) AdmButton("تدقيق الهوية", onOpenKyc, Adm.amber500, Tw.slate950, icon = Lu.UserCheck)
            AdmButton("تعديل الرصيد", onOpenBalance, Adm.emerald600.copy(alpha = 0.2f), Color(0xFF6EE7B7), Adm.emerald500.copy(alpha = 0.3f), Lu.DollarSign)
            if (!isSelf) {
                IconPill(Lu.CheckCircle2, u.isVerified == true, Adm.blue500.copy(alpha = 0.2f), Adm.blue300, Adm.blue500.copy(alpha = 0.3f)) { viewModel.setUserVerified(u.id, u.isVerified != true) }
                IconPill(Lu.Ban, banned, Adm.rose500, Color.White, Adm.rose500) { viewModel.setUserBanned(u.id, !banned) }
            }
            IconPill(Lu.Eye, false, Color.Transparent, Color.Transparent, null) { onOpenProfile(u.id) }
        }
    }
}
