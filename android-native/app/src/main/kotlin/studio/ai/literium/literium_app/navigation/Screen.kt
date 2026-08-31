package studio.ai.literium.literium_app.navigation

/**
 * كل الوجهات الممكنة في التطبيق — يقابل حالة currentView/activeTab في
 * App.tsx (تنقّل قائم على حالة React، وليس react-router بمسارات URL) —
 * هنا نمذجناه كرسم بياني تنقّل Compose حقيقي بدل ذلك، وهذا الفرق البنيوي
 * الوحيد المقصود عن الموقع (تفصيل تقني للتنقل، لا ميزة مفقودة).
 */
sealed class Screen(val route: String) {
    data object Splash : Screen("splash")
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object ForgotPassword : Screen("forgot_password")
    data object ResetPassword : Screen("reset_password/{oobCode}") {
        fun of(oobCode: String) = "reset_password/$oobCode"
    }

    data object Feed : Screen("feed")
    data object Explore : Screen("explore")
    data object ArticleReader : Screen("article/{articleId}") {
        fun of(articleId: String) = "article/$articleId"
    }
    data object ArticleEditor : Screen("article_editor?articleId={articleId}") {
        fun new() = "article_editor"
        fun edit(articleId: String) = "article_editor?articleId=$articleId"
    }
    data object ImageStudio : Screen("image_studio")

    data object Profile : Screen("profile")
    data object WriterProfile : Screen("writer_profile/{userId}") {
        fun of(userId: String) = "writer_profile/$userId"
    }
    data object EditProfile : Screen("edit_profile")

    data object Wallet : Screen("wallet")
    data object MoneyRequest : Screen("money_request/{isDeposit}") {
        fun of(isDeposit: Boolean) = "money_request/$isDeposit"
    }
    data object Kyc : Screen("kyc")
    data object Subscription : Screen("subscription")

    data object AdvertiserDashboard : Screen("advertiser_dashboard")
    data object NewCampaign : Screen("new_campaign")
    data object PromoteArticle : Screen("promote_article/{articleId}") {
        fun of(articleId: String) = "promote_article/$articleId"
    }

    data object Messages : Screen("messages")
    data object Chat : Screen("chat/{conversationId}") {
        fun of(conversationId: String) = "chat/$conversationId"
    }
    data object NewConversation : Screen("new_conversation")

    data object Notifications : Screen("notifications")
    data object FollowList : Screen("follow_list/{userId}/{mode}") {
        fun of(userId: String, followers: Boolean) = "follow_list/$userId/${if (followers) "followers" else "following"}"
    }

    data object TweetDetail : Screen("tweet/{tweetId}") {
        fun of(tweetId: String) = "tweet/$tweetId"
    }
    data object TweetComposer : Screen("tweet_composer")

    data object AiAssistant : Screen("ai_assistant")

    data object Admin : Screen("admin")
    data object Policies : Screen("policies/{page}") {
        fun of(page: String) = "policies/$page"
    }
}
