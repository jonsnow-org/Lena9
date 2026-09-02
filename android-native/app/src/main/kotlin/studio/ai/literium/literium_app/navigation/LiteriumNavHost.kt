package studio.ai.literium.literium_app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import studio.ai.literium.literium_app.ui.ads.AdPageCounter
import studio.ai.literium.literium_app.ui.components.MainScaffold
import studio.ai.literium.literium_app.ui.screens.admin.AdminScreen
import studio.ai.literium.literium_app.ui.screens.ads.AdvertiserDashboardScreen
import studio.ai.literium.literium_app.ui.screens.ads.NewCampaignScreen
import studio.ai.literium.literium_app.ui.screens.ads.PromoteArticleScreen
import studio.ai.literium.literium_app.ui.screens.aiassistant.AiAssistantScreen
import studio.ai.literium.literium_app.ui.screens.article.ArticleEditorScreen
import studio.ai.literium.literium_app.ui.screens.article.ArticleReaderScreen
import studio.ai.literium.literium_app.ui.screens.auth.ForgotPasswordScreen
import studio.ai.literium.literium_app.ui.screens.auth.LoginScreen
import studio.ai.literium.literium_app.ui.screens.auth.RegisterScreen
import studio.ai.literium.literium_app.ui.screens.auth.ResetPasswordScreen
import studio.ai.literium.literium_app.ui.screens.auth.SplashScreen
import studio.ai.literium.literium_app.ui.screens.explore.ExploreScreen
import studio.ai.literium.literium_app.ui.screens.feed.FeedScreen
import studio.ai.literium.literium_app.ui.screens.follow.FollowListScreen
import studio.ai.literium.literium_app.ui.screens.imagestudio.ImageStudioScreen
import studio.ai.literium.literium_app.ui.screens.kyc.KycScreen
import studio.ai.literium.literium_app.ui.screens.messages.ChatScreen
import studio.ai.literium.literium_app.ui.screens.messages.MessagesScreen
import studio.ai.literium.literium_app.ui.screens.messages.NewConversationScreen
import studio.ai.literium.literium_app.ui.screens.notifications.NotificationsScreen
import studio.ai.literium.literium_app.ui.screens.policies.PoliciesScreen
import studio.ai.literium.literium_app.ui.screens.profile.EditProfileScreen
import studio.ai.literium.literium_app.ui.screens.profile.ProfileScreen
import studio.ai.literium.literium_app.ui.screens.profile.WriterProfileScreen
import studio.ai.literium.literium_app.ui.screens.subscription.SubscriptionScreen
import studio.ai.literium.literium_app.ui.screens.tweet.TweetComposerScreen
import studio.ai.literium.literium_app.ui.screens.tweet.TweetDetailScreen
import studio.ai.literium.literium_app.ui.screens.wallet.MoneyRequestScreen
import studio.ai.literium.literium_app.ui.screens.wallet.WalletScreen

/** An incoming intent's resolved deep-link target — see [studio.ai.literium.literium_app.MainActivity]'s
 *  `resolveDeepLink`, which parses the two shapes App.tsx itself handles at startup: a shared-article
 *  link (`?article=<id>`) and a Firebase password-reset email link (`?mode=resetPassword&oobCode=...`). */
sealed class DeepLinkTarget {
    data class Article(val articleId: String) : DeepLinkTarget()
    data class ResetPassword(val oobCode: String) : DeepLinkTarget()
}

/**
 * The real navigation graph — every [Screen] destination wired to its actual screen composable,
 * built once every parallel screen-building workstream had landed (spec §2's overall IA).
 *
 * Two composable shapes coexist by design, matching each screen's own scope-time choice:
 * - **Callback-based** screens (`Feed`, `Explore`, `ArticleReader`, `ArticleEditor`, `ImageStudio`,
 *   `TweetDetail`, `TweetComposer`) take `onXxx: () -> Unit` lambdas instead of a `NavController` —
 *   wired here to real `navController.navigate(...)`/`popBackStack()` calls.
 * - **NavController-based** screens take `navController: NavController` directly and drive their own
 *   internal navigation (back button, cross-links) against real [Screen] routes.
 *
 * [MainScaffold] (persistent bottom-nav/top-header/drawer shell) wraps exactly the six destinations
 * [studio.ai.literium.literium_app.ui.components.BottomNavBar] actually lists as tabs — Feed,
 * Explore, Notifications, Messages, Profile, Admin — matching `BottomNav.tsx`'s real tab set. Every
 * other destination (detail/edit/compose/checkout screens) renders full-screen without it, the
 * standard Android push-a-detail-screen pattern; the web's single-page `currentView` switch has no
 * exact analog here since Compose Navigation is a real back-stack, not app-level state.
 */
