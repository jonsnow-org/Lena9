package studio.ai.literium.literium_app.ui.screens.aiassistant

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AiQuota
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.AiChatRequest
import studio.ai.literium.literium_app.data.remote.LiteriumApiService
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.WalletRepository
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

data class AiChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val isUser: Boolean,
    val text: String,
    val timestamp: String
)

data class AiQuotaStats(
    val remaining: Int,
    val isUnlimited: Boolean,
    val usedToday: Int,
    val limit: Int,
    val plan: String,
    val isSubscriber: Boolean
)

private const val DEFAULT_FREE_DAILY_LIMIT = 10L

/**
 * Backs [AiAssistantScreen] — Compose port of `AiAssistantModal.tsx`. Talks
 * to `POST /api/ai/chat` via [LiteriumApiService.aiChat] exactly per its
 * documented shape: no `Authorization` header, the server derives
 * everything from [AiChatRequest.userId] instead (see that method's KDoc).
 *
 * Quota bookkeeping note (see [AiQuota]'s own file KDoc): the *daily chat*
 * quota is server-side, in-memory only — there is no `GET` endpoint to read
 * a live count before sending. This mirrors the source's own approach: an
 * optimistic local estimate seeded from the user's persisted [AiQuota]
 * (with the same 24h-rolling-reset rule `checkAndRefreshQuota`/
 * `getRemainingAiUses` implement in `src/utils/aiQuota.ts`, ported locally
 * here rather than left unbuilt), persisted back to Firestore after each
 * send via [WalletRepository.updateUserAiQuota] so the count survives
 * across app sessions/devices the same way the web client's local state do
 * once written back.
 */
class AiAssistantViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val walletRepository: WalletRepository = WalletRepository(),
    private val api: LiteriumApiService = NetworkModule.api
) : ViewModel() {

    val currentUser: StateFlow<User?> =
        (FirebaseAuth.getInstance().currentUser?.uid?.let { authRepository.observeUser(it) }
            ?: MutableStateFlow<User?>(null))
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _messages = MutableStateFlow(
        listOf(
            AiChatMessage(
                isUser = false,
                text = "مرحباً بك! أنا المساعد الذكي لمنصة \"ليتيريوم\" (LITERIUM). يسعدني إرشادك في كل ما " +
                    "يتعلق بقراءة المقالات، كتابة ونشر المحتوى، تقاسم أرباح Google AdSense والمقالات المقفولة، " +
                    "وإطلاق الحملات الإعلانية. كيف أساعدك اليوم؟",
                timestamp = "الآن"
            )
        )
    )
    val messages: StateFlow<List<AiChatMessage>> = _messages

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    /** Refreshed (24h rolling window applied) on every read — matches `checkAndRefreshQuota`. */
    fun quotaStats(user: User?): AiQuotaStats {
        val quota = refreshedQuota(user?.aiQuota)
        if (quota.isSubscriber && quota.plan == "annual") {
            return AiQuotaStats(remaining = 9999, isUnlimited = true, usedToday = quota.usedToday.toInt(), limit = 9999, plan = quota.plan, isSubscriber = true)
        }
        if (quota.isSubscriber && quota.plan == "monthly") {
            val limit = (quota.planLimit ?: 200L)
            val remaining = maxOf(0L, limit - quota.usedToday)
            return AiQuotaStats(remaining.toInt(), false, quota.usedToday.toInt(), limit.toInt(), quota.plan, true)
        }
        val limit = if (quota.freeDailyLimit > 0) quota.freeDailyLimit else DEFAULT_FREE_DAILY_LIMIT
        val remaining = maxOf(0L, limit - quota.usedToday)
        return AiQuotaStats(remaining.toInt(), false, quota.usedToday.toInt(), limit.toInt(), quota.plan, false)
    }

    private fun refreshedQuota(existing: AiQuota?): AiQuota {
        val now = Instant.now()
        if (existing == null) {
            return AiQuota(freeDailyLimit = DEFAULT_FREE_DAILY_LIMIT, usedToday = 0, lastResetTime = now.toString(), isSubscriber = false, plan = "none")
        }
        var isSubscriber = existing.isSubscriber
        var plan = existing.plan
        existing.planExpiresAt?.let { expiresAt ->
            runCatching { Instant.parse(expiresAt) }.getOrNull()?.let { if (now.isAfter(it)) { isSubscriber = false; plan = "none" } }
        }
        val lastReset = runCatching { Instant.parse(existing.lastResetTime) }.getOrDefault(now)
        val hoursPassed = ChronoUnit.MINUTES.between(lastReset, now) / 60.0
        return if (hoursPassed >= 24) {
            existing.copy(isSubscriber = isSubscriber, plan = plan, usedToday = 0, lastResetTime = now.toString())
        } else {
            existing.copy(isSubscriber = isSubscriber, plan = plan)
        }
    }

    fun sendMessage(prompt: String, user: User) {
        if (prompt.isBlank() || _isLoading.value) return
        val stats = quotaStats(user)
        if (!stats.isUnlimited && stats.remaining <= 0) return

        val nowLabel = java.text.SimpleDateFormat("HH:mm").format(java.util.Date())
        _messages.value = _messages.value + AiChatMessage(isUser = true, text = prompt, timestamp = nowLabel)
        _isLoading.value = true

        viewModelScope.launch {
            // Optimistically consume one use and persist it — matches source's onConsumeAiQuota,
            // which deducts locally before the network call rather than waiting on the response.
            val refreshed = refreshedQuota(user.aiQuota)
            val updatedQuota = refreshed.copy(usedToday = refreshed.usedToday + 1)
            walletRepository.updateUserAiQuota(user.id, updatedQuota)

            val result = runCatching {
                api.aiChat(
                    AiChatRequest(
                        prompt = prompt,
                        userRole = user.role,
                        language = "ar",
                        userId = user.id,
                        isSubscriber = stats.isSubscriber,
                        plan = stats.plan
                    )
                )
            }
            val replyText = result.fold(
                onSuccess = { it.reply.ifBlank { "شكراً لسؤالك! أنا دائماً هنا لمساعدتك." } },
                onFailure = {
                    "يسرني مساعدتك في منصة ليتيريوم! يمكنك استكشاف المقالات، كتابة مقال جديد، أو إطلاق حملة إعلانية كمعلن."
                }
            )
            _messages.value = _messages.value + AiChatMessage(
                isUser = false, text = replyText,
                timestamp = java.text.SimpleDateFormat("HH:mm").format(java.util.Date())
            )
            _isLoading.value = false
        }
    }
}
