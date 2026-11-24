package studio.ai.literium.literium_app.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.firebase.PlatformConstants
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import java.time.Instant

/**
 * Authentication + own-user-document management. Ports `src/firebase.ts`'s
 * email/password auth flow (spec §3 — Email/Password is the real, sole
 * interactive sign-in method; Google Sign-In is dead code, see spec §3.1/
 * §13.1 and do NOT build it) plus the profile-mutation helpers that operate
 * on the caller's own `users/{uid}` document.
 *
 * Failure convention: every suspend function returns `Result<T>`; the
 * session [authState] listener is a `Flow` and surfaces errors through the
 * Flow's own exception channel — see [safeCall]'s file KDoc for the
 * project-wide rationale.
 */
class AuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val usersCol get() = firestore.collection(FirestoreCollections.USERS)

    /** The raw Firebase Auth user right now, or null if fully signed out (a guest session still has one). */
    val currentFirebaseUser: FirebaseUser? get() = auth.currentUser

    /**
     * Live Firebase Auth session state — the sole source of truth for "who is logged in", exactly as
     * `App.tsx` uses `onAuthStateChanged` as its one and only source (spec §3.3 — there is no separate
     * mock/demo default user). Emits null on sign-out, a [FirebaseUser] (possibly anonymous) otherwise.
     */
    fun authState(): Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { fbAuth -> trySend(fbAuth.currentUser) }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    /** Pre-registration check — mirrors `emailHasExistingAccount`, used to reject a duplicate signup
     *  with a clear message rather than silently creating a second Firebase Auth account for the same email. */
    suspend fun emailHasExistingAccount(email: String): Result<Boolean> = safeCall {
        val normalized = email.trim().lowercase()
        if (normalized.isEmpty()) return@safeCall false
        val snap = usersCol.whereEqualTo("email", normalized).get().await()
        !snap.isEmpty
    }

    /**
     * Registers a brand-new email/password account and creates its `users/{uid}` document.
     *
     * ⚠️ Per spec §3.2, the web app's ONE registration form hardcodes `role = 'writer'` for every new
     * account (`AuthModal.tsx:168`) — it does NOT default to `'reader'`. Callers should pass
     * [UserRole.WRITER] to faithfully match that, unless deliberately diverging.
     *
     * @param fullName required at signup (no separate username field is ever collected — the username
     *   is always auto-derived from the email prefix, per spec §3.2).
     */
    suspend fun registerWithEmail(
        email: String,
        password: String,
        role: String,
        fullName: String,
        penName: String? = null,
        companyName: String? = null,
        specialties: List<String>? = null,
        avatarUrl: String? = null,
        bio: String? = null
    ): Result<User> = safeCall {
        if (emailHasExistingAccount(email).getOrDefault(false)) {
            throw IllegalStateException("هذا البريد الإلكتروني مسجَّل بحساب قائم بالفعل. سجّل الدخول به، أو استخدم \"نسيت كلمة المرور؟\" لاستعادة الوصول إليه.")
        }
        val cred = auth.createUserWithEmailAndPassword(email, password).await()
        val fbUser = cred.user ?: throw IllegalStateException("فشل إنشاء حساب Firebase.")

        if (fullName.isNotBlank()) {
            val profileUpdate = com.google.firebase.auth.UserProfileChangeRequest.Builder()
                .setDisplayName(fullName)
                .build()
            runCatching { fbUser.updateProfile(profileUpdate).await() }
        }
        // Best-effort — a failed verification email must not fail registration itself.
        runCatching { fbUser.sendEmailVerification().await() }

        createOrUpdateUserDocument(
            fbUser = fbUser,
            roleOverride = role,
            fullName = fullName,
            penName = penName,
            companyName = companyName,
            specialties = specialties,
            avatarUrl = avatarUrl,
            bio = bio
        )
    }

    /** Email/password sign-in. Loads (or, for a pre-existing Auth user with no Firestore doc yet, creates) the `users/{uid}` document. */
    suspend fun loginWithEmail(email: String, password: String): Result<User> = safeCall {
        val cred = auth.signInWithEmailAndPassword(email, password).await()
        val fbUser = cred.user ?: throw IllegalStateException("فشل تسجيل الدخول.")
        // getOrThrow (not getOrNull) so a genuine fetch failure (network/permission) propagates as a
        // real error instead of being silently treated the same as "document doesn't exist yet",
        // which would otherwise attempt to create a fresh doc over a real account that merely failed
        // to load — exactly the class of bug spec §3.3 flags `fetchUserFromFirestore` as fixing.
        fetchUserFromFirestore(fbUser.uid).getOrThrow()
            ?: createOrUpdateUserDocument(fbUser = fbUser, roleOverride = null)
    }

    suspend fun logOut(): Result<Unit> = safeCall { auth.signOut() }

    /**
     * Grants an unauthenticated visitor a real Firebase Anonymous Auth identity — for read-only
     * browsing and non-reward actions like ad-impression logging (spec §3.3). Does NOT create a
     * `users/{uid}` document and must never be treated as a registered account (e.g. social-follow
     * verification rewards explicitly reject anonymous sessions, spec §4.11a/§5.9).
     */
    suspend fun ensureGuestIdentity(): Result<String> = safeCall {
        auth.currentUser?.uid ?: auth.signInAnonymously().await().user!!.uid
    }

    suspend fun resetPassword(email: String): Result<Unit> = safeCall {
        auth.sendPasswordResetEmail(email).await()
    }

    /** Verifies a password-reset `oobCode` from the emailed link and returns the associated email to display. */
    suspend fun verifyResetCode(oobCode: String): Result<String> = safeCall {
        auth.verifyPasswordResetCode(oobCode).await()
    }

    suspend fun confirmNewPassword(oobCode: String, newPassword: String): Result<Unit> = safeCall {
        auth.confirmPasswordReset(oobCode, newPassword).await()
    }

    /** Re-sends the email-verification link to the currently signed-in user. */
    suspend fun resendVerificationEmail(): Result<Unit> = safeCall {
        val user = auth.currentUser ?: throw IllegalStateException("لا يوجد مستخدم مسجَّل دخول.")
        user.sendEmailVerification().await()
    }

    /** One-shot fetch of `users/{uid}` (not a listener) — returns `Result.success(null)` for a
     *  genuinely nonexistent document (a brand-new account), and `Result.failure` for any real error
     *  (permission-denied, network) so callers never confuse "doesn't exist" with "couldn't check". */
    suspend fun fetchUserFromFirestore(uid: String): Result<User?> = safeCall {
        val snap = usersCol.document(uid).get().await()
        if (!snap.exists()) return@safeCall null
        mapFirestoreUserDocument(snap.id, snap.data ?: emptyMap())
    }

    /**
     * Live listener on the caller's own `users/{uid}` document — used to keep balances/role/KYC state
     * up to date across the session without re-fetching manually.
     */
    fun observeUser(uid: String): Flow<User?> = callbackFlow {
        val registration = usersCol.document(uid).addSnapshotListener { snap, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            if (snap == null || !snap.exists()) {
                trySend(null)
            } else {
                trySend(mapFirestoreUserDocument(snap.id, snap.data ?: emptyMap()))
            }
        }
        awaitClose { registration.remove() }
    }

    /**
     * Creates the `users/{uid}` document for a brand-new Firebase Auth user with the exact default
     * field set `src/firebase.ts`'s `createOrUpdateUserDoc` writes, or — for an existing document —
     * syncs `role` only when the caller is the hardcoded owner (always forced to admin) or an explicit
     * self-assignable [roleOverride] differs from the stored role, then returns the current [User].
     */
    suspend fun createOrUpdateUserDocument(
        fbUser: FirebaseUser,
        roleOverride: String?,
        fullName: String? = null,
        penName: String? = null,
        companyName: String? = null,
        companyIndustry: String? = null,
        companyWebsite: String? = null,
        specialties: List<String>? = null,
        avatarUrl: String? = null,
        bio: String? = null
    ): User {
        val uid = fbUser.uid
        val docRef = usersCol.document(uid)
        val userEmail = (fbUser.email ?: "").lowercase()
        val isOwner = userEmail == PlatformConstants.OWNER_ADMIN_EMAIL.lowercase()
        val safeRole: String = when {
            isOwner -> UserRole.ADMIN
            roleOverride == UserRole.WRITER -> UserRole.WRITER
            roleOverride == UserRole.ADVERTISER -> UserRole.ADVERTISER
            else -> UserRole.READER
        }

        val existing = docRef.get().await()
        if (!existing.exists()) {
            val displayName = fullName?.takeIf { it.isNotBlank() }
                ?: fbUser.displayName
                ?: fbUser.email?.substringBefore("@")
                ?: "مستخدم ليتيريوم"
            val resolvedAvatar = avatarUrl?.takeIf { it.isNotBlank() }
                ?: fbUser.photoUrl?.toString()
                ?: PlatformConstants.DEFAULT_AVATAR_URL
            val username = fbUser.email?.substringBefore("@") ?: "user_${uid.take(6)}"
            val defaultBio = when (safeRole) {
                UserRole.WRITER -> "كاتب وباحث في منصة ليتيريوم"
                UserRole.ADVERTISER -> "شركة رائدة في تقديم الحلول والخدمات الرقمية للمجتمع."
                else -> "قارئ مهتم بالفكر والأدب والإعلانات"
            }
            val nowIso = Instant.now().toString()

            val newDoc = mutableMapOf<String, Any?>(
                "uid" to uid,
                "email" to (fbUser.email ?: ""),
                "username" to username,
                // ⚠️ Deliberately mirrors source exactly: only "displayName"/"name" are written at
                // creation time, NOT "fullName" — `mapFirestoreUserDocument`'s fallback chain
                // (fullName ?: displayName ?: name) is what makes a brand-new document still resolve a
                // usable name. `updateOwnProfile` is the only path that ever writes "fullName" itself.
                "displayName" to displayName,
                "name" to displayName,
                "role" to safeRole,
                "avatarUrl" to resolvedAvatar,
                "photoURL" to resolvedAvatar,
                "coverUrl" to PlatformConstants.DEFAULT_COVER_URL,
                "walletBalance" to 0.0,
                "availableBalance" to 0.0,
                "pendingEarnings" to 0.0,
                "lifetimeEarnings" to 0.0,
                "totalEarnings" to 0.0,
                "isVerified" to (safeRole == UserRole.ADMIN),
                "createdAt" to nowIso,
                "bio" to (bio?.takeIf { it.isNotBlank() } ?: defaultBio),
                "followersCount" to 0L,
                "followingCount" to 0L,
                "articlesCount" to 0L,
                "totalViews" to 0L
            )
            if (!penName.isNullOrBlank() || safeRole == UserRole.WRITER) {
                newDoc["penName"] = penName?.takeIf { it.isNotBlank() } ?: displayName
            }
            if (!companyName.isNullOrBlank() || safeRole == UserRole.ADVERTISER) {
                newDoc["companyName"] = companyName?.takeIf { it.isNotBlank() } ?: displayName
            }
            if (!companyIndustry.isNullOrBlank()) newDoc["companyIndustry"] = companyIndustry
            if (!companyWebsite.isNullOrBlank()) newDoc["companyWebsite"] = companyWebsite
            if (!specialties.isNullOrEmpty()) newDoc["specialties"] = specialties

            docRef.set(newDoc, com.google.firebase.firestore.SetOptions.merge()).await()
            return mapFirestoreUserDocument(uid, newDoc)
        } else {
            val currentData = existing.data ?: emptyMap()
            val currentRole = currentData["role"] as? String ?: UserRole.READER
            var activeRole = currentRole
            if (isOwner) {
                if (currentRole != UserRole.ADMIN) {
                    docRef.update("role", UserRole.ADMIN).await()
                    activeRole = UserRole.ADMIN
                }
            } else if (roleOverride != null && roleOverride in UserRole.SELF_ASSIGNABLE && roleOverride != currentRole) {
                docRef.update("role", roleOverride).await()
                activeRole = roleOverride
            }
            val refreshedData = if (activeRole != currentRole) currentData + ("role" to activeRole) else currentData
            return mapFirestoreUserDocument(uid, refreshedData)
        }
    }

    /**
     * Updates the caller's own display fields — `fullName`/`penName`/`companyName`/`bio`/`avatarUrl`.
     * These are the fields `EditProfileModal` writes (spec §4.19a); firestore.rules allows the owner
     * to change any of these on their own document.
     */
    suspend fun updateOwnProfile(
        userId: String,
        fullName: String? = null,
        penName: String? = null,
        companyName: String? = null,
        bio: String? = null,
        avatarUrl: String? = null
    ): Result<Unit> = safeCall {
        val updates = buildMap<String, Any> {
            if (!fullName.isNullOrBlank()) put("fullName", fullName.trim())
            if (penName != null) put("penName", penName.trim())
            if (companyName != null) put("companyName", companyName.trim())
            if (bio != null) put("bio", bio.trim())
            if (!avatarUrl.isNullOrBlank()) put("avatarUrl", avatarUrl.trim())
        }
        if (updates.isNotEmpty()) usersCol.document(userId).update(updates).await()
        Unit
    }

    /** Updates the caller's public outbound social links (spec §4.19a `SocialLinksEditor`). Blank values are dropped. */
    suspend fun updateSocialLinks(userId: String, links: Map<String, String>): Result<Unit> = safeCall {
        val clean = links.filterValues { it.isNotBlank() }.mapValues { it.value.trim() }
        usersCol.document(userId).update("socialLinks", clean).await()
        Unit
    }

    /**
     * The role-switch / "active persona" control (spec §1.3a) — a cosmetic label change only, never a
     * capability gate. Restricted to [UserRole.SELF_ASSIGNABLE] client-side (never `admin`), mirroring
     * both `handleSwitchRole` in `App.tsx` and firestore.rules' `isSelfAssignableRole`.
     */
    suspend fun switchActiveRole(userId: String, newRole: String): Result<Unit> = safeCall {
        require(newRole in UserRole.SELF_ASSIGNABLE) { "لا يمكن تعيين هذا الدور ذاتياً: $newRole" }
        usersCol.document(userId).update("role", newRole).await()
        Unit
    }
}
