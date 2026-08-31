package studio.ai.literium.literium_app.ui.screens.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.AdEvent
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticlePromotion
import studio.ai.literium.literium_app.data.model.BotActivityLogEntry
import studio.ai.literium.literium_app.data.model.BotPublishedItem
import studio.ai.literium.literium_app.data.model.Conversation
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.DirectMessage
import studio.ai.literium.literium_app.data.model.EarningRecord
import studio.ai.literium.literium_app.data.model.FraudFlag
import studio.ai.literium.literium_app.data.model.ManualBalanceAdjustment
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.PurchaseRequest
import studio.ai.literium.literium_app.data.model.ThemeSettingsData
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.AnalyticsSummaryResponse
import studio.ai.literium.literium_app.data.remote.CampaignReviewRequest
import studio.ai.literium.literium_app.data.remote.KycDocumentResponse
import studio.ai.literium.literium_app.data.remote.LiteriumApiService
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.AdCampaignRepository
import studio.ai.literium.literium_app.data.repository.AdminRepository
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.KycRepository
import studio.ai.literium.literium_app.data.repository.MessageRepository
import studio.ai.literium.literium_app.data.repository.WalletRepository
import studio.ai.literium.literium_app.util.RevenueShares
import java.time.Instant

/**
 * Backs the whole admin panel ([AdminScreen] + every tab under
 * `ui/screens/admin/tabs`). One shared view model rather than one per tab —
 * the real web `AdminDashboard` (folded into `UserProfileView`'s admin
 * section per `App.tsx`) also lifts every collection subscription to one
 * place and passes slices down, so this mirrors that shape.
 *
 * Every write below goes through the already-built domain repositories
 * (see each tab file for exactly which). Two real gaps in those
 * repositories are worked around locally, both documented at the call site:
 * purchase-request review (no `observePurchaseRequests`/
 * `setPurchaseRequestStatus` exists yet on [WalletRepository]) and the
 * admin ad-event batch fraud re-evaluation (`evaluateAdEventBatch` /
 * `calculateEventCost` from `src/utils/fraudFilters.ts` was never ported —
 * see [AdCampaignRepository]'s own file KDoc) — both implemented here as a
 * plain-Firestore/best-effort stand-in rather than left out, but neither
 * pretends to be the byte-exact original algorithm.
 */
