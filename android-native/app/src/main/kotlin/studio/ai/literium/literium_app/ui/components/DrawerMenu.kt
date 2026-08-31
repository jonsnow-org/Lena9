package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Balance
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * Slide-in drawer content — port of `DrawerMenu.tsx` (spec §2.1), opened from [TopHeaderBar]'s
 * hamburger button and hosted by [MainScaffold]'s `ModalNavigationDrawer`.
 *
 * Two intentionally simplified spots vs. source, both documented in this scope's final report
 * rather than silently guessed at:
 * - **Member-status label**: source computes "✍️ كاتب شريك ومعتمد" vs "📖 قارئ مسجل" from full
 *   monetization eligibility (spec §1.3a/§12.4 — needs the user's articles + real follower count).
 *   Fetching that just to label a drawer header is unreasonable shell-level work, so this always
 *   shows the safe "📖 قارئ مسجل" default for non-admin/advertiser accounts until the eligibility
 *   figure is actually computed (e.g. by the profile screen, which needs that data anyway).
 * - **Theme/language toggles**: `DrawerMenu.tsx`'s real theme (light/dark) and language switcher
 *   are wired to app-wide state (`App.tsx`) this scope doesn't own (no persisted theme/i18n
 *   controller exists yet in the Kotlin app — [studio.ai.literium.literium_app.ui.theme.LiteriumTheme]
 *   still only reads `isSystemInDarkTheme()`, and no `translations.kt` port exists). The controls
 *   are rendered for visual/IA parity but are session-local, non-persisted stand-ins.
 */
