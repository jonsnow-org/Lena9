package studio.ai.literium.literium_app.ui.screens.ads

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.AdPlacementType
import studio.ai.literium.literium_app.data.model.ArticleCategory
import studio.ai.literium.literium_app.data.model.CampaignStatus
import studio.ai.literium.literium_app.data.model.CampaignType
import studio.ai.literium.literium_app.data.model.PricingModel
import studio.ai.literium.literium_app.data.model.PromotionKind
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.AdCampaignRepository
import studio.ai.literium.literium_app.data.repository.AuthRepository
import java.io.File
import kotlin.math.max
import kotlin.math.roundToLong

/** Social-promotion platform catalog — id, Arabic label, and a URL-hint placeholder (`NewCampaignModal.tsx`). */
data class PromotionPlatform(val kind: String, val label: String, val urlHint: String)

val PROMOTION_PLATFORMS = listOf(
    PromotionPlatform(PromotionKind.TELEGRAM, "قناة تيليجرام", "https://t.me/channel_username"),
    PromotionPlatform(PromotionKind.YOUTUBE, "قناة يوتيوب", "https://youtube.com/@channel_handle"),
    PromotionPlatform(PromotionKind.INSTAGRAM, "حساب انستغرام", "https://instagram.com/username"),
    PromotionPlatform(PromotionKind.TWITTER, "حساب X (تويتر)", "https://x.com/username"),
    PromotionPlatform(PromotionKind.FACEBOOK, "صفحة فيسبوك", "https://facebook.com/pagename")
)

/** Light per-network CPC used for social-follow-promotion campaigns — cheaper than the standard $0.08
 *  banner rate since it is a small inline CTA button, not a full ad slot (`NewCampaignModal.tsx`). */
const val SOCIAL_PROMO_CPC_RATE = 0.02
const val DEFAULT_CPC_RATE = 0.08
const val DEFAULT_CPM_RATE = 1.00

val TARGET_CATEGORY_OPTIONS = listOf(
    "all" to "جميع التصنيفات والمقالات (أعلى وصول)",
    ArticleCategory.LITERATURE to "الأدب والشعر",
    ArticleCategory.TECHNOLOGY to "التقنية والذكاء الاصطناعي",
    ArticleCategory.PHILOSOPHY to "الفلسفة والفكر",
    ArticleCategory.HISTORY to "التاريخ والحضارات",
    ArticleCategory.BUSINESS to "ريادة الأعمال والمال",
    ArticleCategory.SCIENCE to "العلوم والفضاء"
)

data class NewCampaignUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val activeUsersCount: Long = 1,

    val campaignName: String = "",
    val description: String = "",
    val adText: String = "",
    val imageUrl: String = PRESET_BANNERS.first().second,
    val videoUrl: String = "",
    val uploadedVideoUrl: String = "",
    val mediaMode: String = "image", // "image" | "video"
    val promotionKind: String = PromotionKind.WEBSITE,
    val destinationUrl: String = "https://literium.app",
    val pricingModel: String = PricingModel.CPC,
    val placementType: String = AdPlacementType.WRITER,
    val durationHours: Long = 48,
    val cpcRate: Double = DEFAULT_CPC_RATE,
    val cpmRate: Double = DEFAULT_CPM_RATE,
    val totalBudget: Double = 20.0,
    val targetCategory: String = "all",

    val isUploadingMedia: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val submitted: Boolean = false
) {
    val userBalance: Double get() = user?.walletBalance ?: 0.0

    val userMultiplier: Double get() = max(1.0, activeUsersCount / 10000.0)

    val fixedDurationPrices: Map<Long, Long>
        get() = mapOf(
            24L to (5 * userMultiplier).roundToLong(),
            48L to (9 * userMultiplier).roundToLong(),
            72L to (13 * userMultiplier).roundToLong(),
            168L to (25 * userMultiplier).roundToLong()
        )

    val estimatedCost: Double
        get() = if (pricingModel == PricingModel.FIXED) (fixedDurationPrices[durationHours] ?: 9L).toDouble() else totalBudget

    val isSocialPromotion: Boolean get() = promotionKind != PromotionKind.WEBSITE
}

