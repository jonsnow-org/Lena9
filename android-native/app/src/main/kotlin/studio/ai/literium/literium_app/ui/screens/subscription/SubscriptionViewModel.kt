package studio.ai.literium.literium_app.ui.screens.subscription

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AiPlanType
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.WalletRepository

/** Payment method chips offered at checkout — cosmetic only (spec §4.13 note: no real gateway is wired
 *  up for subscriptions; every method funnels into the same pending admin-reviewed purchase request). */
enum class SubscriptionPaymentMethod(val label: String) {
    WALLET("محفظة ليتيريوم"),
    USDT_TRC20("USDT (TRC20)"),
    USDT_BEP20("USDT (BEP20)"),
    CARD("Stripe / بطاقة ائتمانية"),
    PAYPAL("PayPal")
}

data class SubscriptionUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val selectedPlanId: String = "annual",
    val paymentMethod: SubscriptionPaymentMethod = SubscriptionPaymentMethod.WALLET,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val successReferenceId: String? = null
) {
    val selectedPlan get() = SUBSCRIPTION_PLANS.find { it.id == selectedPlanId } ?: SUBSCRIPTION_PLANS.last()
    val walletBalance: Double get() = user?.walletBalance ?: 0.0
    val hasEnoughWalletBalance: Boolean get() = walletBalance >= selectedPlan.price
    val isCurrentlySubscribed: Boolean get() = user?.aiQuota?.isSubscriber == true
    val currentPlanLabel: String
        get() = when (user?.aiQuota?.plan) {
            AiPlanType.ANNUAL -> "مشترك VIP السنوي (غير محدود)"
            AiPlanType.MONTHLY -> "مشترك Pro الشهري"
            else -> "الخطة المجانية"
        }
}

/**
 * Backs [SubscriptionScreen] — AI feature subscription upsell (spec §4.13/§12.5). Matches source's
 * documented reality exactly: there is no real payment-gateway connection for subscriptions here — every
 * "purchase" (regardless of the payment method chip chosen) creates a pending [studio.ai.literium.literium_app.data.model.PurchaseRequest]
 * with the special `subscription_{plan}_{timestamp}` article-id convention, for an admin to review and
 * manually upgrade [User.aiQuota] — never an instant activation or a client-side balance deduction.
 */
class SubscriptionViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val walletRepository: WalletRepository = WalletRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(SubscriptionUiState())
    val state: StateFlow<SubscriptionUiState> = _state.asStateFlow()

    private val uid: String? = FirebaseAuth.getInstance().currentUser?.uid

    init {
        val id = uid
        if (id == null) {
            _state.value = _state.value.copy(isLoading = false)
        } else {
            viewModelScope.launch {
                authRepository.observeUser(id).collect { user ->
                    _state.value = _state.value.copy(user = user, isLoading = false)
                }
            }
        }
    }

    fun selectPlan(planId: String) {
        _state.value = _state.value.copy(selectedPlanId = planId)
    }

    fun selectPaymentMethod(method: SubscriptionPaymentMethod) {
        _state.value = _state.value.copy(paymentMethod = method)
    }

    fun confirmPurchase() {
        val id = uid ?: run {
            _state.value = _state.value.copy(error = "يجب تسجيل الدخول أولاً.")
            return
        }
        val s = _state.value
        val plan = s.selectedPlan

        if (s.paymentMethod == SubscriptionPaymentMethod.WALLET && s.walletBalance < plan.price) {
            _state.value = s.copy(error = "رصيد محفظتك (${"%.2f".format(s.walletBalance)}$) لا يكفي لهذا الاشتراك (${plan.price}$). اشحن محفظتك أولاً.")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isSubmitting = true, error = null)
            val articleId = "subscription_${plan.id}_${System.currentTimeMillis()}"
            val periodLabel = if (plan.id == "annual") "سنوي" else "شهري"
            val result = walletRepository.createPurchaseRequest(
                buyerId = id,
                articleId = articleId,
                articleTitle = "اشتراك المساعد الذكي ($periodLabel) عبر ${s.paymentMethod.label}",
                writerId = "",
                price = plan.price
            )
            result.fold(
                onSuccess = {
                    _state.value = _state.value.copy(
                        isSubmitting = false,
                        successReferenceId = "SUB-${System.currentTimeMillis().toString().takeLast(6)}"
                    )
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(isSubmitting = false, error = e.message ?: "تعذر إرسال طلب الاشتراك. يرجى المحاولة مرة أخرى.")
                }
            )
        }
    }

    fun reset() {
        _state.value = _state.value.copy(successReferenceId = null, error = null)
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