@Composable
fun DrawerMenuContent(
    currentUser: User?,
    isGuestOrSignedOut: Boolean,
    isAdmin: Boolean,
    onClose: () -> Unit,
    onNavigate: (String) -> Unit,
    onOpenProfile: () -> Unit,
    onLogin: () -> Unit,
    onLogout: () -> Unit
) {
    var showLogoutConfirm by remember { mutableStateOf(false) }
    var isDarkPreview by remember { mutableStateOf(false) }
    var selectedLang by remember { mutableStateOf("ar") }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(16.dp)
                .clickable(enabled = !isGuestOrSignedOut) { onOpenProfile(); onClose() },
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!isGuestOrSignedOut && currentUser?.avatarUrl?.isNotBlank() == true) {
                AsyncImage(
                    model = currentUser?.avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp).background(BrandTeal.copy(alpha = 0.15f), RoundedCornerShape(14.dp))
                )
            } else {
                Box(
                    modifier = Modifier.size(48.dp).background(BrandTeal.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Person, contentDescription = null, tint = BrandTeal)
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f, fill = false)) {
                if (isGuestOrSignedOut) {
                    Text("زائر (بدون تسجيل دخول)", fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                    Text("أنت تتصفح حالياً", fontSize = 10.5.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            currentUser?.fullName?.takeIf { it.isNotBlank() } ?: currentUser?.username ?: "",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 14.sp
                        )
                        if (currentUser?.isVerified == true) {
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.Filled.Verified, contentDescription = null, tint = Color(0xFF3B82F6), modifier = Modifier.size(13.dp))
                        }
                    }
                    Text(memberStatusLabel(currentUser), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
                }
            }
            IconButton(onClick = onClose) {
                Icon(Icons.Filled.Close, contentDescription = "إغلاق")
            }
        }

        Column(modifier = Modifier.padding(12.dp)) {
            if (!isGuestOrSignedOut) {
                if (!isAdmin) {
                    DrawerRow(
                        icon = Icons.Filled.Campaign,
                        iconTint = Color(0xFF06B6D4),
                        label = "إنشاء إعلان وترويج"
                    ) { onNavigate(Screen.AdvertiserDashboard.route); onClose() }
                }
                DrawerRow(
                    icon = Icons.Filled.AccountBalanceWallet,
                    iconTint = Color(0xFF10B981),
                    label = "المحفظة والأرباح",
                    trailing = "$${"%.2f".format(currentUser?.walletBalance ?: 0.0)}"
                ) { onNavigate(Screen.Wallet.route); onClose() }

                if (isAdmin) {
                    DrawerRow(
                        icon = Icons.Filled.People,
                        iconTint = Color(0xFF3B82F6),
                        label = "إدارة المستخدمين"
                    ) { onNavigate(Screen.Admin.route); onClose() }
                } else {
                    DrawerRow(
                        icon = Icons.Filled.Verified,
                        iconTint = Color(0xFF3B82F6),
                        label = "توثيق الهوية (KYC)",
                        trailing = if (currentUser?.isKycVerified == true) "معتمد ✓" else null
                    ) { onNavigate(Screen.Kyc.route); onClose() }
                }

                DrawerRow(
                    icon = Icons.Filled.Balance,
                    iconTint = MaterialTheme.colorScheme.onSurfaceVariant,
                    label = "السياسات والشروط ومكافحة الاحتيال"
                ) { onNavigate(Screen.Policies.of("privacy")); onClose() }

                DrawerRow(
                    icon = Icons.Filled.AutoAwesome,
                    iconTint = Color(0xFF06B6D4),
                    label = "استوديو توليد الصور (Gemini)"
                ) { onNavigate(Screen.ImageStudio.route); onClose() }
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(8.dp))

            // Theme toggle — session-local visual stand-in only, see file KDoc.
            DrawerRow(
                icon = if (isDarkPreview) Icons.Filled.DarkMode else Icons.Filled.LightMode,
                iconTint = if (isDarkPreview) BrandTeal else Color(0xFFF59E0B),
                label = "المظهر: ${if (isDarkPreview) "داكن" else "فاتح"}",
                trailing = "تبديل"
            ) { isDarkPreview = !isDarkPreview }

            // Language switcher — session-local visual stand-in only, see file KDoc.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf("ar" to "AR", "en" to "EN", "fr" to "FR", "es" to "ES", "zh" to "中文").forEach { (code, label) ->
                    val selected = selectedLang == code
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(if (selected) Color(0xFF0891B2) else MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp))
                            .clickable { selectedLang = code }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(8.dp))

            if (isGuestOrSignedOut) {
                DrawerActionButton(
                    label = "تسجيل الدخول / إنشاء حساب",
                    icon = Icons.Filled.Login,
                    containerColor = BrandTeal
                ) { onClose(); onLogin() }
            } else if (showLogoutConfirm) {
                Text("هل تريد تسجيل الخروج؟", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DrawerActionButton(label = "تسجيل الخروج", icon = Icons.Filled.Logout, containerColor = Color(0xFFDC2626), modifier = Modifier.weight(1f)) {
                        onLogout(); onClose()
                    }
                    DrawerActionButton(label = "إلغاء", icon = null, containerColor = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.weight(1f)) {
                        showLogoutConfirm = false
                    }
                }
            } else {
                DrawerActionButton(
                    label = "تسجيل الخروج",
                    icon = Icons.Filled.Logout,
                    containerColor = Color(0xFFDC2626).copy(alpha = 0.12f),
                    contentColor = Color(0xFFDC2626)
                ) { showLogoutConfirm = true }
            }
        }
    }
}

@Composable
private fun DrawerRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    label: String,
    trailing: String? = null,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        if (trailing != null) {
            Text(trailing, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = BrandTeal)
        }
    }
}

@Composable
private fun DrawerActionButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector?,
    containerColor: Color,
    contentColor: Color = Color.White,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(containerColor, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = contentColor, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
        }
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = contentColor)
    }
}

/** Mirrors `DrawerMenu.tsx`'s `getRoleLabel` — see this file's KDoc for the documented
 *  member-status simplification (always the safe "قارئ مسجل" default for writer/reader). */
private fun memberStatusLabel(user: User?): String {
    if (user == null) return "📖 قارئ مسجل"
    return when (user.role) {
        UserRole.ADMIN -> "👑 مالك المنصة (Admin)"
        UserRole.ADVERTISER -> "📢 معلن وشريك أعمال"
        else -> "📖 قارئ مسجل"
    }
}
