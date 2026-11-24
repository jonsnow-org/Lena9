package studio.ai.literium.literium_app.ui.screens.kyc

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import studio.ai.literium.literium_app.data.model.KycStatus
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.KycRepository
import java.io.File

/** ID document type catalog — matches `KycModal.tsx`'s `<select>` options exactly. */
val KYC_ID_TYPES = listOf(
    "بطاقة الهوية الوطنية",
    "جواز سفر رسمي معتمد",
    "رخصة قيادة سارية",
    "سجل تجاري معتمد (للمعلنين)"
)

private const val MAX_IMAGE_BYTES = 8L * 1024 * 1024

data class KycUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val idType: String = KYC_ID_TYPES.first(),
    val idNumber: String = "",
    val previewUri: Uri? = null,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val justSubmitted: Boolean = false
) {
    /** OR-check exactly matching `creatorEligibility.ts:58` — never trust only one signal. */
    val isVerified: Boolean get() = user?.isKycVerified == true || user?.kycDetails?.status == KycStatus.VERIFIED
    val isPending: Boolean get() = user?.kycDetails?.status == KycStatus.PENDING
    val isRejected: Boolean get() = user?.kycDetails?.status == KycStatus.REJECTED
    val canSubmit: Boolean get() = idNumber.isNotBlank() && previewUri != null && !isSubmitting
}

/** Backs [KycScreen] — identity verification, mandatory gate for monetization (spec §4.7/§6.6/§12.4). */
class KycViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val kycRepository: KycRepository = KycRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(KycUiState())
    val state: StateFlow<KycUiState> = _state.asStateFlow()

    private val uid: String? = FirebaseAuth.getInstance().currentUser?.uid

    init {
        val id = uid
        if (id == null) {
            _state.value = _state.value.copy(isLoading = false)
        } else {
            viewModelScope.launch {
                authRepository.observeUser(id).collect { user ->
                    _state.value = _state.value.copy(
                        user = user,
                        isLoading = false,
                        idType = user?.kycDetails?.idType?.takeIf { it.isNotBlank() } ?: _state.value.idType,
                        idNumber = _state.value.idNumber.ifBlank { user?.kycDetails?.idNumber ?: "" }
                    )
                }
            }
        }
    }

    fun onIdTypeChange(v: String) { _state.value = _state.value.copy(idType = v) }
    fun onIdNumberChange(v: String) { _state.value = _state.value.copy(idNumber = v) }

    fun onImagePicked(context: Context, uri: Uri) {
        val size = runCatching {
            context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length }
        }.getOrNull()
        if (size != null && size > MAX_IMAGE_BYTES) {
            _state.value = _state.value.copy(error = "حجم الصورة يتجاوز 8 ميغابايت.")
            return
        }
        _state.value = _state.value.copy(previewUri = uri, error = null)
    }

    fun submit(context: Context) {
        val s = _state.value
        if (!s.canSubmit) return
        val uri = s.previewUri ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(isSubmitting = true, error = null)
            try {
                val file = withContext(Dispatchers.IO) { copyUriToCacheFile(context, uri) }
                    ?: throw IllegalStateException("تعذر قراءة الصورة المختارة.")
                val result = kycRepository.submitKyc(file, s.idType, s.idNumber.trim())
                result.fold(
                    onSuccess = { _state.value = _state.value.copy(isSubmitting = false, justSubmitted = true) },
                    onFailure = { e -> _state.value = _state.value.copy(isSubmitting = false, error = e.message ?: "تعذر إرسال طلب التوثيق. حاول مجدداً.") }
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(isSubmitting = false, error = e.message ?: "تعذر إرسال طلب التوثيق. حاول مجدداً.")
            }
        }
    }

    private fun copyUriToCacheFile(context: Context, uri: Uri): File? {
        val input = context.contentResolver.openInputStream(uri) ?: return null
        val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
        val ext = if (mime.contains("png")) "png" else "jpg"
        val file = File(context.cacheDir, "kyc_${System.currentTimeMillis()}.$ext")
        input.use { streamIn -> file.outputStream().use { streamOut -> streamIn.copyTo(streamOut) } }
        return file
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
}
