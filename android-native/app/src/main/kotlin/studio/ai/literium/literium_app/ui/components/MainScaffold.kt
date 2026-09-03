package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.ui.theme.LiveBackgroundLayer

/**
 * The shared bottom-nav + top-header shell used by every main-tab screen (spec §2.1) — a drop-in
 * `Scaffold(topBar =, bottomBar =)` wrapper so already-built and future screens simply render their
 * body inside `content`. Owns its own live state via [MainScaffoldViewModel] (current user, admin
 * status, unread badges) so callers only ever need to pass [navController] + [currentRoute] — no
 * screen has to thread user/badge state through itself just to host this shell.
 *
 * Ports, in one composable: [TopHeaderBar] (`TopHeader.tsx`), [BottomNavBar] (`BottomNav.tsx`), and
 * [DrawerMenuContent] (`DrawerMenu.tsx`) behind a `ModalNavigationDrawer`, wired to real
 * [Screen] destinations — never a hardcoded route string, per this scope's convention.
 *
 * [currentRoute] drives which bottom-nav tab is highlighted; it is taken as a parameter (rather than
 * derived internally from [navController]'s own back-stack) because the final navigation-wiring pass
 * (`LiteriumNavHost.kt`, outside this scope) is what actually knows the live current-destination
 * route for each composable call site.
 */
@Composable
fun MainScaffold(
    navController: NavHostController,
    currentRoute: String?,
    viewModel: MainScaffoldViewModel = viewModel(),
    /** يتجاوز وجهة زر "بدء الكتابة" العائم الافتراضية (محرر المقال) — تستخدمه شاشة التغريدات
     *  فقط لتوجيه الزر لمحرر التغريد القصير عند كون التبويب الحالي "تغريد" بدل "المدونة". */
    fabAction: (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val coroutineScope = rememberCoroutineScope()
    val isAdmin = uiState.currentUser?.role == UserRole.ADMIN

    fun navigateToTab(route: String) {
        if (route == currentRoute) return
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    LiveBackgroundLayer { ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                DrawerMenuContent(
                    currentUser = uiState.currentUser,
                    isGuestOrSignedOut = uiState.isGuestOrSignedOut,
                    isAdmin = isAdmin,
                    onClose = { coroutineScope.launch { drawerState.close() } },
                    onNavigate = { route -> navController.navigate(route) },
                    onOpenProfile = { navigateToTab(Screen.Profile.route) },
                    onLogin = { navController.navigate(Screen.Login.route) },
                    onLogout = { viewModel.logOut() }
                )
            }
        }
    ) {
        Scaffold(
            // شفاف عمداً — [LiveBackgroundLayer] (خلفية القالب الجمالي الحيّة المختارة إدارياً) يُرسم
            // خلفه هنا؛ يبقى مرئياً فقط في هوامش/فراغات كل تبويب (مثل الموقع تماماً، حيث تبقى البطاقات
            // نفسها بخلفية معتمة bg-white/dark:bg-slate-900).
            containerColor = Color.Transparent,
            topBar = {
                TopHeaderBar(
                    isAdmin = isAdmin,
                    isGuestOrSignedOut = uiState.isGuestOrSignedOut,
                    unreadNotifications = uiState.unreadNotifications,
                    onOpenDrawer = { coroutineScope.launch { drawerState.open() } },
                    onOpenNotifications = { navigateToTab(Screen.Notifications.route) },
                    onOpenLogin = { navController.navigate(Screen.Login.route) },
                    onBrandClick = { navigateToTab(Screen.Feed.route) }
                )
            },
            bottomBar = {
                BottomNavBar(
                    currentRoute = currentRoute,
                    isAdmin = isAdmin,
                    isGuest = uiState.isGuestOrSignedOut,
                    currentUser = uiState.currentUser,
                    unreadNotifications = uiState.unreadNotifications,
                    unreadMessages = uiState.unreadMessages,
                    onNavigate = ::navigateToTab,
                    onOpenMessages = { navigateToTab(Screen.Messages.route) },
                    onOpenProfile = { navigateToTab(Screen.Profile.route) }
                )
            },
            floatingActionButton = {
                // "بدء الكتابة" FAB (spec §2.1) — hidden for guests, matching source's write-gated-
                // behind-auth behavior (spec §2.2). The web's second FAB ("scroll to top") is
                // intentionally not ported here: it needs the scroll state of whatever LazyColumn/
                // ScrollState lives inside `content`, which this shell does not own — each screen
                // that scrolls is the right place for its own scroll-to-top affordance.
                if (!uiState.isGuestOrSignedOut) {
                    // صفر ارتفاع تماماً (بلا أي ظل) — تجربة سابقة خفّضت الارتفاع فقط (2dp) بدل
                    // إلغائه، وبقي البلاغ الحقيقي على الجهاز قائماً: ظل RenderNode الدائري لهذا
                    // الزر يُرسَّم أحياناً كمستطيل أبيض حاد الحواف بدل التدرّج الدائري الناعم
                    // المقصود، فوق محتوى معقّد/متحرّك أسفله (خلل معروف في Compose/Android). صفر
                    // ارتفاع يمنع هذا الرسم من الأساس بدل محاولة تصغيره فقط. مطابق أيضاً لشكل الويب
                    // (`shadow-teal-600/30` — ظل ملوّن ناعم، وليس ظل Material الافتراضي الثقيل).
                    FloatingActionButton(
                        onClick = fabAction ?: { navController.navigate(Screen.ArticleEditor.new()) },
                        containerColor = BrandTeal,
                        contentColor = Color.White,
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 0.dp,
                            pressedElevation = 0.dp,
                            focusedElevation = 0.dp,
                            hoveredElevation = 0.dp
                        )
                    ) {
                        Icon(Icons.Filled.Edit, contentDescription = "بدء الكتابة")
                    }
                }
            }
        ) { padding -> content(padding) }
    } }
}
