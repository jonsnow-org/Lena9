package studio.ai.literium.literium_app.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.data.repository.AuthRepository

/**
 * Backs [LoginScreen], [RegisterScreen] and [ForgotPasswordScreen] — each screen reads its own
 * [StateFlow] slice and calls the matching mutator/submit function. One shared `AuthViewModel`
 * class (as asked for in this scope's brief) rather than three, since all three screens are just
 * different modes of the same `AuthModal` in the web source (spec §3.2) and share the exact same
 * [AuthRepository] error-mapping needs — but each screen still gets its OWN instance (default
 * Compose-navigation view-model scoping, one per back-stack entry) since none of this state needs
 * to outlive its own screen.
 *
 * Every mutating call goes through [AuthRepository]'s `Result<T>` convention (see
 * [studio.ai.literium.literium_app.data.repository.safeCall]'s file KDoc) — failures never throw
 * across the ViewModel boundary, they land in `errorMessage` via [mapAuthError].
 */
class AuthViewModel(
    private val authRepository: AuthRepository = AuthRepository()
) : ViewModel() {

    // ---- Login (spec §3.1/§3.3) ----

    data class LoginUiState(
        val email: String = "",
        val password: String = "",
        val isLoading: Boolean = false,
        val errorMessage: String? = null,
        val loginSucceeded: Boolean = false
    )

    private val _loginState = MutableStateFlow(LoginUiState())
    val loginState: StateFlow<LoginUiState> = _loginState.asStateFlow()

    fun onLoginEmailChange(value: String) {
        _loginState.update { it.copy(email = value, errorMessage = null) }
    }

    fun onLoginPasswordChange(value: String) {
        _loginState.update { it.copy(password = value, errorMessage = null) }
    }

    /** Mirrors `AuthModal.handleSubmit`'s login branch exactly, including its required-fields check. */
    fun login() {
        val state = _loginState.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _loginState.update { it.copy(errorMessage = "البريد الإلكتروني وكلمة المرور مطلوبان.") }
            return
        }
        viewModelScope.launch {
            _loginState.update { it.copy(isLoading = true, errorMessage = null) }
            authRepository.loginWithEmail(state.email.trim(), state.password).fold(
                onSuccess = { _loginState.update { it.copy(isLoading = false, loginSucceeded = true) } },
                onFailure = { e -> _loginState.update { it.copy(isLoading = false, errorMessage = mapAuthError(e)) } }
            )
        }
    }

    /** Call once navigation away from [LoginScreen] has happened, so re-entering the screen (e.g. via
     *  back navigation) doesn't immediately re-trigger the success callback with stale state. */
    fun consumeLoginSuccess() {
        _loginState.update { it.copy(loginSucceeded = false) }
    }

    // ---- Register (spec §3.2 — the single merged reader/writer form, hardcoded role='writer') ----

    data class RegisterUiState(
        /** Bound to the form's single "الاسم الكامل / الاسم الأدبي" field — submitted as BOTH `fullName`
         *  and `penName`, exactly like `AuthModal.tsx` (its separate `fullName` state is never rendered
         *  as an input; only `penName` has a real text field bound to it). */
        val name: String = "",
        val bio: String = "",
        val email: String = "",
        val password: String = "",
        val specialties: List<String> = listOf(WRITER_SPECIALTY_PRESETS.first()),
        val avatarUrl: String = WRITER_AVATAR_PRESETS.first(),
        val isLoading: Boolean = false,
        val errorMessage: String? = null,
        val registerSucceeded: Boolean = false
    )

    private val _registerState = MutableStateFlow(RegisterUiState())
    val registerState: StateFlow<RegisterUiState> = _registerState.asStateFlow()

    fun onRegisterNameChange(value: String) {
        _registerState.update { it.copy(name = value, errorMessage = null) }
    }

    fun onRegisterBioChange(value: String) {
        _registerState.update { it.copy(bio = value) }
    }

    fun onRegisterEmailChange(value: String) {
        _registerState.update { it.copy(email = value, errorMessage = null) }
    }

    fun onRegisterPasswordChange(value: String) {
        _registerState.update { it.copy(password = value, errorMessage = null) }
    }

    /** At least one specialty must always remain selected — mirrors `AuthModal.toggleSpecialty`'s
     *  guard (`selectedSpecialties.length > 1` before allowing the last one to be removed). */
    fun toggleSpecialty(specialty: String) {
        _registerState.update { state ->
            val selected = state.specialties
            val next = when {
                specialty in selected && selected.size > 1 -> selected - specialty
                specialty in selected -> selected
                else -> selected + specialty
            }
            state.copy(specialties = next)
        }
    }

    fun onRegisterAvatarSelected(avatarUrl: String) {
        _registerState.update { it.copy(avatarUrl = avatarUrl) }
    }

    /**
     * Mirrors `AuthModal.handleSubmit`'s register branch exactly: hardcodes `role = 'writer'` (spec
     * §3.2/§3.3, not a bug — this is intentional per source), derives the single submitted name from
     * the one name field with a `'كاتب ليتيريوم'` fallback, and falls back to the same default bio
     * text `AuthModal.tsx` uses when the bio field is left blank (distinct from
     * [AuthRepository.createOrUpdateUserDocument]'s own generic default bio, which only applies when
     * no bio is passed in at all — here we always pass one, matching source).
     */
    fun register() {
        val state = _registerState.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _registerState.update { it.copy(errorMessage = "البريد الإلكتروني وكلمة المرور مطلوبان.") }
            return
        }
        val finalName = state.name.trim().ifBlank { "كاتب ليتيريوم" }
        val finalBio = state.bio.trim().ifBlank { "مؤلف وباحث شغوف بالكتابة ونشر الوعي الثقافي والأدبي." }

        viewModelScope.launch {
            _registerState.update { it.copy(isLoading = true, errorMessage = null) }
            authRepository.registerWithEmail(
                email = state.email.trim(),
                password = state.password,
                role = UserRole.WRITER,
                fullName = finalName,
                penName = finalName,
                specialties = state.specialties,
                avatarUrl = state.avatarUrl,
                bio = finalBio
            ).fold(
                onSuccess = { _registerState.update { it.copy(isLoading = false, registerSucceeded = true) } },
                onFailure = { e -> _registerState.update { it.copy(isLoading = false, errorMessage = mapAuthError(e)) } }
            )
        }
    }

    fun consumeRegisterSuccess() {
        _registerState.update { it.copy(registerSucceeded = false) }
    }

    // ---- Forgot password (spec §3.4 — the `oobCode` email-link half of this flow, verifyResetCode/
    // confirmNewPassword, is a separate deep-link entry point outside this scope's screen set) ----

    data class ForgotPasswordUiState(
        val email: String = "",
        val isSubmitting: Boolean = false,
        val isSent: Boolean = false,
        val errorMessage: String? = null
    )

    private val _forgotPasswordState = MutableStateFlow(ForgotPasswordUiState())
    val forgotPasswordState: StateFlow<ForgotPasswordUiState> = _forgotPasswordState.asStateFlow()

    fun onForgotPasswordEmailChange(value: String) {
        _forgotPasswordState.update { it.copy(email = value, errorMessage = null) }
    }

    fun submitPasswordReset() {
        val state = _forgotPasswordState.value
        if (state.email.isBlank()) {
            _forgotPasswordState.update { it.copy(errorMessage = "أدخل بريدك الإلكتروني أولاً.") }
            return
        }
        viewModelScope.launch {
            _forgotPasswordState.update { it.copy(isSubmitting = true, errorMessage = null) }
            authRepository.resetPassword(state.email.trim()).fold(
                onSuccess = { _forgotPasswordState.update { it.copy(isSubmitting = false, isSent = true) } },
                onFailure = { e -> _forgotPasswordState.update { it.copy(isSubmitting = false, errorMessage = mapAuthError(e)) } }
            )
        }
    }

    fun resetForgotPasswordFlow() {
        _forgotPasswordState.update { ForgotPasswordUiState() }
    }
}

