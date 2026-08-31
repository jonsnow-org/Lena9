package studio.ai.literium.literium_app.ui.screens.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.firebase.PlatformConstants
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.screens.admin.tabs.BotsTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.CampaignsTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.ChatsTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.FinanceTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.FraudTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.ModerationTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.OverviewTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.SettingsTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.AnalyticsTab
import studio.ai.literium.literium_app.ui.screens.admin.tabs.UsersTab

/**
 * Top-level admin dashboard shell — Compose port of `AdminDashboard`'s
 * former standalone shape (now folded into `UserProfileView`'s admin
 * section in the live web app, per that component's own comment, but kept
 * here as a dedicated [Screen.Admin] destination since the Kotlin nav graph
 * models real screens rather than React state-lifted view toggles — see
 * `Screen.kt`'s file KDoc on that one structural difference).
 *
 * Real tab set (verified against `UserProfileView.tsx`'s `AdminSection`
 * union + its `effectiveAdminSection === '...'` render branches, NOT
 * guessed): overview, analytics, money (finance), campaigns (ads +
 * promotions + external networks), moderation (articles), chats
 * (conversation oversight), users (+ KYC review / balance adjust / mass
 * broadcast dialogs), fraud, bots, settings (theme + revenue matrix). KYC
 * review and balance adjustment are dialogs launched from the Users tab in
 * the real product, not their own top-level tabs — ported the same way
 * here rather than inventing tabs the source doesn't have.
 */
private data class AdminTabDef(val key: String, val label: String)

private val ADMIN_TABS = listOf(
    AdminTabDef("overview", "نظرة عامة"),
    AdminTabDef("analytics", "التحليلات"),
    AdminTabDef("money", "المالية"),
    AdminTabDef("campaigns", "الإعلانات"),
    AdminTabDef("moderation", "المحتوى"),
    AdminTabDef("chats", "المحادثات"),
    AdminTabDef("users", "المستخدمون"),
    AdminTabDef("fraud", "مكافحة الاحتيال"),
    AdminTabDef("bots", "البوتات"),
    AdminTabDef("settings", "الإعدادات")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(
    navController: NavController,
    viewModel: AdminViewModel = remember { AdminViewModel() }
) {
    var activeTab by rememberSaveable { mutableStateOf("overview") }

    val currentUser by viewModel.currentUser.collectAsState()
    val users by viewModel.users.collectAsState()
    val articles by viewModel.articles.collectAsState()
    val campaigns by viewModel.campaigns.collectAsState()
    val promotions by viewModel.promotions.collectAsState()
    val fraudFlags by viewModel.fraudFlags.collectAsState()
    val adEvents by viewModel.adEvents.collectAsState()
    val depositRequests by viewModel.depositRequests.collectAsState()
    val payoutRequests by viewModel.payoutRequests.collectAsState()
    val purchaseRequests by viewModel.purchaseRequests.collectAsState()
    val earningsRecords by viewModel.earningsRecords.collectAsState()
    val manualAdjustments by viewModel.manualBalanceAdjustments.collectAsState()

    val isAdmin = currentUser?.role == "admin" ||
        currentUser?.email?.equals(PlatformConstants.OWNER_ADMIN_EMAIL, ignoreCase = true) == true

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                },
                title = {
                    Text("لوحة تحكم الإدارة", style = MaterialTheme.typography.titleLarge)
                }
            )
        }
    ) { padding ->
        if (currentUser == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }
        if (!isAdmin) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Filled.AdminPanelSettings,
                        contentDescription = null,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    Text("هذه الصفحة مخصصة لإدارة المنصة فقط.")
                }
            }
            return@Scaffold
        }

        Column(Modifier.fillMaxSize().padding(padding)) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) {
                items(ADMIN_TABS) { tab ->
                    FilterChip(
                        selected = activeTab == tab.key,
                        onClick = { activeTab = tab.key },
                        label = { Text(tab.label) },
                        modifier = Modifier.padding(end = 6.dp)
                    )
                }
            }

            Box(Modifier.weight(1f).fillMaxSize()) {
                when (activeTab) {
                    "overview" -> OverviewTab(
                        viewModel = viewModel,
                        users = users, articles = articles, campaigns = campaigns,
                        fraudFlags = fraudFlags, promotions = promotions,
                        depositRequests = depositRequests, payoutRequests = payoutRequests,
                        purchaseRequests = purchaseRequests, adEvents = adEvents,
                        onNavigateTab = { key -> activeTab = key }
                    )
                    "analytics" -> AnalyticsTab(
                        viewModel = viewModel, users = users, articles = articles,
                        campaigns = campaigns, depositRequests = depositRequests,
                        payoutRequests = payoutRequests
                    )
                    "money" -> FinanceTab(
                        viewModel = viewModel, users = users, campaigns = campaigns,
                        depositRequests = depositRequests, payoutRequests = payoutRequests,
                        purchaseRequests = purchaseRequests, adEvents = adEvents,
                        earningsRecords = earningsRecords, manualAdjustments = manualAdjustments
                    )
                    "campaigns" -> CampaignsTab(
                        viewModel = viewModel, campaigns = campaigns, promotions = promotions,
                        users = users
                    )
                    "moderation" -> ModerationTab(
                        viewModel = viewModel, articles = articles, users = users,
                        onOpenArticle = { articleId -> navController.navigate(Screen.ArticleReader.of(articleId)) }
                    )
                    "chats" -> ChatsTab(viewModel = viewModel, users = users)
                    "users" -> UsersTab(
                        viewModel = viewModel, users = users, currentUser = currentUser!!,
                        onOpenProfile = { userId -> navController.navigate(Screen.WriterProfile.of(userId)) }
                    )
                    "fraud" -> FraudTab(
                        viewModel = viewModel, fraudFlags = fraudFlags, users = users,
                        totalBlockedFraudRevenue = fraudFlags.sumOf { it.revenueBlocked }
                    )
                    "bots" -> BotsTab(viewModel = viewModel, users = users)
                    "settings" -> SettingsTab(viewModel = viewModel)
                }
            }
        }
    }
}
