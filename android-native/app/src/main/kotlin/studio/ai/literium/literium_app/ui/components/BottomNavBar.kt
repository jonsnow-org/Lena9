package studio.ai.literium.literium_app.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.CairoFamily
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable

/**
 * الشريط السفلي — نسخة طبق الأصل من BottomNav.tsx: ارتفاع h-16 (64dp)، max-w-lg، px-3، خمس أزرار
 * flex-1 (أيقونة 20dp داخل p-1.5 rounded-xl، والمفعّل بخلفية brand-50 وإطار brand-200 وتكبير 1.05،
 * ونص 10px bold ⇒ extrabold للمفعّل). شريط الأدمن: رئيسية/مالية/إعلانات/رسائل/ملفي. الأعضاء:
 * رئيسية/استكشاف/إشعارات/رسائل/ملفي (رسائل معطّلة للزائر).
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
    val dark = isDark
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (dark) Tw.slate950.copy(alpha = 0.98f) else Tw.white.copy(alpha = 0.98f))
    ) {
        Box(
            Modifier.fillMaxWidth().height(1.dp)
                .background(if (dark) brand.s500.copy(alpha = 0.20f) else Tw.slate200.copy(alpha = 0.90f))
        )
        Box(Modifier.fillMaxWidth().navigationBarsPadding(), contentAlignment = Alignment.TopCenter) {
            Row(
                modifier = Modifier.widthIn(max = 512.dp).fillMaxWidth().height(64.dp).padding(horizontal = if (isAdmin) 8.dp else 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                if (isAdmin) {
                    NavItem("الرئيسية", Lu.Home, currentRoute == Screen.Feed.route, NavTone.Brand) { onNavigate(Screen.Feed.route) }
                    NavItem("المالية", Lu.DollarSign, currentRoute == Screen.Admin.route, NavTone.Amber) { onNavigate(Screen.Admin.route) }
                    NavItem("الإعلانات", Lu.Megaphone, false, NavTone.Cyan) { onNavigate(Screen.Admin.route) }
                    NavItem("رسائل", Lu.MessageSquare, currentRoute == Screen.Messages.route, NavTone.Brand,
                        badge = unreadMessages, badgeColor = Tw.rose500, badgeCapNine = true, onClick = onOpenMessages)
                    NavItem("ملفي", Lu.User, currentRoute == Screen.Profile.route, NavTone.Brand,
                        avatarUrl = currentUser?.avatarUrl, onClick = onOpenProfile)
                } else {
                    NavItem("الرئيسية", Lu.Home, currentRoute == Screen.Feed.route, NavTone.Brand) { onNavigate(Screen.Feed.route) }
                    NavItem("استكشاف", Lu.Compass, currentRoute == Screen.Explore.route, NavTone.Brand) { onNavigate(Screen.Explore.route) }
                    NavItem("إشعارات", Lu.Bell, currentRoute == Screen.Notifications.route, NavTone.Brand,
                        badge = unreadNotifications, badgeColor = brand.s500, badgeCapNine = true) { onNavigate(Screen.Notifications.route) }
                    NavItem(if (isGuest) "يلزم التسجيل" else "رسائل", Lu.MessageSquare, currentRoute == Screen.Messages.route, NavTone.Brand,
                        badge = if (isGuest) 0 else unreadMessages, badgeColor = Tw.teal600, enabled = !isGuest, onClick = onOpenMessages)
                    NavItem("ملفي", Lu.User, currentRoute == Screen.Profile.route, NavTone.Brand,
                        avatarUrl = currentUser?.avatarUrl, onClick = onOpenProfile)
                }
            }
        }
    }
}

private enum class NavTone { Brand, Amber, Cyan }

@Composable
private fun RowScope.NavItem(
    label: String,
    icon: ImageVector,
    active: Boolean,
    tone: NavTone,
    badge: Int = 0,
    badgeColor: Color = Tw.rose500,
    badgeCapNine: Boolean = false,
    enabled: Boolean = true,
    avatarUrl: String? = null,
    onClick: () -> Unit
) {
    val dark = isDark
    // ألوان الحالة المفعّلة: bg / text / border (فاتح ثم داكن) حسب النغمة
    val activeBg: Color; val activeFg: Color; val activeBorder: Color
    when (tone) {
        NavTone.Brand -> {
            activeBg = if (dark) brand.s600.copy(alpha = 0.30f) else brand.s50
            activeFg = if (dark) brand.s300 else brand.s700
            activeBorder = if (dark) brand.s500.copy(alpha = 0.40f) else brand.s200
        }
        NavTone.Amber -> {
            activeBg = if (dark) Tw.amber600.copy(alpha = 0.30f) else Tw.amber50
            activeFg = if (dark) Tw.amber300 else Tw.amber700
            activeBorder = if (dark) Tw.amber500.copy(alpha = 0.40f) else Tw.amber300
        }
        NavTone.Cyan -> {
            activeBg = if (dark) Tw.cyan600.copy(alpha = 0.30f) else Tw.cyan50
            activeFg = if (dark) Tw.cyan300 else Tw.cyan700
            activeBorder = if (dark) Tw.cyan600.copy(alpha = 0.40f) else Tw.cyan300
        }
    }
    val idleFg = if (dark) Tw.slate400 else Tw.slate500
    val scale by animateFloatAsState(if (active) 1.05f else 1f, tween(150), label = "navScale")
    val shape = RoundedCornerShape(12.dp)

    Column(
        modifier = Modifier
            .weight(1f)
            .alpha(if (enabled) 1f else 0.5f)
            .twClickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box {
            Box(
                modifier = Modifier
                    .graphicsLayer { scaleX = scale; scaleY = scale }
                    .clip(shape)
                    .then(if (active) Modifier.background(activeBg).border(1.dp, activeBorder, shape) else Modifier)
                    // p-1.5 = 6dp (+1dp الإطار للمفعّل كما يضيفه border-box في الويب)
                    .padding(if (active) 6.dp else 7.dp),
                contentAlignment = Alignment.Center
            ) {
                if (!avatarUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = avatarUrl, contentDescription = null, contentScale = ContentScale.Crop,
                        modifier = Modifier.size(20.dp).clip(CircleShape)
                    )
                } else {
                    LuIcon(icon, 20.dp, if (active) activeFg else idleFg)
                }
            }
            if (badge > 0) {
                val text = if (badgeCapNine && badge > 9) "9+" else badge.toString()
                // ring-2 ring-white: حلقة خارجية بلون خلفية الشريط
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 4.dp, y = (-4).dp)
                        .background(if (dark) Tw.slate950 else Tw.white, CircleShape)
                        .padding(2.dp)
                        .height(16.dp)
                        .widthIn(min = 16.dp)
                        .background(badgeColor, CircleShape)
                        .padding(horizontal = if (text.length > 1) 3.dp else 0.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text, color = Tw.white,
                        style = TextStyle(fontFamily = CairoFamily, fontSize = 9.sp, lineHeight = 9.sp, fontWeight = FontWeight.Bold)
                    )
                }
            }
        }
        Text(
            label,
            modifier = Modifier.padding(top = 2.dp),
            color = if (active) activeFg else idleFg,
            style = TextStyle(
                fontFamily = CairoFamily, fontSize = 10.sp, lineHeight = 15.sp,
                fontWeight = if (active) FontWeight.ExtraBold else FontWeight.Bold
            )
        )
    }
}