@Composable
fun LiteriumNavHost(
    deepLinkTarget: DeepLinkTarget? = null,
    onDeepLinkConsumed: () -> Unit = {}
) {
    val navController = rememberNavController()

    // Kotlin port of `App.tsx`'s `resetAdSlotCounter()`-on-route-change: keeps AdSlot/AdTickerBar's
    // shared per-screen impression cap + rotation fairness correct across navigation, not just once
    // per process lifetime (see AdPageCounter's own KDoc for why this call belongs here).
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    LaunchedEffect(currentBackStackEntry?.destination?.route) { AdPageCounter.reset() }

    // Deep-link routing (App.tsx's own `?article=`/`?mode=resetPassword` startup handling, spec
    // §2.1/§3.4). A ResetPassword link is independent of the normal auth/splash resolution — it
    // navigates immediately, on top of whatever is on screen. An Article link instead waits for
    // Splash's own auth resolution to land on Feed (guest or signed-in — both routes there per
    // SplashScreen's KDoc), then pushes the article on top, matching the web's "open article modal
    // over whatever the home view already resolved to" behavior.
    var pendingArticleId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(deepLinkTarget) {
        when (val target = deepLinkTarget) {
            is DeepLinkTarget.ResetPassword -> {
                navController.navigate(Screen.ResetPassword.of(target.oobCode)) { launchSingleTop = true }
                onDeepLinkConsumed()
            }
            is DeepLinkTarget.Article -> {
                if (navController.currentDestination?.route == Screen.Feed.route) {
                    navController.navigate(Screen.ArticleReader.of(target.articleId))
                    onDeepLinkConsumed()
                } else {
                    pendingArticleId = target.articleId
                }
            }
            null -> Unit
        }
    }
    LaunchedEffect(currentBackStackEntry?.destination?.route, pendingArticleId) {
        val articleId = pendingArticleId
        if (articleId != null && currentBackStackEntry?.destination?.route == Screen.Feed.route) {
            navController.navigate(Screen.ArticleReader.of(articleId))
            pendingArticleId = null
            onDeepLinkConsumed()
        }
    }

    NavHost(navController = navController, startDestination = Screen.Splash.route) {
        // ---- Auth (no MainScaffold) ----
        composable(Screen.Splash.route) {
            SplashScreen(
                onNavigateToFeed = {
                    navController.navigate(Screen.Feed.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Feed.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToRegister = { navController.navigate(Screen.Register.route) },
                onNavigateToForgotPassword = { navController.navigate(Screen.ForgotPassword.route) },
                onNavigateBack = { navController.popBackStack() }
            )
        }
        composable(Screen.Register.route) {
            RegisterScreen(
                onRegisterSuccess = {
                    navController.navigate(Screen.Feed.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = { navController.navigate(Screen.Login.route) },
                onNavigateBack = { navController.popBackStack() }
            )
        }
        composable(Screen.ForgotPassword.route) {
            ForgotPasswordScreen(onNavigateBackToLogin = { navController.popBackStack() })
        }
        composable(
            route = Screen.ResetPassword.route,
            arguments = listOf(navArgument("oobCode") { type = NavType.StringType })
        ) { backStackEntry ->
            val oobCode = backStackEntry.arguments?.getString("oobCode") ?: return@composable
            ResetPasswordScreen(
                oobCode = oobCode,
                onSuccess = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        // ---- Bottom-nav tab destinations (wrapped in MainScaffold) ----
        composable(Screen.Feed.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Feed.route) { padding ->
                Box(Modifier.padding(padding)) {
                    FeedScreen(
                        onArticleClick = { id -> navController.navigate(Screen.ArticleReader.of(id)) },
                        onWriterClick = { id -> navController.navigate(Screen.WriterProfile.of(id)) },
                        onComposeArticle = { navController.navigate(Screen.ArticleEditor.new()) }
                    )
                }
            }
        }
        composable(Screen.Explore.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Explore.route) { padding ->
                Box(Modifier.padding(padding)) {
                    ExploreScreen(
                        onArticleClick = { id -> navController.navigate(Screen.ArticleReader.of(id)) },
                        onWriterClick = { id -> navController.navigate(Screen.WriterProfile.of(id)) }
                    )
                }
            }
        }
        composable(Screen.Notifications.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Notifications.route) { padding ->
                Box(Modifier.padding(padding)) { NotificationsScreen(navController) }
            }
        }
        composable(Screen.Messages.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Messages.route) { padding ->
                Box(Modifier.padding(padding)) { MessagesScreen(navController) }
            }
        }
        composable(Screen.Profile.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Profile.route) { padding ->
                Box(Modifier.padding(padding)) { ProfileScreen(navController) }
            }
        }
        composable(Screen.Admin.route) {
            // بلا `MainScaffold` هنا عمداً: `AdminScreen` يملك بالفعل `Scaffold` كاملاً خاصاً به (شريط
            // علوي + زر رجوع) — تغليفه بـ`MainScaffold` كان يُكدّس شريطاً علوياً + شريطاً سفلياً + زراً
            // عائماً إضافيين فوقه (كانا السبب في اختلاف شكل لوحة الإدارة عن نظيرتها على الويب، وعامل
            // خطر إضافي في تعقيد إعادة التركيب عند الانتقال من صفحة الملف الشخصي).
            AdminScreen(navController)
        }

        // ---- Article ----
        composable(
            route = Screen.ArticleReader.route,
            arguments = listOf(navArgument("articleId") { type = NavType.StringType })
        ) { backStackEntry ->
            val articleId = backStackEntry.arguments?.getString("articleId") ?: return@composable
            ArticleReaderScreen(
                articleId = articleId,
                onBack = { navController.popBackStack() },
                onWriterClick = { id -> navController.navigate(Screen.WriterProfile.of(id)) }
            )
        }
        composable(
            route = Screen.ArticleEditor.route,
            arguments = listOf(
                navArgument("articleId") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val articleId = backStackEntry.arguments?.getString("articleId")
            val selectedImageUrl by backStackEntry.savedStateHandle
                .getStateFlow<String?>("selectedImageUrl", null)
                .collectAsState()
            ArticleEditorScreen(
                articleId = articleId,
                onBack = { navController.popBackStack() },
                onSaved = { savedId ->
                    navController.navigate(Screen.ArticleReader.of(savedId)) {
                        popUpTo(Screen.Feed.route)
                    }
                },
                onOpenImageStudio = { navController.navigate(Screen.ImageStudio.route) },
                selectedImageUrl = selectedImageUrl
            )
        }
        composable(Screen.ImageStudio.route) {
            ImageStudioScreen(
                onBack = { navController.popBackStack() },
                onImageSelected = { url ->
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("selectedImageUrl", url)
                    navController.popBackStack()
                }
            )
        }

        // ---- Profile ----
        composable(
            route = Screen.WriterProfile.route,
            arguments = listOf(navArgument("userId") { type = NavType.StringType })
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId") ?: return@composable
            WriterProfileScreen(navController = navController, userId = userId)
        }
        composable(Screen.EditProfile.route) { EditProfileScreen(navController) }

        // ---- Wallet / KYC / Subscription ----
        composable(Screen.Wallet.route) { WalletScreen(navController) }
        composable(
            route = Screen.MoneyRequest.route,
            arguments = listOf(navArgument("isDeposit") { type = NavType.BoolType })
        ) { backStackEntry ->
            val isDeposit = backStackEntry.arguments?.getBoolean("isDeposit") ?: true
            MoneyRequestScreen(navController = navController, isDeposit = isDeposit)
        }
        composable(Screen.Kyc.route) { KycScreen(navController) }
        composable(Screen.Subscription.route) { SubscriptionScreen(navController) }

        // ---- Ads ----
        composable(Screen.AdvertiserDashboard.route) { AdvertiserDashboardScreen(navController) }
        composable(Screen.NewCampaign.route) { NewCampaignScreen(navController) }
        composable(
            route = Screen.PromoteArticle.route,
            arguments = listOf(navArgument("articleId") { type = NavType.StringType })
        ) { backStackEntry ->
            val articleId = backStackEntry.arguments?.getString("articleId") ?: return@composable
            PromoteArticleScreen(navController = navController, articleId = articleId)
        }

        // ---- Messages ----
        composable(
            route = Screen.Chat.route,
            arguments = listOf(navArgument("conversationId") { type = NavType.StringType })
        ) { backStackEntry ->
            val conversationId = backStackEntry.arguments?.getString("conversationId") ?: return@composable
            ChatScreen(conversationId = conversationId, navController = navController)
        }
        composable(Screen.NewConversation.route) { NewConversationScreen(navController) }

        // ---- Follow ----
        composable(
            route = Screen.FollowList.route,
            arguments = listOf(
                navArgument("userId") { type = NavType.StringType },
                navArgument("mode") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId") ?: return@composable
            val mode = backStackEntry.arguments?.getString("mode") ?: "followers"
            FollowListScreen(userId = userId, followers = mode == "followers", navController = navController)
        }

        // ---- Tweets ----
        composable(
            route = Screen.TweetDetail.route,
            arguments = listOf(navArgument("tweetId") { type = NavType.StringType })
        ) { backStackEntry ->
            val tweetId = backStackEntry.arguments?.getString("tweetId") ?: return@composable
            TweetDetailScreen(
                tweetId = tweetId,
                onBack = { navController.popBackStack() },
                onAuthorClick = { id -> navController.navigate(Screen.WriterProfile.of(id)) }
            )
        }
        composable(Screen.TweetComposer.route) {
            TweetComposerScreen(
                onBack = { navController.popBackStack() },
                onPosted = { navController.popBackStack() }
            )
        }

        // ---- AI Assistant / Policies ----
        composable(Screen.AiAssistant.route) { AiAssistantScreen(navController) }
        composable(
            route = Screen.Policies.route,
            arguments = listOf(navArgument("page") { type = NavType.StringType })
        ) { backStackEntry ->
            val page = backStackEntry.arguments?.getString("page") ?: "privacy"
            PoliciesScreen(navController = navController, page = page)
        }
    }
}
