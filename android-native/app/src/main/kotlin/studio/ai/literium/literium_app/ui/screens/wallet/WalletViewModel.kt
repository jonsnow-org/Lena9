package studio.ai.literium.literium_app.ui.screens.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.Transaction
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.AmountRequest
import studio.ai.literium.literium_app.data.remote.ConnectedAccountStatus
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.WalletRepository
import studio.ai.literium.literium_app.util.PayoutRules

enum class WalletTab { OVERVIEW, DEPOSIT, WITHDRAW, HISTORY }

/** Withdrawals at or above this amount require an explicit second confirmation tap (matches `WalletModal.tsx`). */
const val LARGE_WITHDRAW_CONFIRM_THRESHOLD = 500.0

/** Manual-withdraw method chips — id/label pairs, matching `WalletModal.tsx`'s withdraw method grid exactly. */
val WITHDRAW_METHODS = listOf(
    "usdt_crypto" to ("USDT TRC20 / BEP20" to "تحويل محفظة رقمية فوري"),
    "bank_wire" to ("تحويل بنكي IBAN" to "حسابك البنكي المحلي"),
    "paypal" to ("حساب PayPal" to "تحويل إلى البريد الإلكتروني"),
    "payoneer" to ("حساب Payoneer" to "حساب بايونير العالمي")
)

data class WalletUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val activeTab: WalletTab = WalletTab.OVERVIEW,
    val transactions: List<Transaction> = emptyList(),

    // Automated-rail availability
    val stripeAutomated: Boolean = false,
    val cryptoAutomated: Boolean = false,
    val payoutAccountStatus: ConnectedAccountStatus? = null,

    // Deposit tab
    val depositAmount: Double = PayoutRules.MIN_DEPOSIT_USD,
    val isStripeDepositBusy: Boolean = false,
    val stripeDepositError: String? = null,
    val isCryptoDepositBusy: Boolean = false,
    val cryptoDepositError: String? = null,
    val cardBridgeAddress: String = "",
    val isCardBridgeBusy: Boolean = false,
    val cardBridgeError: String? = null,

    // Withdraw tab
    val withdrawAmount: Double = PayoutRules.MIN_PAYOUT_USD,
    val withdrawMethod: String = "usdt_crypto",
    val withdrawAccount: String = "",
    val withdrawError: String? = null,
    val withdrawSuccessMessage: String? = null,
    val pendingLargeWithdrawConfirm: Boolean = false,
    val isAutomatedWithdrawBusy: Boolean = false,
    val isConnectPayoutBusy: Boolean = false,
    val isManualWithdrawSubmitting: Boolean = false,

    val urlToOpen: String? = null
)

/**
 * Backs [WalletScreen] — the financial hub (spec §4.8/§6). Reproduces `WalletModal.tsx`'s three deposit
 * paths (Stripe checkout, NOWPayments direct crypto, Guardarian card-bridge) and both withdrawal paths
 * (automated Stripe Connect payout, manual admin-reviewed request) faithfully, including the exact
 * $500 large-withdrawal confirmation gate and the mandatory-KYC block before ANY withdrawal.
 */
class WalletViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val walletRepository: WalletRepository = WalletRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(WalletUiState())
    val state: StateFlow<WalletUiState> = _state.asStateFlow()

    private val _openUrl = MutableSharedFlow<String>()
    val openUrl: SharedFlow<String> = _openUrl

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
            viewModelScope.launch {
                walletRepository.observeEarnings(id).collect { txs ->
                    _state.value = _state.value.copy(transactions = txs)
                }
            }
            loadPaymentStatuses()
        }
    }

    private fun loadPaymentStatuses() {
        viewModelScope.launch {
            val stripe = runCatching { NetworkModule.api.paymentsStatus().automated }.getOrDefault(false)
            val crypto = runCatching { NetworkModule.api.nowPaymentsStatus().automated }.getOrDefault(false)
            _state.value = _state.value.copy(stripeAutomated = stripe, cryptoAutomated = crypto)
        }
    }

    fun selectTab(tab: WalletTab) {
        _state.value = _state.value.copy(activeTab = tab, pendingLargeWithdrawConfirm = false)
        if (tab == WalletTab.WITHDRAW && _state.value.stripeAutomated) {
            loadPayoutAccountStatus()
        }
    }

    private fun loadPayoutAccountStatus() {
        viewModelScope.launch {
            val result = runCatching { NetworkModule.api.payoutAccountStatus(NetworkModule.authorizationHeader()) }
            _state.value = _state.value.copy(payoutAccountStatus = result.getOrNull())
        }
    }

    // ---- Deposit tab ----

    fun onDepositAmountChange(amount: Double) {
        _state.value = _state.value.copy(depositAmount = amount)
    }

    fun automatedStripeDeposit() {
        val amount = _state.value.depositAmount
        if (amount < PayoutRules.MIN_DEPOSIT_USD) {
            _state.value = _state.value.copy(stripeDepositError = "الحد الأدنى للإيداع ${PayoutRules.MIN_DEPOSIT_USD.toInt()}$.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isStripeDepositBusy = true, stripeDepositError = null)
            try {
                val result = NetworkModule.api.createDepositCheckout(NetworkModule.authorizationHeader(), AmountRequest(amount))
                _openUrl.emit(result.checkoutUrl)
            } catch (e: Exception) {
                _state.value = _state.value.copy(stripeDepositError = e.message ?: "تعذر بدء عملية الدفع.")
            } finally {
                _state.value = _state.value.copy(isStripeDepositBusy = false)
            }
        }
    }

    fun automatedCryptoDeposit() {
        val amount = _state.value.depositAmount
        if (amount < PayoutRules.MIN_DEPOSIT_USD) {
            _state.value = _state.value.copy(cryptoDepositError = "الحد الأدنى للإيداع ${PayoutRules.MIN_DEPOSIT_USD.toInt()}$.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isCryptoDepositBusy = true, cryptoDepositError = null)
            try {
                val result = NetworkModule.api.createNowPaymentsInvoice(NetworkModule.authorizationHeader(), AmountRequest(amount))
                val url = result.checkoutUrl
                if (url != null) _openUrl.emit(url) else throw IllegalStateException("لم يتم إنشاء رابط الدفع.")
            } catch (e: Exception) {
                _state.value = _state.value.copy(cryptoDepositError = e.message ?: "تعذر بدء عملية الدفع بالعملة الرقمية.")
            } finally {
                _state.value = _state.value.copy(isCryptoDepositBusy = false)
            }
        }
    }

    /** Generates the real USDT-TRC20 receiving address for the Guardarian card-bridge flow (spec §6.5). */
    fun generateCardBridgeAddress() {
        val amount = _state.value.depositAmount
        if (amount < PayoutRules.MIN_DEPOSIT_USD) {
            _state.value = _state.value.copy(cardBridgeError = "الحد الأدنى للإيداع ${PayoutRules.MIN_DEPOSIT_USD.toInt()}$.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isCardBridgeBusy = true, cardBridgeError = null)
            try {
                val result = NetworkModule.api.createNowPaymentsDirectPayment(NetworkModule.authorizationHeader(), AmountRequest(amount))
                _state.value = _state.value.copy(cardBridgeAddress = result.payAddress)
            } catch (e: Exception) {
                _state.value = _state.value.copy(cardBridgeError = e.message ?: "تعذر إنشاء عنوان استلام الدفع.")
            } finally {
                _state.value = _state.value.copy(isCardBridgeBusy = false)
            }
        }
    }

    fun resetCardBridgeAddress() {
        _state.value = _state.value.copy(cardBridgeAddress = "")
    }

    fun openGuardarian() {
        viewModelScope.launch { _openUrl.emit("https://guardarian.com") }
    }

    // ---- Withdraw tab ----

    fun onWithdrawAmountChange(amount: Double) {
        _state.value = _state.value.copy(withdrawAmount = amount, pendingLargeWithdrawConfirm = false)
    }

    fun onWithdrawMethodChange(method: String) {
        _state.value = _state.value.copy(withdrawMethod = method)
    }

    fun onWithdrawAccountChange(v: String) {
        _state.value = _state.value.copy(withdrawAccount = v)
    }

    fun connectPayoutAccount() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isConnectPayoutBusy = true, withdrawError = null)
            try {
                val result = NetworkModule.api.createPayoutConnectLink(NetworkModule.authorizationHeader())
                _state.value = _state.value.copy(payoutAccountStatus = result.status)
                result.status.onboardingUrl?.let { _openUrl.emit(it) }
            } catch (e: Exception) {
                _state.value = _state.value.copy(withdrawError = e.message ?: "تعذر بدء ربط حساب الاستلام.")
            } finally {
                _state.value = _state.value.copy(isConnectPayoutBusy = false)
            }
        }
    }

    fun automatedWithdraw() {
        val s = _state.value
        val user = s.user ?: return
        val availableBalance = user.availableBalance ?: 0.0
        if (user.isKycVerified != true && user.kycDetails?.status != "verified") {
            _state.value = s.copy(withdrawError = "يجب إتمام التحقق من الهوية (KYC) أولاً.")
            return
        }
        if (s.withdrawAmount < PayoutRules.MIN_PAYOUT_USD) {
            _state.value = s.copy(withdrawError = "الحد الأدنى للسحب هو ${PayoutRules.MIN_PAYOUT_USD.toInt()} دولاراً.")
            return
        }
        if (s.withdrawAmount > availableBalance) {
            _state.value = s.copy(withdrawError = "المبلغ يتجاوز رصيدك المتاح للسحب.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isAutomatedWithdrawBusy = true, withdrawError = null)
            try {
                NetworkModule.api.createPayout(NetworkModule.authorizationHeader(), AmountRequest(s.withdrawAmount))
                _state.value = _state.value.copy(withdrawSuccessMessage = "تم تنفيذ عملية السحب!")
            } catch (e: Exception) {
                _state.value = _state.value.copy(withdrawError = e.message ?: "تعذر تنفيذ عملية السحب.")
            } finally {
                _state.value = _state.value.copy(isAutomatedWithdrawBusy = false)
            }
        }
    }

    /** Manual (always-available) withdrawal request — a plain client Firestore write per [WalletRepository]. */
    fun submitManualWithdraw() {
        val s = _state.value
        val user = s.user ?: return
        val myId = uid ?: return
        val availableBalance = user.availableBalance ?: 0.0

        if (s.withdrawAmount < PayoutRules.MIN_PAYOUT_USD) {
            _state.value = s.copy(withdrawError = "الحد الأدنى لطلب السحب هو ${PayoutRules.MIN_PAYOUT_USD.toInt()} دولاراً.")
            return
        }
        if (s.withdrawAmount > availableBalance) {
            _state.value = s.copy(withdrawError = "المبلغ المطلوب يتجاوز رصيدك المتاح حالياً.")
            return
        }
        if (s.withdrawAccount.isBlank()) {
            _state.value = s.copy(withdrawError = "يرجى كتابة عنوان المحفظة أو الحساب البنكي.")
            return
        }
        if (user.isKycVerified != true && user.kycDetails?.status != "verified") {
            _state.value = s.copy(withdrawError = "يجب إتمام التحقق من الهوية (KYC) قبل طلب السحب.")
            return
        }
        if (s.withdrawAmount >= LARGE_WITHDRAW_CONFIRM_THRESHOLD && !s.pendingLargeWithdrawConfirm) {
            _state.value = s.copy(pendingLargeWithdrawConfirm = true)
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isManualWithdrawSubmitting = true, withdrawError = null, pendingLargeWithdrawConfirm = false)
            val result = walletRepository.createPayoutRequest(myId, s.withdrawAmount, s.withdrawMethod, s.withdrawAccount)
            _state.value = _state.value.copy(isManualWithdrawSubmitting = false)
            result.fold(
                onSuccess = {
                    _state.value = _state.value.copy(withdrawSuccessMessage = "تم إرسال طلب السحب بنجاح!", withdrawAccount = "")
                },
                onFailure = { e -> _state.value = _state.value.copy(withdrawError = e.message ?: "تعذر إرسال طلب السحب.") }
            )
        }
    }

    fun cancelLargeWithdrawConfirm() {
        _state.value = _state.value.copy(pendingLargeWithdrawConfirm = false)
    }

    fun dismissWithdrawSuccess() {
        _state.value = _state.value.copy(withdrawSuccessMessage = null, activeTab = WalletTab.OVERVIEW)
    }

    fun clearDepositErrors() {
        _state.value = _state.value.copy(stripeDepositError = null, cryptoDepositError = null, cardBridgeError = null)
    }

    fun clearWithdrawError() {
        _state.value = _state.value.copy(withdrawError = null)
    }
}
