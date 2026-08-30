package studio.ai.literium.literium_app.data.repository

import studio.ai.literium.literium_app.data.firebase.PlatformConstants
import studio.ai.literium.literium_app.data.model.AiPlanType
import studio.ai.literium.literium_app.data.model.AiQuota
import studio.ai.literium.literium_app.data.model.KycDetails
import studio.ai.literium.literium_app.data.model.Presence
import studio.ai.literium.literium_app.data.model.SocialLinks
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import java.time.Instant

/**
 * Manual field-by-field mapping from a raw Firestore `users/{uid}` document
 * into [User], deliberately NOT using Firestore's `toObject<User>()`
 * reflection mapping for this one collection.
 *
 * Reason: `src/firebase.ts`'s `fetchUserFromFirestore` and
 * `firestoreService.ts`'s `subscribeToUsers` both apply real per-field
 * *fallback chains* when reading this collection (e.g. `fullName ??
 * displayName ?? name ?? "مستخدم ليتيريوم"`, `avatarUrl ?? photoURL ??
 * photoUrl ?? <default>`, `walletBalance ?? 0`) to paper over legacy/
 * inconsistent documents (some written by an old Google-auth path with
 * `displayName`/`photoURL`, some by the current email/password path with
 * `fullName`/`avatarUrl`). A plain `toObject<User>()` would only see the
 * exact field name declared on the data class and silently return the
 * class-default for every legacy document instead of falling through to
 * the older field name actually present — this mapper reproduces the real
 * fallback behavior exactly, and is reused by every read path that loads
 * this collection ([AuthRepository], [AdminRepository]) so they can never
 * drift apart.
 */