class AdminViewModel(
    private val adminRepository: AdminRepository = AdminRepository(),
    private val walletRepository: WalletRepository = WalletRepository(),
    private val campaignRepository: AdCampaignRepository = AdCampaignRepository(),
    private val articleRepository: ArticleRepository = ArticleRepository(),
    private val kycRepository: KycRepository = KycRepository(),
    private val messageRepository: MessageRepository = MessageRepository(),
    private val authRepository: AuthRepository = AuthRepository(),
    private val api: LiteriumApiService = NetworkModule.api,
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) : ViewModel() {

    val currentUserId: String? get() = FirebaseAuth.getInstance().currentUser?.uid

    private fun <T> Flow<T>.asState(initial: T): StateFlow<T> =
        stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), initial)

    val currentUser: StateFlow<User?> =
        (currentUserId?.let { authRepository.observeUser(it) } ?: MutableStateFlow<User?>(null))
            .asState(null)

    val users: StateFlow<List<User>> = adminRepository.observeAllUsers().asState(emptyList())
    val articles: StateFlow<List<Article>> = articleRepository.observeArticles().asState(emptyList())
    val campaigns: StateFlow<List<AdCampaign>> = campaignRepository.observeCampaigns().asState(emptyList())
    val promotions: StateFlow<List<ArticlePromotion>> =
        campaignRepository.observePromotions(writerId = null, isAdmin = true).asState(emptyList())
    val fraudFlags: StateFlow<List<FraudFlag>> = campaignRepository.observeFraudFlags().asState(emptyList())
    val adEvents: StateFlow<List<AdEvent>> = campaignRepository.observeAdEvents().asState(emptyList())

    val depositRequests: StateFlow<List<DepositRequest>> =
        walletRepository.observeDepositRequests(userId = null, isAdmin = true).asState(emptyList())
    val payoutRequests: StateFlow<List<PayoutRequest>> =
        walletRepository.observePayoutRequests(userId = null, isAdmin = true).asState(emptyList())
    val earningsRecords: StateFlow<List<EarningRecord>> =
        walletRepository.observeAllEarningsAdmin().asState(emptyList())
    val manualBalanceAdjustments: StateFlow<List<ManualBalanceAdjustment>> =
        walletRepository.observeManualBalanceAdjustments().asState(emptyList())

    // ---- purchaseRequests: no observe/status-set method exists yet on WalletRepository (only
    // createPurchaseRequest, the writer-side path). Implemented locally, following the exact same
    // shape as WalletRepository.setDepositRequestStatus, rather than left unbuilt or faked. ----
    private val purchaseRequestsCol get() = firestore.collection(FirestoreCollections.PURCHASE_REQUESTS)

    val purchaseRequests: StateFlow<List<PurchaseRequest>> = callbackFlow {
        val reg = purchaseRequestsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.mapNotNull { it.toObject<PurchaseRequest>()?.copy(id = it.id) }.orEmpty()
                .sortedByDescending { it.createdAt })
        }
        awaitClose { reg.remove() }
    }.asState(emptyList())

    suspend fun setPurchaseRequestStatus(requestId: String, status: String): Result<Unit> = runCatching {
        purchaseRequestsCol.document(requestId).update(
            mapOf("status" to status, "reviewedAt" to Instant.now().toString())
        ).await()
        Unit
    }

    val conversations: StateFlow<List<Conversation>> =
        messageRepository.observeAllConversationsForAdmin().asState(emptyList())

    fun conversationMessages(conversationId: String): Flow<List<DirectMessage>> =
        messageRepository.observeConversationMessagesForAdmin(conversationId)

    val themeSettings: StateFlow<ThemeSettingsData> =
        adminRepository.observeThemeSettings().asState(ThemeSettingsData())
    val platformAdsEnabled: StateFlow<Boolean> =
        adminRepository.observePlatformAdsEnabled().asState(false)
    val externalAdsConfig: StateFlow<Map<String, Any?>> =
        adminRepository.observeExternalAdsConfig().asState(emptyMap())
    val publishingBotsEnabled: StateFlow<Boolean> =
        adminRepository.observePublishingBotsEnabled().asState(false)

    private val _botActivity = MutableStateFlow<List<BotActivityLogEntry>>(emptyList())
    val botActivity: StateFlow<List<BotActivityLogEntry>> = _botActivity
    private val _botContent = MutableStateFlow<List<BotPublishedItem>>(emptyList())
    val botContent: StateFlow<List<BotPublishedItem>> = _botContent
    private val _isLoadingBotContent = MutableStateFlow(false)
    val isLoadingBotContent: StateFlow<Boolean> = _isLoadingBotContent

    private val _analyticsSummary = MutableStateFlow<AnalyticsSummaryResponse?>(null)
    val analyticsSummary: StateFlow<AnalyticsSummaryResponse?> = _analyticsSummary
    private val _analyticsError = MutableStateFlow<String?>(null)
    val analyticsError: StateFlow<String?> = _analyticsError
    private val _isLoadingAnalytics = MutableStateFlow(false)
    val isLoadingAnalytics: StateFlow<Boolean> = _isLoadingAnalytics

    // ---- Platform-wide revenue metrics — a best-effort client-side aggregation matching the field
    // semantics/labels AdminOverviewTab renders (percentages sourced from RevenueShares), not a
    // byte-exact port of App.tsx's own (unread, 4900+-line) metrics computation. ----
    data class OverviewMetrics(
        val totalPlatformAdRevenue: Double = 0.0,
        val totalWriterAdRevenue: Double = 0.0,
        val platformAdSenseCut: Double = 0.0,
        val writersAdSenseCut: Double = 0.0,
        val totalLockedArticlesSales: Double = 0.0,
        val platformSalesCut: Double = 0.0,
        val writersSalesCut: Double = 0.0,
        val netPlatformRevenue: Double = 0.0,
        val totalBlockedFraudRevenue: Double = 0.0
    )

    fun computeOverviewMetrics(
        campaigns: List<AdCampaign>,
        articles: List<Article>,
        fraudFlags: List<FraudFlag>
    ): OverviewMetrics {
        val platformAdRevenue = campaigns.filter { it.placementType == "platform" || it.advertiserId.isBlank() }
            .sumOf { it.totalSpent }
        val writerAdRevenue = campaigns.filter { it.placementType == "writer" }.sumOf { it.totalSpent }
        val platformCut = writerAdRevenue * RevenueShares.IN_ARTICLE_ADS.platform
        val writerCut = writerAdRevenue * RevenueShares.IN_ARTICLE_ADS.writer
        val lockedSales = articles.sumOf { it.revenueFromSales }
        val platformSalesCut = lockedSales * RevenueShares.LOCKED_ARTICLES.platform
        val writerSalesCut = lockedSales * RevenueShares.LOCKED_ARTICLES.writer
        val blockedFraud = fraudFlags.sumOf { it.revenueBlocked }
        return OverviewMetrics(
            totalPlatformAdRevenue = platformAdRevenue,
            totalWriterAdRevenue = writerAdRevenue,
            platformAdSenseCut = platformCut,
            writersAdSenseCut = writerCut,
            totalLockedArticlesSales = lockedSales,
            platformSalesCut = platformSalesCut,
            writersSalesCut = writerSalesCut,
            netPlatformRevenue = platformAdRevenue + platformCut + platformSalesCut,
            totalBlockedFraudRevenue = blockedFraud
        )
    }

    fun loadAnalyticsSummary() {
        viewModelScope.launch {
            _isLoadingAnalytics.value = true
            _analyticsError.value = null
            try {
                val auth = NetworkModule.authorizationHeader()
                _analyticsSummary.value = api.analyticsSummary(auth)
            } catch (e: Exception) {
                _analyticsError.value = e.message ?: "تعذر تحميل الإحصائيات الحقيقية من الخادم."
            } finally {
                _isLoadingAnalytics.value = false
            }
        }
    }

    // ---- Users ----

    fun setUserVerified(userId: String, verified: Boolean) {
        viewModelScope.launch { adminRepository.setUserVerified(userId, verified) }
    }

    fun setUserBanned(userId: String, banned: Boolean) {
        viewModelScope.launch { adminRepository.setUserBanned(userId, banned) }
    }

    fun setUserRole(userId: String, role: String) {
        viewModelScope.launch { adminRepository.adminSetUserRole(userId, role) }
    }

    fun broadcastMessage(text: String, onResult: (sent: Int, failed: Int) -> Unit) {
        val adminId = currentUserId ?: return
        viewModelScope.launch {
            val targets = users.value.map { it.id }
            val result = messageRepository.broadcastMessageToAllUsers(adminId, targets, text)
            result.onSuccess { (sent, failed) -> onResult(sent, failed) }
        }
    }

    // ---- KYC ----

    suspend fun fetchKycDocument(userId: String): Result<KycDocumentResponse> = kycRepository.fetchKycDocument(userId)

    fun approveKyc(userId: String) {
        val reviewer = currentUserId ?: return
        viewModelScope.launch {
            kycRepository.approveKyc(userId)
            kycRepository.markKycDocumentReviewed(userId, approved = true, reviewerId = reviewer)
        }
    }

    fun rejectKyc(userId: String) {
        val reviewer = currentUserId ?: return
        viewModelScope.launch {
            kycRepository.rejectKyc(userId)
            kycRepository.markKycDocumentReviewed(userId, approved = false, reviewerId = reviewer)
        }
    }

    // ---- Balance adjustment ----

    fun adjustBalance(user: User, field: String, delta: Double, reason: String) {
        val admin = currentUserId ?: return
        viewModelScope.launch {
            val current = when (field) {
                "walletBalance" -> user.walletBalance ?: 0.0
                "availableBalance" -> user.availableBalance ?: 0.0
                "pendingEarnings" -> user.pendingEarnings ?: 0.0
                "lifetimeEarnings" -> user.lifetimeEarnings ?: 0.0
                else -> 0.0
            }
            val newValue = Math.round((current + delta) * 100.0) / 100.0
            val result = walletRepository.adminAdjustUserBalance(user.id, mapOf(field to newValue))
            if (result.isSuccess) {
                walletRepository.logManualBalanceAdjustment(
                    ManualBalanceAdjustment(
                        userId = user.id, amount = delta, field = field,
                        newValue = newValue, reason = reason, adjustedBy = admin
                    )
                )
            }
        }
    }

    // ---- Wallet / finance ----

    fun setDepositRequestStatus(requestId: String, status: String) {
        viewModelScope.launch { walletRepository.setDepositRequestStatus(requestId, status) }
    }

    fun setPayoutRequestStatus(requestId: String, status: String) {
        viewModelScope.launch { walletRepository.setPayoutRequestStatus(requestId, status) }
    }

    fun reviewPurchaseRequest(requestId: String, status: String) {
        viewModelScope.launch { setPurchaseRequestStatus(requestId, status) }
    }

    fun releaseEarning(earning: EarningRecord) {
        val user = users.value.find { it.id == earning.userId } ?: return
        viewModelScope.launch {
            val result = walletRepository.adminReleaseEarnings(
                userId = earning.userId,
                currentPending = user.pendingEarnings ?: 0.0,
                currentAvailable = user.availableBalance ?: 0.0,
                amountToRelease = earning.amount
            )
            if (result.isSuccess) walletRepository.markEarningReleased(earning.id)
        }
    }

    /**
     * Simplified stand-in for the source's admin "process ad events" pass — see class KDoc. Applies
     * each campaign's own rate (fixed/CPM/CPC) with no additional batch-level fraud re-scoring (the
     * ported [studio.ai.literium.literium_app.util.AntiFraudEngine] already ran at event-log time),
     * credits the writer's [RevenueShares] share as a pending (30-day-hold) earning via
     * [WalletRepository.adminLogEarning], and marks every event processed.
     */
    fun processAdEvents() {
        viewModelScope.launch {
            val events = adEvents.value
            val camps = campaigns.value.associateBy { it.id }
            for (ev in events) {
                val camp = ev.campaignId?.let { camps[it] }
                val cost = when {
                    camp == null -> 0.0
                    camp.pricingModel == "cpc" && ev.eventType == "click" -> camp.cpcRate ?: 0.0
                    camp.pricingModel == "cpm" && ev.eventType == "impression" -> (camp.cpmRate ?: 0.0) / 1000.0
                    else -> 0.0
                }
                if (cost > 0 && camp != null) {
                    campaignRepository.incrementCampaignSpend(camp.id, cost, markCompleted = false)
                    if (ev.writerId != null) {
                        val split = if (ev.slotId.startsWith("writer_profile")) RevenueShares.WRITER_PROFILE_ADS else RevenueShares.IN_ARTICLE_ADS
                        walletRepository.adminLogEarning(
                            userId = ev.writerId!!, amount = cost * split.writer,
                            source = "ad_revenue", articleId = ev.articleId, campaignId = camp.id,
                            description = "حصة من عائد إعلان (${ev.eventType})"
                        )
                    }
                }
                campaignRepository.markAdEventProcessed(ev.id, isValid = cost > 0)
            }
        }
    }

    // ---- Campaigns / promotions / external ads ----

    /** Pending-campaign approve/reject goes through the real server endpoint
     *  (`POST /api/campaigns/{id}/review`) — see [LiteriumApiService.reviewCampaign]'s KDoc: the server
     *  independently re-verifies the caller is an admin, unlike the other plain Firestore writes here. */
    fun reviewCampaign(campaignId: String, approve: Boolean, onDone: (Result<Unit>) -> Unit = {}) {
        viewModelScope.launch {
            val result = runCatching {
                val auth = NetworkModule.authorizationHeader()
                api.reviewCampaign(auth, campaignId, CampaignReviewRequest(if (approve) "approve" else "reject"))
                Unit
            }
            onDone(result)
        }
    }

    fun setCampaignStatus(campaignId: String, status: String) {
        viewModelScope.launch { campaignRepository.setCampaignStatus(campaignId, status) }
    }

    fun deleteCampaign(campaignId: String) {
        viewModelScope.launch { campaignRepository.deleteCampaign(campaignId) }
    }

    fun setPromotionStatus(promotionId: String, status: String) {
        viewModelScope.launch { campaignRepository.setPromotionStatus(promotionId, status) }
    }

    fun setPlatformAdsEnabled(enabled: Boolean) {
        val admin = currentUserId ?: return
        viewModelScope.launch { adminRepository.setPlatformAdsEnabled(enabled, admin) }
    }

    fun saveExternalAdsConfig(config: Map<String, Any?>) {
        val admin = currentUserId ?: return
        viewModelScope.launch { adminRepository.setExternalAdsConfig(config, admin) }
    }

    // ---- Content moderation ----

    fun setArticleStatus(articleId: String, status: String) {
        viewModelScope.launch { articleRepository.setArticleStatus(articleId, status) }
    }

    // ---- Fraud ----

    fun resolveFraudFlag(flagId: String, action: String) {
        viewModelScope.launch { campaignRepository.resolveFraudFlag(flagId, action) }
    }

    // ---- Bots ----

    fun loadBotActivity() {
        viewModelScope.launch {
            adminRepository.fetchRecentBotActivity(30).onSuccess { _botActivity.value = it }
        }
    }

    fun loadBotContent(botIds: List<String>) {
        if (botIds.isEmpty()) { _botContent.value = emptyList(); return }
        viewModelScope.launch {
            _isLoadingBotContent.value = true
            adminRepository.fetchBotPublishedContent(botIds).onSuccess { _botContent.value = it }
            _isLoadingBotContent.value = false
        }
    }

    fun deleteBotContent(items: List<BotPublishedItem>, botIds: List<String>) {
        viewModelScope.launch {
            adminRepository.deleteBotPublishedContentBatch(items)
            loadBotContent(botIds)
        }
    }

    fun setPublishingBotsEnabled(enabled: Boolean) {
        val admin = currentUserId ?: return
        viewModelScope.launch { adminRepository.setPublishingBotsEnabled(enabled, admin) }
    }

    // ---- Theme ----

    fun setThemePreset(preset: String) {
        val admin = currentUserId ?: return
        viewModelScope.launch { adminRepository.setThemePreset(preset, admin) }
    }

    fun setBackgroundPreset(preset: String) {
        val admin = currentUserId ?: return
        viewModelScope.launch { adminRepository.setBackgroundPreset(preset, admin) }
    }
}
