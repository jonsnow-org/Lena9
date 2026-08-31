package studio.ai.literium.literium_app.ui.screens.imagestudio

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.remote.AiGenerateImageRequest
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.AuthRepository

/** The 7 curated artistic styles offered by `ImageStudioModal.tsx`'s `STYLE_OPTIONS`. */
data class ImageStyleOption(val id: String, val labelAr: String, val descAr: String, val emoji: String)

val IMAGE_STYLE_OPTIONS = listOf(
    ImageStyleOption("oil_painting", "لوحة زيتية أدبية", "فن تشكيلي كلاسيكي وألوان دافئة", "🎨"),
    ImageStyleOption("surrealist", "سريالي وفلسفي", "تأملي ورمزي عميق ومؤثر", "🌌"),
    ImageStyleOption("photorealistic", "واقعي سينمائي", "دقة فائقة كعدسة كاميرا احترافية", "📷"),
    ImageStyleOption("digital_art", "فن رقمي عصري", "إضاءة ديناميكية وألوان حيوية", "✨"),
    ImageStyleOption("minimalist", "بسيط وتجريدي", "مساحات مريحة وأناقة بصرية", "◻️"),
    ImageStyleOption("arabic_calligraphy_art", "زخرفة وخط عربي", "أصالة شرقية ونقوش إسلامية مذهبة", "📜"),
    ImageStyleOption("fantasy", "خيالي أسطوري", "أجواء سحرية وإضاءة أثيرية", "🔮")
)

/** All 5 aspect ratios the server DTO accepts (spec/`AiGenerateImageRequest.aspectRatio` KDoc) —
 *  the live web UI's own picker only surfaces 4 of these; this app offers the full set. */
data class AspectRatioOption(val id: String, val labelAr: String)

val ASPECT_RATIO_OPTIONS = listOf(
    AspectRatioOption("1:1", "1:1 (مربع)"),
    AspectRatioOption("3:4", "3:4 (عمودي)"),
    AspectRatioOption("4:3", "4:3 (بطاقة)"),
    AspectRatioOption("9:16", "9:16 (ستوري)"),
    AspectRatioOption("16:9", "16:9 (غلاف مقال)")
)

val IMAGE_PROMPT_SUGGESTIONS = listOf(
    "مكتبة خشبية تاريخية في ليل هادئ مع ضوء دافئ يتسلل بين الكتب القديمة",
    "مفكر يتأمل الأفق عند غروب الشمس فوق مدينة قديمة بطراز أندلسي",
    "لوحة فنية تعبر عن فلسفة الوقت وتدفق الأفكار بأسلوب سريالي ساحر",
    "قلم حبر ذهبي عتيق يكتب على ورق بردي قديم محاطاً بنقوش إسلامية وزخارف",
    "غلاف مقال مستقبلي يجمع بين الذكاء الاصطناعي وبلاغة اللغة العربية"
)

data class ImageStudioUiState(
    val currentUser: User? = null,
    val prompt: String = "",
    val style: String = IMAGE_STYLE_OPTIONS.first().id,
    val aspectRatio: String = "16:9",
    val isLoading: Boolean = false,
    val currentImage: String? = null,
    val history: List<String> = emptyList(),
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val isAiGenerated: Boolean = true,
    val charged: Boolean = false,
    val cost: Double = 0.0,
    val freeQuotaRemaining: Int? = null,
    val walletBalance: Double? = null
) {
    val isGuest: Boolean get() = currentUser == null
}

/**
 * Backs [ImageStudioScreen] (spec §4.6) — AI image generation (`POST /api/ai/generate-image`,
 * requires a real Firebase ID token per spec §11.5), metered against the lifetime 3-free-images
 * quota then a flat per-image charge from `walletBalance` (spec §12.5).
 */
class ImageStudioViewModel(application: Application) : AndroidViewModel(application) {

    private val authRepository = AuthRepository()

    private val _uiState = MutableStateFlow(ImageStudioUiState())
    val uiState: StateFlow<ImageStudioUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            authRepository.authState().collect { fbUser ->
                if (fbUser == null) {
                    _uiState.value = _uiState.value.copy(currentUser = null)
                } else {
                    authRepository.fetchUserFromFirestore(fbUser.uid).getOrNull()?.let { user ->
                        _uiState.value = _uiState.value.copy(currentUser = user, walletBalance = user.walletBalance)
                    }
                }
            }
        }
    }

    fun setPrompt(v: String) { _uiState.value = _uiState.value.copy(prompt = v) }
    fun setStyle(v: String) { _uiState.value = _uiState.value.copy(style = v) }
    fun setAspectRatio(v: String) { _uiState.value = _uiState.value.copy(aspectRatio = v) }
    fun selectFromHistory(url: String) { _uiState.value = _uiState.value.copy(currentImage = url) }
    fun dismissError() { _uiState.value = _uiState.value.copy(errorMessage = null) }

    fun generate() {
        val state = _uiState.value
        if (state.prompt.isBlank()) {
            _uiState.value = state.copy(errorMessage = "يرجى إدخال وصف للصورة المطلوب توليدها.")
            return
        }
        if (state.isLoading) return
        _uiState.value = state.copy(isLoading = true, errorMessage = null, successMessage = null)

        viewModelScope.launch {
            try {
                val header = NetworkModule.authorizationHeader()
                val response = NetworkModule.api.generateImage(
                    header,
                    AiGenerateImageRequest(prompt = state.prompt, style = state.style, aspectRatio = state.aspectRatio)
                )
                if (response.success && response.imageUrl != null) {
                    val url = response.imageUrl
                    val successMsg = when {
                        response.isAiGenerated == false -> null // handled as an error-style notice below
                        response.charged && response.cost > 0 -> "تم توليد الصورة وخصم $${"%.2f".format(response.cost)} من رصيد محفظتك."
                        else -> "تم توليد الصورة بنجاح عبر حصتك المجانية!"
                    }
                    val errorMsg = if (response.isAiGenerated == false) {
                        response.message ?: "تعذّر الاتصال بمولّد الذكاء الاصطناعي، فتم عرض صورة بديلة مؤقتة. لم يُخصَم أي مبلغ."
                    } else null

                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        currentImage = url,
                        history = (listOf(url) + _uiState.value.history.filter { it != url }),
                        isAiGenerated = response.isAiGenerated,
                        charged = response.charged,
                        cost = response.cost,
                        freeQuotaRemaining = response.remainingFreeUses,
                        walletBalance = response.newBalance ?: _uiState.value.walletBalance,
                        successMessage = successMsg,
                        errorMessage = errorMsg
                    )
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = response.message ?: "تعذر توليد الصورة بالذكاء الاصطناعي.")
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message ?: "حدث خطأ غير متوقع أثناء توليد الصورة.")
            }
        }
    }
}