internal fun mapFirestoreUserDocument(id: String, data: Map<String, Any?>): User {
    fun str(vararg keys: String): String? {
        for (k in keys) {
            val v = data[k]
            if (v is String && v.isNotBlank()) return v
        }
        return null
    }

    fun num(key: String): Double? = (data[key] as? Number)?.toDouble()
    fun long(key: String): Long? = (data[key] as? Number)?.toLong()
    fun bool(key: String): Boolean? = data[key] as? Boolean

    @Suppress("UNCHECKED_CAST")
    fun stringList(key: String): List<String>? = (data[key] as? List<*>)?.filterIsInstance<String>()

    val email = str("email") ?: ""
    val isOwner = email.lowercase() == PlatformConstants.OWNER_ADMIN_EMAIL.lowercase()
    val storedRole = str("role")
    val role = if (isOwner) UserRole.ADMIN else (storedRole ?: UserRole.READER)

    val walletBalance = num("walletBalance") ?: 0.0
    val availableBalance = num("availableBalance") ?: 0.0
    val pendingEarnings = num("pendingEarnings") ?: 0.0
    val totalEarningsFallback = num("totalEarnings") ?: walletBalance
    val lifetimeEarnings = num("lifetimeEarnings") ?: totalEarningsFallback

    val createdAt = str("createdAt")
    val joinedDate = if (createdAt != null) {
        try {
            // Coarse "Month Year"-style fallback; full Arabic month-name formatting belongs in the UI
            // layer, not the data layer — this only guarantees the field is never left null when a
            // real createdAt exists, matching source's intent (never the literal Arabic text itself).
            Instant.parse(createdAt).toString().substring(0, 7)
        } catch (e: Exception) {
            "حديثاً"
        }
    } else {
        "حديثاً"
    }

    @Suppress("UNCHECKED_CAST")
    val socialLinksMap = data["socialLinks"] as? Map<String, Any?>
    val socialLinks = socialLinksMap?.let {
        SocialLinks(
            website = it["website"] as? String,
            twitter = it["twitter"] as? String,
            instagram = it["instagram"] as? String,
            linkedin = it["linkedin"] as? String,
            facebook = it["facebook"] as? String,
            youtube = it["youtube"] as? String,
            whatsapp = it["whatsapp"] as? String,
            telegram = it["telegram"] as? String
        )
    }

    @Suppress("UNCHECKED_CAST")
    val kycMap = data["kycDetails"] as? Map<String, Any?>
    val kycDetails = kycMap?.let {
        KycDetails(
            idType = it["idType"] as? String ?: "",
            idNumber = it["idNumber"] as? String ?: "",
            selfieUrl = it["selfieUrl"] as? String,
            status = it["status"] as? String ?: "none",
            submittedAt = it["submittedAt"] as? String
        )
    }

    @Suppress("UNCHECKED_CAST")
    val aiQuotaMap = data["aiQuota"] as? Map<String, Any?>
    val aiQuota = if (aiQuotaMap != null) {
        AiQuota(
            freeDailyLimit = (aiQuotaMap["freeDailyLimit"] as? Number)?.toLong() ?: 10,
            usedToday = (aiQuotaMap["usedToday"] as? Number)?.toLong() ?: 0,
            lastResetTime = aiQuotaMap["lastResetTime"] as? String ?: "",
            isSubscriber = aiQuotaMap["isSubscriber"] as? Boolean ?: false,
            plan = aiQuotaMap["plan"] as? String ?: AiPlanType.NONE,
            planLimit = (aiQuotaMap["planLimit"] as? Number)?.toLong(),
            planExpiresAt = aiQuotaMap["planExpiresAt"] as? String
        )
    } else {
        AiQuota(freeDailyLimit = 10, usedToday = 0, lastResetTime = Instant.now().toString(), isSubscriber = false, plan = AiPlanType.NONE)
    }

    @Suppress("UNCHECKED_CAST")
    val presenceMap = data["presence"] as? Map<String, Any?>
    val presence = presenceMap?.let {
        Presence(
            state = it["state"] as? String ?: "offline",
            lastHeartbeatAt = it["lastHeartbeatAt"] as? String,
            lastSeenAt = it["lastSeenAt"] as? String
        )
    }

    return User(
        id = id,
        email = email,
        fullName = str("fullName", "displayName", "name") ?: "مستخدم ليتيريوم",
        username = str("username") ?: (if (email.isNotBlank()) email.substringBefore("@") else "user_${id.take(5)}"),
        avatarUrl = str("avatarUrl", "photoURL", "photoUrl") ?: PlatformConstants.DEFAULT_AVATAR_URL,
        coverUrl = str("coverUrl") ?: PlatformConstants.DEFAULT_COVER_URL,
        role = role,
        bio = str("bio") ?: "",
        penName = str("penName"),
        companyName = str("companyName"),
        companyIndustry = str("companyIndustry"),
        companyWebsite = str("companyWebsite"),
        specialties = stringList("specialties"),
        isVerified = bool("isVerified") ?: (role == UserRole.ADMIN),
        isKycVerified = bool("isKycVerified"),
        isBanned = bool("isBanned"),
        kycDetails = kycDetails,
        aiQuota = aiQuota,
        socialLinks = socialLinks,
        followersCount = long("followersCount") ?: 0,
        followingCount = long("followingCount") ?: 0,
        articlesCount = long("articlesCount") ?: 0,
        totalViews = long("totalViews") ?: 0,
        totalEarnings = totalEarningsFallback,
        monthlyEarnings = num("monthlyEarnings") ?: 0.0,
        walletBalance = walletBalance,
        availableBalance = availableBalance,
        pendingEarnings = pendingEarnings,
        lifetimeEarnings = lifetimeEarnings,
        freeImagesUsedTotal = long("freeImagesUsedTotal"),
        joinedDate = joinedDate,
        createdAt = createdAt,
        isBot = bool("isBot"),
        presence = presence,
        blockedUserIds = stringList("blockedUserIds"),
        mutedUserIds = stringList("mutedUserIds"),
        stripeConnectedAccountId = str("stripeConnectedAccountId")
    )
}