/**
 * Arabic error copy for the exceptions Firebase Auth's email/password methods actually throw —
 * ports the email/password-relevant subset of `getAuthErrorMessage` from `src/firebase.ts` (the
 * Google-popup-specific codes there — `popup-closed-by-user`, `cancelled-popup-request`, etc. — have
 * no Android email/password equivalent and are intentionally not ported, per spec §3.1: Google
 * sign-in is dead code here).
 */
private fun mapAuthError(e: Throwable): String {
    val code = (e as? com.google.firebase.auth.FirebaseAuthException)?.errorCode
    return when {
        e is FirebaseAuthUserCollisionException || code == "ERROR_EMAIL_ALREADY_IN_USE" ->
            "هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد."
        e is FirebaseAuthWeakPasswordException ->
            "كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف على الأقل."
        e is FirebaseAuthInvalidUserException || code == "ERROR_USER_NOT_FOUND" ->
            "لا يوجد حساب بهذا البريد الإلكتروني، أو كلمة المرور غير صحيحة."
        e is FirebaseAuthInvalidCredentialsException ->
            if (code == "ERROR_INVALID_EMAIL") "صيغة البريد الإلكتروني غير صحيحة."
            else "لا يوجد حساب بهذا البريد الإلكتروني، أو كلمة المرور غير صحيحة."
        e is FirebaseTooManyRequestsException ->
            "محاولات كثيرة جداً. يرجى المحاولة لاحقاً."
        e is FirebaseNetworkException ->
            "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت."
        else -> e.message?.takeIf { it.isNotBlank() } ?: "حدث خطأ غير متوقع. حاول مرة أخرى."
    }
}

/** `WRITER_SPECIALTY_PRESETS` from `AuthModal.tsx`, ported verbatim (spec §3.2). */
val WRITER_SPECIALTY_PRESETS = listOf(
    "الأدب والشعر",
    "الفلسفة والفكر",
    "الرواية والقصة",
    "النقد والدراسات",
    "التاريخ والحضارات",
    "التكنولوجيا والذكاء الاصطناعي",
    "علم الاجتماع",
    "طب وصحة",
    "سياسي",
    "تعليمي",
    "مكياج وموضة",
    "جمال",
    "رياضة",
    "طبخ وأكلات",
    "سفر وسياحة",
    "اقتصاد وأعمال",
    "تربية وأسرة"
)

/** `WRITER_AVATAR_PRESETS` from `AuthModal.tsx`, ported verbatim (spec §3.2 — a fixed gallery, not an upload). */
val WRITER_AVATAR_PRESETS = listOf(
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80"
)
