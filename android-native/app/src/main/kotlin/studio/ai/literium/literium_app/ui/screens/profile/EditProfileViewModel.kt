package studio.ai.literium.literium_app.ui.screens.profile

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
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.remote.NetworkModule
import studio.ai.literium.literium_app.data.repository.AuthRepository
import java.io.File

data class EditProfileUiState(
    val isLoading: Boolean = true,
    val currentUser: User? = null,
    /** Which underlying [User] field the name box edits — derived from the active role, matching source's `EditProfileModal`. */
    val nameFieldLabel: String = "الاسم الكامل",
    val name: String = "",
    val bio: String = "",
    val avatarUrl: String = "",
    val socialWebsite: String = "",
    val socialTwitter: String = "",
    val socialInstagram: String = "",
    val socialLinkedin: String = "",
    val socialFacebook: String = "",
    val socialYoutube: String = "",
    val socialWhatsapp: String = "",
    val socialTelegram: String = "",
    val uploadConfigured: Boolean = false,
    val isUploadingAvatar: Boolean = false,
    val isSaving: Boolean = false,
    val saved: Boolean = false,
    val error: String? = null
)

private const val BIO_MAX_LENGTH = 160

/** Backs [EditProfileScreen] — profile fields + social links editor (spec §4.19a). */
class EditProfileViewModel(
    private val authRepository: AuthRepository = AuthRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(EditProfileUiState())
    val state: StateFlow<EditProfileUiState> = _state.asStateFlow()

    private val uid: String? = FirebaseAuth.getInstance().currentUser?.uid

    init {
        val id = uid
        if (id == null) {
            _state.value = _state.value.copy(isLoading = false)
        } else {
            viewModelScope.launch {
                val result = authRepository.fetchUserFromFirestore(id)
                val user = result.getOrNull()
                if (user != null) applyUser(user)
                _state.value = _state.value.copy(isLoading = false)
            }
            viewModelScope.launch {
                val configured = runCatching { NetworkModule.api.mediaStatus().configured }.getOrDefault(false)
                _state.value = _state.value.copy(uploadConfigured = configured)
            }
        }
    }

    private fun applyUser(user: User) {
        val nameField = when (user.role) {
            UserRole.WRITER -> user.penName
            UserRole.ADVERTISER -> user.companyName
            else -> user.fullName
        }
        val label = when (user.role) {
            UserRole.WRITER -> "الاسم المستعار (اسم الكاتب)"
            UserRole.ADVERTISER -> "اسم الجهة أو الشركة"
            else -> "الاسم الكامل"
        }
        _state.value = _state.value.copy(
            currentUser = user,
            nameFieldLabel = label,
            name = nameField?.takeIf { it.isNotBlank() } ?: user.fullName,
            bio = user.bio ?: "",
            avatarUrl = user.avatarUrl,
            socialWebsite = user.socialLinks?.website ?: "",
            socialTwitter = user.socialLinks?.twitter ?: "",
            socialInstagram = user.socialLinks?.instagram ?: "",
            socialLinkedin = user.socialLinks?.linkedin ?: "",
            socialFacebook = user.socialLinks?.facebook ?: "",
            socialYoutube = user.socialLinks?.youtube ?: "",
            socialWhatsapp = user.socialLinks?.whatsapp ?: "",
            socialTelegram = user.socialLinks?.telegram ?: ""
        )
    }

    fun onNameChange(v: String) { _state.value = _state.value.copy(name = v) }
    fun onBioChange(v: String) { _state.value = _state.value.copy(bio = v.take(BIO_MAX_LENGTH)) }
    fun onAvatarUrlChange(v: String) { _state.value = _state.value.copy(avatarUrl = v) }
    fun onSocialChange(field: String, v: String) {
        _state.value = when (field) {
            "website" -> _state.value.copy(socialWebsite = v)
            "twitter" -> _state.value.copy(socialTwitter = v)
            "instagram" -> _state.value.copy(socialInstagram = v)
            "linkedin" -> _state.value.copy(socialLinkedin = v)
            "facebook" -> _state.value.copy(socialFacebook = v)
            "youtube" -> _state.value.copy(socialYoutube = v)
            "whatsapp" -> _state.value.copy(socialWhatsapp = v)
            "telegram" -> _state.value.copy(socialTelegram = v)
            else -> _state.value
        }
    }

    /** Copies the picked content [uri] to a cache file, then uploads it via the "ad" purpose (matches
     *  source's `uploadAdMedia` call inside `EditProfileModal`) — image-only, ≤8MB, spec §12.9. */
    fun uploadAvatar(context: Context, uri: Uri) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isUploadingAvatar = true, error = null)
            try {
                val file = withContext(Dispatchers.IO) { copyUriToCacheFile(context, uri) }
                    ?: throw IllegalStateException("تعذر قراءة الصورة المختارة.")
                val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                val filePart = MultipartBody.Part.createFormData(
                    "file", file.name, file.asRequestBody(mimeType.toMediaType())
                )
                val response = NetworkModule.api.uploadMedia(
                    authorization = NetworkModule.authorizationHeader(),
                    file = filePart,
                    purpose = "ad".toRequestBody("text/plain".toMediaType())
                )
                _state.value = _state.value.copy(avatarUrl = response.url, isUploadingAvatar = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isUploadingAvatar = false, error = e.message ?: "تعذر رفع الصورة.")
            }
        }
    }

    private fun copyUriToCacheFile(context: Context, uri: Uri): File? {
        val input = context.contentResolver.openInputStream(uri) ?: return null
        val file = File(context.cacheDir, "avatar_${System.currentTimeMillis()}.jpg")
        input.use { streamIn -> file.outputStream().use { streamOut -> streamIn.copyTo(streamOut) } }
        return file
    }

    fun save(onDone: () -> Unit) {
        val id = uid ?: return
        val role = _state.value.currentUser?.role ?: UserRole.READER
        if (_state.value.name.isBlank()) {
            _state.value = _state.value.copy(error = "لا يمكن ترك الاسم فارغاً.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isSaving = true, error = null)
            val s = _state.value
            val profileResult = authRepository.updateOwnProfile(
                userId = id,
                fullName = if (role != UserRole.WRITER && role != UserRole.ADVERTISER) s.name.trim() else null,
                penName = if (role == UserRole.WRITER) s.name.trim() else null,
                companyName = if (role == UserRole.ADVERTISER) s.name.trim() else null,
                bio = s.bio.trim(),
                avatarUrl = s.avatarUrl.trim()
            )
            if (profileResult.isFailure) {
                _state.value = _state.value.copy(isSaving = false, error = profileResult.exceptionOrNull()?.message ?: "تعذر حفظ التعديلات.")
                return@launch
            }
            val links = buildMap<String, String> {
                if (s.socialWebsite.isNotBlank()) put("website", s.socialWebsite.trim())
                if (s.socialTwitter.isNotBlank()) put("twitter", s.socialTwitter.trim())
                if (s.socialInstagram.isNotBlank()) put("instagram", s.socialInstagram.trim())
                if (s.socialLinkedin.isNotBlank()) put("linkedin", s.socialLinkedin.trim())
                if (s.socialFacebook.isNotBlank()) put("facebook", s.socialFacebook.trim())
                if (s.socialYoutube.isNotBlank()) put("youtube", s.socialYoutube.trim())
                if (s.socialWhatsapp.isNotBlank()) put("whatsapp", s.socialWhatsapp.trim())
                if (s.socialTelegram.isNotBlank()) put("telegram", s.socialTelegram.trim())
            }
            authRepository.updateSocialLinks(id, links)
            _state.value = _state.value.copy(isSaving = false, saved = true)
            onDone()
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
