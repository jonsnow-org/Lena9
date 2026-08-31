package studio.ai.literium.literium_app.ui.screens.ads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.CampaignStatus
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AdCampaignRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository

enum class AdvertiserDashboardTab { CAMPAIGNS, ANALYTICS, BILLING }

data class AdvertiserDashboardUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val activeTab: AdvertiserDashboardTab = AdvertiserDashboardTab.CAMPAIGNS,
    val myCampaigns: List<AdCampaign> = emptyList(),
    val error: String? = null
) {
    val totalImpressions: Long get() = myCampaigns.sumOf { it.impressionsCount }
    val totalClicks: Long get() = myCampaigns.sumOf { it.clicksCount }
    val totalSpent: Double get() = myCampaigns.sumOf { it.totalSpent }
    val totalBudget: Double get() = myCampaigns.sumOf { it.totalBudget }
    val totalFraudBlocked: Long get() = myCampaigns.sumOf { it.blockedFraudClicks ?: 0 }
    val avgCtr: Double get() = if (totalImpressions > 0) (totalClicks.toDouble() / totalImpressions) * 100 else 0.0
    val advertiserBalance: Double get() = user?.walletBalance ?: 0.0
}

/** Backs [AdvertiserDashboardScreen] — self-serve dashboard for any account's own campaigns (spec §4.10). */
class AdvertiserDashboardViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val adCampaignRepository: AdCampaignRepository = AdCampaignRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(AdvertiserDashboardUiState())
    val state: StateFlow<AdvertiserDashboardUiState> = _state.asStateFlow()

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
                adCampaignRepository.observeCampaigns().collect { campaigns ->
                    _state.value = _state.value.copy(myCampaigns = campaigns.filter { it.advertiserId == id })
                }
            }
        }
    }

    fun selectTab(tab: AdvertiserDashboardTab) {
        _state.value = _state.value.copy(activeTab = tab)
    }

    fun toggleCampaignStatus(campaignId: String) {
        val campaign = _state.value.myCampaigns.find { it.id == campaignId } ?: return
        val newStatus = if (campaign.status == CampaignStatus.ACTIVE) CampaignStatus.PAUSED else CampaignStatus.ACTIVE
        viewModelScope.launch {
            val result = adCampaignRepository.setCampaignStatus(campaignId, newStatus)
            if (result.isFailure) {
                _state.value = _state.value.copy(error = result.exceptionOrNull()?.message ?: "تعذر تغيير حالة الحملة.")
            }
        }
    }

    fun deleteCampaign(campaignId: String) {
        viewModelScope.launch {
            val result = adCampaignRepository.deleteCampaign(campaignId)
            if (result.isFailure) {
                _state.value = _state.value.copy(error = result.exceptionOrNull()?.message ?: "تعذر حذف الحملة.")
            }
        }
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
}
