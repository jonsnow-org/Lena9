package studio.ai.literium.literium_app.ui.screens.ads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.Article
import studio.ai.literium.literium_app.data.model.ArticlePromotion
import studio.ai.literium.literium_app.data.model.PromotionPricingModel
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AdCampaignRepository
import studio.ai.literium.literium_app.data.repository.ArticleRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import kotlin.math.floor

/** Fixed-duration promotion price table — id/hours/label/cost, ported verbatim from `PromoteArticleModal.tsx`'s
 *  `DURATION_OPTIONS` (distinct pricing from the general ad-campaign wizard's fixed-duration table). */
data class PromotionDurationOption(val hours: Long, val label: String, val fixedCost: Double)

val PROMOTION_DURATION_OPTIONS = listOf(
    PromotionDurationOption(24, "24 ساعة", 5.0),
    PromotionDurationOption(48, "48 ساعة", 9.0),
    PromotionDurationOption(72, "72 ساعة", 12.0),
    PromotionDurationOption(168, "أسبوع كامل", 25.0)
)

/** Per-click promotion rate — distinct (and higher) than the general ad-campaign CPC default, since this
 *  is a lighter-weight single-article boost, not a full ad slot (`PromoteArticleModal.tsx`). */
const val PROMOTION_CPC_RATE = 0.15
const val PROMOTION_CPC_MIN_BUDGET = 5.0

data class PromoteArticleUiState(
    val isLoading: Boolean = true,
    val article: Article? = null,
    val user: User? = null,
    val durationHours: Long = 48,
    val pricingModel: String = PromotionPricingModel.FIXED,
    val cpcBudget: Double = PROMOTION_CPC_MIN_BUDGET,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val isDone: Boolean = false
) {
    val selectedDuration: PromotionDurationOption
        get() = PROMOTION_DURATION_OPTIONS.find { it.hours == durationHours } ?: PROMOTION_DURATION_OPTIONS[1]
    val cost: Double get() = if (pricingModel == PromotionPricingModel.FIXED) selectedDuration.fixedCost else cpcBudget
    /** Matches source exactly: reads `walletBalance` (spendable deposits), not `availableBalance`. */
    val availableBalance: Double get() = user?.walletBalance ?: 0.0
    val hasEnoughBalance: Boolean get() = availableBalance >= cost
    val estimatedClicks: Int get() = floor(cpcBudget / PROMOTION_CPC_RATE).toInt()
}

/** Backs [PromoteArticleScreen] — lightweight single-article visibility boost, distinct from the full
 *  ad-campaign system (spec §4.12). Creates a pending [ArticlePromotion]; no balance is ever deducted
 *  client-side — that only happens once an admin approves the request. */
class PromoteArticleViewModel(
    private val articleId: String,
    private val authRepository: AuthRepository = AuthRepository(),
    private val articleRepository: ArticleRepository = ArticleRepository(),
    private val adCampaignRepository: AdCampaignRepository = AdCampaignRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(PromoteArticleUiState())
    val state: StateFlow<PromoteArticleUiState> = _state.asStateFlow()

    private val uid: String? = FirebaseAuth.getInstance().currentUser?.uid

    init {
        viewModelScope.launch {
            val result = articleRepository.fetchArticle(articleId)
            _state.value = _state.value.copy(article = result.getOrNull(), isLoading = false)
        }
        val id = uid
        if (id != null) {
            viewModelScope.launch {
                authRepository.observeUser(id).collect { user -> _state.value = _state.value.copy(user = user) }
            }
        }
    }

    fun onPricingModelChange(model: String) { _state.value = _state.value.copy(pricingModel = model) }
    fun onDurationChange(hours: Long) { _state.value = _state.value.copy(durationHours = hours) }
    fun onCpcBudgetChange(budget: Double) { _state.value = _state.value.copy(cpcBudget = budget.coerceAtLeast(PROMOTION_CPC_MIN_BUDGET)) }

    fun submit() {
        val id = uid ?: return
        val article = _state.value.article ?: return
        val s = _state.value

        viewModelScope.launch {
            _state.value = _state.value.copy(isSubmitting = true, error = null)
            val promotion = ArticlePromotion(
                articleId = article.id,
                articleTitle = article.title,
                writerId = id,
                writerName = s.user?.let { it.penName ?: it.fullName },
                durationHours = s.durationHours,
                pricingModel = s.pricingModel,
                cost = s.cost
            )
            val result = adCampaignRepository.requestArticlePromotion(promotion)
            result.fold(
                onSuccess = { _state.value = _state.value.copy(isSubmitting = false, isDone = true) },
                onFailure = { e ->
                    val msg = if (e.message?.contains("permission", ignoreCase = true) == true) {
                        "لا تملك صلاحية إرسال هذا الطلب. تأكد من أنك مسجّل الدخول كصاحب المقال."
                    } else {
                        "تعذر إرسال طلب الترويج. تحقق من اتصالك ثم حاول مرة أخرى."
                    }
                    _state.value = _state.value.copy(isSubmitting = false, error = msg)
                }
            )
        }
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
}
