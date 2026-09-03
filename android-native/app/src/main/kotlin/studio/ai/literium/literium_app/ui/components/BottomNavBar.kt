package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * Sticky bottom navigation — exact tab-set port of `BottomNav.tsx` (spec §2.1/§2.2), including its
 * hard split between the admin 5-tab bar (finance/campaigns shortcuts instead of explore) and the
 * unified member 5-tab bar shared by every non-admin account regardless of stored `role` (source's
 * own comment on why there is only ONE non-admin bar, not three role-specific ones, is preserved
 * verbatim in [BottomNavBar]'s member branch below).
 *
 * `AdminOverviewTab`/`AdminFinanceTab`/etc. are all sub-tabs of one embedded admin dashboard in the
 * web source (spec §1.3a/§4.20+); this Kotlin app instead models [Screen.Admin] as its own
 * top-level destination (see `navigation/Screen.kt`, out of this scope's reach), so the admin bar's
 * finance/campaigns buttons both navigate to that one screen — a structural adaptation to the real
 * nav graph, not a missing feature; which internal admin tab opens is that screen's own concern.
 */
@Composable
fun BottomNavBar(
    currentRoute: String?,
    isAdmin: Boolean,
    isGuest: Boolean,
    currentUser: User?,
    unreadNotifications: Int,
    unreadMessages: Int,
    onNavigate: (String) -> Unit,
    onOpenMessages: () -> Unit,
    onOpenProfile: () -> Unit
) {
    // اللون هنا مثبَّت صراحةً على نفس `colorScheme.surface` المستخدم في السطح الجذري بـ
    // `MainActivity` (`Surface(...)` بلا لون صريح = افتراضي `colorScheme.surface`)، بدل الاعتماد
    // على لون `NavigationBar` الافتراضي (`surfaceContainer` — درجة تدرّج مختلفة تماماً في نظام
    // الألوان الطبقي لـ Material 3). التفاوت الطفيف بين الدرجتين كان يُرسَم كخط أبيض رفيع فوق
    // الشريط السفلي مباشرة (بلاغ مستخدم حقيقي متكرر) لأن أي فراغ بين آخر بطاقة في المحتوى وحافة
    // الشريط يكشف لون السطح الجذري، وهو يختلف بصرياً عن لون الشريط نفسه.
    val navBarColor = MaterialTheme.colorScheme.surface

    if (isAdmin) {
        NavigationBar(containerColor = navBarColor) {
            NavigationBarItem(
                selected = currentRoute == Screen.Feed.route,
                onClick = { onNavigate(Screen.Feed.route) },
                icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                label = { Text("الرئيسية") },
                colors = tealNavColors()
            )
            NavigationBarItem(
                selected = currentRoute == Screen.Admin.route,
                onClick = { onNavigate(Screen.Admin.route) },
                icon = { Icon(Icons.Filled.AttachMoney, contentDescription = null) },
                label = { Text("المالية") },
                colors = amberNavColors()
            )
            NavigationBarItem(
                selected = currentRoute == Screen.Admin.route,
                onClick = { onNavigate(Screen.Admin.route) },
                icon = { Icon(Icons.Filled.Campaign, contentDescription = null) },
                label = { Text("الإعلانات") },
                colors = cyanNavColors()
            )
            NavigationBarItem(
                selected = currentRoute == Screen.Messages.route,
                onClick = onOpenMessages,
                icon = {
                    BadgedNavIcon(Icons.Filled.Mail, unreadMessages)
                },
                label = { Text("رسائل") },
                colors = tealNavColors()
            )
            NavigationBarItem(
                selected = currentRoute == Screen.Profile.route,
                onClick = onOpenProfile,
                icon = { ProfileNavIcon(currentUser) },
                label = { Text("ملفي") },
                colors = tealNavColors()
            )
        }
        return
    }

    // شريط الأعضاء الموحّد: زائر أو أي عضو مسجَّل، بغضّ النظر عن دوره المخزَّن —
    // الرئيسية · استكشاف · إشعارات · رسائل · ملفي. لا فرع حسب role هنا إطلاقاً
    // (نفس ملاحظة BottomNav.tsx الأصلية: التفرّع القديم كان يعرض تنقّلاً أقل
    // محتوى لبعض الأدوار رغم تساوي صلاحياتها الفعلية بالكامل في النموذج الموحّد).
    NavigationBar(containerColor = navBarColor) {
        NavigationBarItem(
            selected = currentRoute == Screen.Feed.route,
            onClick = { onNavigate(Screen.Feed.route) },
            icon = { Icon(Icons.Filled.Home, contentDescription = null) },
            label = { Text("الرئيسية") },
            colors = tealNavColors()
        )
        NavigationBarItem(
            selected = currentRoute == Screen.Explore.route,
            onClick = { onNavigate(Screen.Explore.route) },
            icon = { Icon(Icons.Filled.Explore, contentDescription = null) },
            label = { Text("استكشاف") },
            colors = tealNavColors()
        )
        NavigationBarItem(
            selected = currentRoute == Screen.Notifications.route,
            onClick = { onNavigate(Screen.Notifications.route) },
            icon = { BadgedNavIcon(Icons.Filled.Notifications, unreadNotifications) },
            label = { Text("إشعارات") },
            colors = tealNavColors()
        )
        NavigationBarItem(
            selected = currentRoute == Screen.Messages.route,
            onClick = { if (!isGuest) onOpenMessages() },
            enabled = !isGuest,
            icon = { BadgedNavIcon(Icons.Filled.Mail, unreadMessages) },
            label = { Text(if (isGuest) "يلزم التسجيل" else "رسائل") },
            colors = tealNavColors()
        )
        NavigationBarItem(
            selected = currentRoute == Screen.Profile.route,
            onClick = onOpenProfile,
            icon = { ProfileNavIcon(currentUser) },
            label = { Text("ملفي") },
            colors = tealNavColors()
        )
    }
}

@Composable
private fun BadgedNavIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, unreadCount: Int) {
    if (unreadCount > 0) {
        BadgedBox(badge = {
            Badge(containerColor = Color(0xFFF43F5E)) {
                Text(if (unreadCount > 9) "9+" else unreadCount.toString())
            }
        }) {
            Icon(icon, contentDescription = null)
        }
    } else {
        Icon(icon, contentDescription = null)
    }
}

@Composable
private fun ProfileNavIcon(currentUser: User?) {
    val avatarUrl = currentUser?.avatarUrl
    if (!avatarUrl.isNullOrBlank()) {
        AsyncImage(
            model = avatarUrl,
            contentDescription = null,
            modifier = Modifier.size(22.dp)
        )
    } else {
        Icon(Icons.Filled.Person, contentDescription = null)
    }
}

@Composable
private fun tealNavColors() = NavigationBarItemDefaults.colors(
    selectedIconColor = BrandTeal,
    selectedTextColor = BrandTeal,
    indicatorColor = BrandTeal.copy(alpha = 0.12f)
)

@Composable
private fun amberNavColors() = NavigationBarItemDefaults.colors(
    selectedIconColor = BrandAmber,
    selectedTextColor = BrandAmber,
    indicatorColor = BrandAmber.copy(alpha = 0.15f)
)

@Composable
private fun cyanNavColors() = NavigationBarItemDefaults.colors(
    selectedIconColor = Color(0xFF0891B2),
    selectedTextColor = Color(0xFF0891B2),
    indicatorColor = Color(0xFF0891B2).copy(alpha = 0.12f)
)