private val PRESET_BANNERS = listOf(
    "تكنولوجيا وبرمجيات" to "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    "كتب ونشر أدبي" to "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80",
    "أعمال واستثمار" to "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
    "ذكاء اصطناعي وعلم" to "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80"
)

fun presetBanners() = PRESET_BANNERS

/**
 * Backs [NewCampaignScreen] — the campaign-creation wizard (spec §4.11), covering internal
 * article-embed/profile ads (fixed/CPM/CPC pricing) AND the special social-channel promotion
 * campaign subtype (`promotionKind`) with its own lighter CPC rate. Faithfully mirrors
 * `NewCampaignModal.tsx`'s real pricing math, including the estimated-cost-vs-budget rewrite the
 * server applies on approval — a brand-new campaign is always created `pending`/zero-budget here;
 * only an admin's `/api/campaigns/:id/review` approval ever funds it (§4.11 code comment).
 */
class NewCampaignViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val adCampaignRepository: AdCampaignRepository = AdCampaignRepository(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) : ViewModel() {

    private val _state = MutableStateFlow(NewCampaignUiState())
    val state: StateFlow<NewCampaignUiState> = _state.asStateFlow()

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
                val count = runCatching {
                    firestore.collection("users").count().get(com.google.firebase.firestore.AggregateSource.SERVER).await().count
                }.getOrDefault(1L)
                _state.value = _state.value.copy(activeUsersCount = if (count > 0) count else 1L)
            }
        }
    }

    fun onCampaignNameChange(v: String) { _state.value = _state.value.copy(campaignName = v) }
    fun onDescriptionChange(v: String) { _state.value = _state.value.copy(description = v) }
    fun onAdTextChange(v: String) { _state.value = _state.value.copy(adText = v) }
    fun onDestinationUrlChange(v: String) { _state.value = _state.value.copy(destinationUrl = v) }
    fun onImageUrlChange(v: String) { _state.value = _state.value.copy(imageUrl = v) }
    fun onVideoUrlChange(v: String) { _state.value = _state.value.copy(videoUrl = v) }
    fun onUploadedVideoUrlChange(v: String) { _state.value = _state.value.copy(uploadedVideoUrl = v) }
    fun onMediaModeChange(mode: String) { _state.value = _state.value.copy(mediaMode = mode) }
    fun onPlacementTypeChange(v: String) { _state.value = _state.value.copy(placementType = v) }
    fun onDurationHoursChange(v: Long) { _state.value = _state.value.copy(durationHours = v) }
    fun onTotalBudgetChange(v: Double) { _state.value = _state.value.copy(totalBudget = v) }
    fun onTargetCategoryChange(v: String) { _state.value = _state.value.copy(targetCategory = v) }

    fun setNormalCampaign() {
        if (_state.value.promotionKind != PromotionKind.WEBSITE) {
            _state.value = _state.value.copy(promotionKind = PromotionKind.WEBSITE, pricingModel = PricingModel.CPC, cpcRate = DEFAULT_CPC_RATE)
        }
    }

    fun setSocialPromotion(kind: String) {
        val wasWebsite = _state.value.promotionKind == PromotionKind.WEBSITE
        _state.value = _state.value.copy(
            promotionKind = kind,
            pricingModel = PricingModel.CPC,
            cpcRate = SOCIAL_PROMO_CPC_RATE,
            destinationUrl = if (wasWebsite && _state.value.destinationUrl == "https://literium.app") "" else _state.value.destinationUrl
        )
    }

    fun onPricingModelChange(model: String) {
        _state.value = _state.value.copy(pricingModel = model)
    }

    /** Real upload via `POST /api/media/upload` with `purpose = "ad"` — image ≤8MB or video ≤50MB/≤60s
     *  (spec §12.9), matching source's `MediaUploadInput`. */
    fun uploadAdMedia(context: Context, uri: Uri, kind: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isUploadingMedia = true, error = null)
            try {
                val file = withContext(Dispatchers.IO) { copyUriToCacheFile(context, uri) }
                    ?: throw IllegalStateException("تعذر قراءة الملف المختار.")
                val mimeType = context.contentResolver.getType(uri) ?: if (kind == "video") "video/mp4" else "image/jpeg"
                val filePart = MultipartBody.Part.createFormData("file", file.name, file.asRequestBody(mimeType.toMediaType()))
                val response = NetworkModule.api.uploadMedia(
                    authorization = NetworkModule.authorizationHeader(),
                    file = filePart,
                    purpose = "ad".toRequestBody("text/plain".toMediaType())
                )
                _state.value = if (kind == "video") {
                    _state.value.copy(uploadedVideoUrl = response.url, isUploadingMedia = false)
                } else {
                    _state.value.copy(imageUrl = response.url, isUploadingMedia = false)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(isUploadingMedia = false, error = e.message ?: "تعذر رفع الملف.")
            }
        }
    }

    private fun copyUriToCacheFile(context: Context, uri: Uri): File? {
        val input = context.contentResolver.openInputStream(uri) ?: return null
        val file = File(context.cacheDir, "ad_media_${System.currentTimeMillis()}")
        input.use { streamIn -> file.outputStream().use { streamOut -> streamIn.copyTo(streamOut) } }
        return file
    }

    fun validate(): String? {
        val s = _state.value
        if (s.campaignName.isBlank()) return "يرجى إدخال اسم الحملة الإعلانية."
        if (s.adText.isBlank()) return "يرجى كتابة نص الإعلان الترويجي."
        if (s.destinationUrl.isBlank()) {
            return if (s.promotionKind == PromotionKind.WEBSITE) "يرجى إدخال الرابط المستهدف للحملة."
            else "يرجى إدخال رابط القناة/الحساب المراد الترويج له."
        }
        if (s.userBalance < s.estimatedCost) {
            return "رصيد محفظتك (${"%.2f".format(s.userBalance)}$) غير كافٍ لتغطية ميزانية الحملة (${"%.2f".format(s.estimatedCost)}$). يرجى شحن الرصيد أولاً."
        }
        return null
    }

    fun submit(onSuccess: () -> Unit) {
        val id = uid ?: return
        val s = _state.value
        val error = validate()
        if (error != null) {
            _state.value = s.copy(error = error)
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isSubmitting = true, error = null)
            val type = when (s.pricingModel) {
                PricingModel.FIXED -> CampaignType.FIXED
                PricingModel.CPC -> CampaignType.CPC
                else -> CampaignType.CPM
            }
            val campaign = AdCampaign(
                id = "",
                advertiserId = id,
                advertiserName = s.user?.let { it.penName ?: it.companyName ?: it.fullName } ?: "",
                campaignName = s.campaignName.trim(),
                description = s.description.trim().ifBlank { s.adText.trim() },
                imageUrl = if (s.mediaMode == "image") s.imageUrl.trim() else "",
                destinationUrl = s.destinationUrl.trim(),
                type = type,
                pricingModel = s.pricingModel,
                placementType = s.placementType,
                adText = s.adText.trim(),
                status = CampaignStatus.PENDING,
                durationHours = if (s.pricingModel == PricingModel.FIXED) s.durationHours else null,
                totalBudget = 0.0,
                requestedBudget = s.estimatedCost,
                cpcRate = if (s.pricingModel == PricingModel.CPC) s.cpcRate else null,
                cpmRate = if (s.pricingModel == PricingModel.CPM) s.cpmRate else null,
                targetCategories = if (s.targetCategory == "all") listOf("all") else listOf(s.targetCategory),
                targetCountries = emptyList(),
                videoUrl = s.videoUrl.trim().ifBlank { null },
                uploadedVideoUrl = if (s.mediaMode == "video") s.uploadedVideoUrl.trim().ifBlank { null } else null,
                promotionKind = s.promotionKind
            )
            val result = adCampaignRepository.saveCampaign(campaign)
            result.fold(
                onSuccess = {
                    _state.value = _state.value.copy(isSubmitting = false, submitted = true)
                    onSuccess()
                },
                onFailure = { e -> _state.value = _state.value.copy(isSubmitting = false, error = e.message ?: "حدث خطأ أثناء حفظ الحملة. يرجى المحاولة مرة أخرى.") }
            )
        }
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
}
