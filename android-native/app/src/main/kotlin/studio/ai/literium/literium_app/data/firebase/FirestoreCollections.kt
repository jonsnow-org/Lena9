package studio.ai.literium.literium_app.data.firebase

/**
 * Every Firestore collection (and fixed-id document) path used by the
 * Literium web app, ported from a full read of `src/services/firestoreService.ts`
 * and cross-checked against `firestore.rules` (the authoritative access-
 * control list — every `match /{collection}/{id}` block there has a
 * corresponding constant here). Centralized so no repository ever
 * hand-types a collection-name string literal.
 */
object FirestoreCollections {
    // --- Core content ---
    const val USERS = "users"
    const val ARTICLES = "articles"
    const val TWEETS = "tweets"
    const val COMMENTS = "comments"
    const val TWEET_COMMENTS = "tweetComments"

    // --- KYC (admin-only; never joined with the public `users` doc) ---
    const val KYC_DOCUMENTS = "kycDocuments"

    // --- Ads ---
    const val ADS = "ads"
    const val CAMPAIGNS = "campaigns"
    const val AD_EVENTS = "adEvents"
    const val FRAUD_FLAGS = "fraudFlags"
    const val PROMOTIONS = "promotions"

    // --- Social graph & interactions ---
    const val FOLLOWS = "follows"
    const val LIKES = "likes"
    const val REACTIONS = "reactions"
    const val RATINGS = "ratings"
    const val TWEET_LIKES = "tweetLikes"
    const val TWEET_FAVORITES = "tweetFavorites"

    // --- Messaging ---
    const val CONVERSATIONS = "conversations"
    const val MESSAGES = "messages"
    const val REPORTS = "reports"

    // --- Notifications ---
    const val NOTIFICATIONS = "notifications"

    // --- Wallet / finance ---
    const val EARNINGS = "earnings"
    const val TRANSACTIONS = "transactions"
    const val DEPOSIT_REQUESTS = "depositRequests"
    const val PAYOUT_REQUESTS = "payoutRequests"
    const val ARTICLE_PURCHASES = "articlePurchases"
    const val PURCHASE_REQUESTS = "purchaseRequests"
    /** Webhook-idempotency marker documents for Stripe/NOWPayments deposit confirmations (server-written only). */
    const val PAYMENT_WEBHOOK_EVENTS = "paymentWebhookEvents"

    // --- Publishing bots ---
    const val BOT_ACTIVITY_LOG = "botActivityLog"
    /** Server/Admin-SDK-only; no client read or write path at all. */
    const val BOT_RUN_STATE = "botRunState"

    // --- Social-follow-promotion verification (server/Admin-SDK write only) ---
    const val SOCIAL_VERIFICATIONS = "socialVerifications"

    // --- Analytics (server/Admin-SDK write only; spec §11.7) ---
    const val VISITOR_SESSIONS = "visitorSessions"
    const val PAGE_VIEWS = "pageViews"

    /** The `settings` collection holds several fixed-id singleton documents. */
    object Settings {
        const val COLLECTION = "settings"
        const val THEME_DOC = "theme"
        const val PLATFORM_ADS_DOC = "platformAds"
        const val EXTERNAL_ADS_DOC = "externalAds"
        const val PUBLISHING_BOTS_DOC = "publishingBots"
    }
}
