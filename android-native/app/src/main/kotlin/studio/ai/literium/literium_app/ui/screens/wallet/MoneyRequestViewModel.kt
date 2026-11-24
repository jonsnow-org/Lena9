package studio.ai.literium.literium_app.ui.screens.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.WalletRepository
import studio.ai.literium.literium_app.util.PayoutRules

/** Method chip catalog — id to Arabic label, matches `MoneyRequestModal.tsx`'s `DEPOSIT_METHODS`/`PAYOUT_METHODS`. */
val DEPOSIT_METHODS = listOf(
    "bank_wire" to "تحويل بنكي (IBAN)",
    "usdt_crypto" to "عملة رقمية (USDT)",
    "paypal" to "باي بال (PayPal)",
    "payoneer" to "بايونير (Payoneer)"
)
val PAYOUT_METHODS = listOf(
    "usdt_crypto" to "عملة رقمية (USDT TRC20/BEP20)",
    "bank_wire" to "تحويل بنكي محلي/دولي (IBAN)",
    "paypal" to "حساب باي بال (PayPal)",
    "payoneer" to "حساب بايونير (Payoneer)"
)

data class MoneyRequestUiState(
    val isDeposit: Boolean = true,
    val user: User? = null,
    val amount: Double = PayoutRules.MIN_DEPOSIT_USD,
    val method: String = DEPOSIT_METHODS.first().first,
    val reference: String = "",
    val destination: String = "",
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val isDone: Boolean = false,
    val depositRequests: List<DepositRequest> = emptyList(),
    val payoutRequests: List<PayoutRequest> = emptyList()
) {
    val minAmount: Double get() = if (isDeposit) PayoutRules.MIN_DEPOSIT_USD else PayoutRules.MIN_PAYOUT_USD
    val methods get() = if (isDeposit) DEPOSIT_METHODS else PAYOUT_METHODS
    val availableBalance: Double get() = user?.availableBalance ?: 0.0
    val pendingEarnings: Double get() = user?.pendingEarnings ?: 0.0
    val walletBalance: Double get() = user?.walletBalance ?: 0.0
    val canSubmit: Boolean get() = amount >= minAmount && (isDeposit || amount <= availableBalance) && !isSubmitting
}

/** Backs [MoneyRequestScreen] — parameterized by [Screen.MoneyRequest.of], one screen for both the
 *  deposit and withdrawal manual-request flow (spec §4.9), always available regardless of automated rails. */
class MoneyRequestViewModel(
    isDeposit: Boolean,
    private val authRepository: AuthRepository = AuthRepository(),
    private val walletRepository: WalletRepository = WalletRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(
        MoneyRequestUiState(isDeposit = isDeposit, amount = if (isDeposit) PayoutRules.MIN_DEPOSIT_USD else PayoutRules.MIN_PAYOUT_USD)
    )
    val state: StateFlow<MoneyRequestUiState> = _state.asStateFlow()

    private val uid: String? = FirebaseAuth.getInstance().currentUser?.uid

    init {
        val id = uid
        if (id != null) {
            viewModelScope.launch {
                authRepository.observeUser(id).collect { user -> _state.value = _state.value.copy(user = user) }
            }
            if (isDeposit) {
                viewModelScope.launch {
                    walletRepository.observeDepositRequests(id, isAdmin = false).collect { list ->
                        _state.value = _state.value.copy(depositRequests = list)
                    }
                }
            } else {
                viewModelScope.launch {
                    walletRepository.observePayoutRequests(id, isAdmin = false).collect { list ->
                        _state.value = _state.value.copy(payoutRequests = list)
                    }
                }
            }
        }
    }

    fun onAmountChange(amount: Double) { _state.value = _state.value.copy(amount = amount) }
    fun onMethodChange(method: String) { _state.value = _state.value.copy(method = method) }
    fun onReferenceChange(v: String) { _state.value = _state.value.copy(reference = v) }
    fun onDestinationChange(v: String) { _state.value = _state.value.copy(destination = v) }

    fun submit() {
        val id = uid ?: return
        val s = _state.value
        viewModelScope.launch {
            _state.value = _state.value.copy(isSubmitting = true, error = null)
            val result = if (s.isDeposit) {
                walletRepository.createDepositRequest(id, s.amount, s.method, s.reference.ifBlank { null })
            } else {
                walletRepository.createPayoutRequest(id, s.amount, s.method, s.destination.ifBlank { null })
            }
            result.fold(
                onSuccess = { _state.value = _state.value.copy(isSubmitting = false, isDone = true) },
                onFailure = { e -> _state.value = _state.value.copy(isSubmitting = false, error = e.message ?: "تعذر إرسال الطلب. تحقق من اتصالك ثم حاول مرة أخرى.") }
            )
        }
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
    fun reset() { _state.value = _state.value.copy(isDone = false, error = null) }
}
