package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.ui.theme.BrandTeal

/**
 * Sticky top app bar — port of `TopHeader.tsx` (spec §2.1). After the web's own simplification pass
 * (its file comment: language/theme/AI-assistant/wallet/profile buttons all moved into the drawer to
 * avoid duplicating controls the drawer already owns), the header itself carries only: the drawer
 * trigger, brand mark, the admin-only notification bell (regular users get their bell via the bottom
 * nav's badge instead — never duplicated here, matching source exactly), and the live clock +
 * status dot, with a guest-only login button replacing the bell slot when signed out.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopHeaderBar(
    isAdmin: Boolean,
    isGuestOrSignedOut: Boolean,
    unreadNotifications: Int,
    onOpenDrawer: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenLogin: () -> Unit,
    onBrandClick: () -> Unit
) {
    CenterAlignedTopAppBar(
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onBrandClick() }
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(BrandTeal, RoundedCornerShape(10.dp))
                        .border(2.dp, BrandTeal.copy(alpha = 0.3f), RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.MenuBook, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text("LITERIUM", fontWeight = FontWeight.Black, fontSize = 16.sp, letterSpacing = 1.sp)
            }
        },
        navigationIcon = {
            IconButton(onClick = onOpenDrawer) {
                Icon(Icons.Filled.Menu, contentDescription = "القائمة")
            }
        },
        actions = {
            if (isAdmin && !isGuestOrSignedOut) {
                IconButton(onClick = onOpenNotifications) {
                    if (unreadNotifications > 0) {
                        BadgedBox(badge = {
                            Badge(containerColor = Color(0xFFF43F5E)) {
                                Text(if (unreadNotifications > 9) "9+" else unreadNotifications.toString())
                            }
                        }) {
                            Icon(Icons.Filled.Notifications, contentDescription = "الإشعارات")
                        }
                    } else {
                        Icon(Icons.Filled.Notifications, contentDescription = "الإشعارات")
                    }
                }
            }

            LiveClock()
            Spacer(modifier = Modifier.width(6.dp))
            LiveStatusDot()

            if (isGuestOrSignedOut) {
                Spacer(modifier = Modifier.width(6.dp))
                Button(
                    onClick = onOpenLogin,
                    colors = ButtonDefaults.buttonColors(containerColor = BrandTeal),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    modifier = Modifier.padding(end = 8.dp)
                ) {
                    Icon(Icons.Filled.Login, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("تسجيل الدخول", fontSize = 11.sp, fontWeight = FontWeight.Black)
                }
            }
        },
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}
