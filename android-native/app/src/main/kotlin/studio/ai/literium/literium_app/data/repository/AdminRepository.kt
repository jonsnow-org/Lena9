package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.BotActivityLogEntry
import studio.ai.literium.literium_app.data.model.BotPublishedItem
import studio.ai.literium.literium_app.data.model.ThemeSettingsData
import studio.ai.literium.literium_app.data.model.User
import java.time.Instant

/**
 * Cross-cutting admin operations that don't naturally belong to one
 * content/finance domain: the full user directory, verification/ban
 * toggles, live theme + platform-ads + external-ad-network settings, and
 * the publishing-bots subsystem (spec §4.20/§4.26/§4.28/§4.29). Ports the
 * matching sections of `firestoreService.ts`.
 *
 * Every write here is gated by firestore.rules' `isAdmin()` predicate —
 * see [WalletRepository]'s file KDoc for the broader implication (spec
 * §11.9): these are plain client Firestore writes, not server endpoints.
 *
 * Other admin-relevant operations live in their more specific domain
 * repository rather than being duplicated here:
 * article/campaign moderation → [ArticleRepository]/[AdCampaignRepository];
 * KYC review → [KycRepository]; money/balance → [WalletRepository];
 * broadcast messaging + conversation oversight → [MessageRepository].
 *
 * Failure convention: see [safeCall]'s file KDoc.
 */
class AdminRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val usersCol get() = firestore.collection(FirestoreCollections.USERS)
    private val settingsCol get() = firestore.collection(FirestoreCollections.Settings.COLLECTION)
    private val botActivityLogCol get() = firestore.collection(FirestoreCollections.BOT_ACTIVITY_LOG)

    // ---- User directory (admin management + the public writer directory) ----

    /** Every user document on the platform, mapped through the same fallback-aware mapper as
     *  [AuthRepository.fetchUserFromFirestore]/[AuthRepository.observeUser] so admin and self views can never disagree. */
    fun observeAllUsers(): Flow<List<User>> = callbackFlow {
        val registration = usersCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.documents?.map { mapFirestoreUserDocument(it.id, it.data ?: emptyMap()) }.orEmpty())
        }
        awaitClose { registration.remove() }
    }

    suspend fun setUserVerified(userId: String, isVerified: Boolean): Result<Unit> = safeCall {
        usersCol.document(userId).update("isVerified", isVerified).await()
        Unit
    }

    suspend fun setUserBanned(userId: String, isBanned: Boolean): Result<Unit> = safeCall {
        usersCol.document(userId).update("isBanned", isBanned).await()
        Unit
    }

    /** Unlike [AuthRepository.switchActiveRole] (self-service, restricted to reader/writer/advertiser),
     *  an admin may set ANY role — including `admin` — on any account; firestore.rules imposes no field
     *  restriction on the `isAdmin()` branch of `users/{userId}` updates. */
    suspend fun adminSetUserRole(userId: String, role: String): Result<Unit> = safeCall {
        usersCol.document(userId).update("role", role).await()
        Unit
    }

    // ---- Live theme settings (settings/theme — public read, admin write) ----

    fun observeThemeSettings(): Flow<ThemeSettingsData> = callbackFlow {
        val registration = settingsCol.document(FirestoreCollections.Settings.THEME_DOC).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            if (snap != null && snap.exists()) {
                trySend(ThemeSettingsData(preset = snap.getString("preset"), backgroundPreset = snap.getString("backgroundPreset")))
            } else {
                trySend(ThemeSettingsData())
            }
        }
        awaitClose { registration.remove() }
    }

    suspend fun setThemePreset(preset: String, updatedByUserId: String): Result<Unit> = safeCall {
        settingsCol.document(FirestoreCollections.Settings.THEME_DOC).set(
            mapOf("preset" to preset, "updatedAt" to Instant.now().toString(), "updatedBy" to updatedByUserId),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        Unit
    }

    suspend fun setBackgroundPreset(backgroundPreset: String, updatedByUserId: String): Result<Unit> = safeCall {
        settingsCol.document(FirestoreCollections.Settings.THEME_DOC).set(
            mapOf("backgroundPreset" to backgroundPreset, "updatedAt" to Instant.now().toString(), "updatedBy" to updatedByUserId),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        Unit
    }

    // ---- Platform-wide ads on/off switch (settings/platformAds — public read, admin write) ----

    fun observePlatformAdsEnabled(): Flow<Boolean> = callbackFlow {
        val registration = settingsCol.document(FirestoreCollections.Settings.PLATFORM_ADS_DOC).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.getBoolean("enabled") ?: false)
        }
        awaitClose { registration.remove() }
    }

    suspend fun setPlatformAdsEnabled(enabled: Boolean, updatedByUserId: String): Result<Unit> = safeCall {
        settingsCol.document(FirestoreCollections.Settings.PLATFORM_ADS_DOC).set(
            mapOf("enabled" to enabled, "updatedAt" to Instant.now().toString(), "updatedBy" to updatedByUserId),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        Unit
    }

    // ---- External ad-network fallback config (settings/externalAds — public read, admin write) ----

    /**
     * Raw config map for the external ad-network fallback (PropellerAds/Adsterra/Taboola HTML/JS
     * snippets, each with its own enable flag). Modeled as a raw `Map<String, Any?>` rather than a
     * typed data class: its real shape (`ExternalAdsConfig` in `src/utils/externalAdsStore.ts`) was
     * outside this pass's required reading set, so guessing at exact per-network field names here
     * would risk silently dropping/misnaming a field — a raw map preserves whatever the admin writes
     * losslessly. See the final report for this gap.
     */
    fun observeExternalAdsConfig(): Flow<Map<String, Any?>> = callbackFlow {
        val registration = settingsCol.document(FirestoreCollections.Settings.EXTERNAL_ADS_DOC).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.data ?: emptyMap())
        }
        awaitClose { registration.remove() }
    }

    suspend fun setExternalAdsConfig(config: Map<String, Any?>, updatedByUserId: String): Result<Unit> = safeCall {
        settingsCol.document(FirestoreCollections.Settings.EXTERNAL_ADS_DOC).set(
            config + mapOf("updatedAt" to Instant.now().toString(), "updatedBy" to updatedByUserId),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        Unit
    }

    // ---- Publishing bots (spec §4.28/§12.6) ----

    fun observePublishingBotsEnabled(): Flow<Boolean> = callbackFlow {
        val registration = settingsCol.document(FirestoreCollections.Settings.PUBLISHING_BOTS_DOC).addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(snap?.getBoolean("enabled") ?: false)
        }
        awaitClose { registration.remove() }
    }

    suspend fun setPublishingBotsEnabled(enabled: Boolean, updatedByUserId: String): Result<Unit> = safeCall {
        settingsCol.document(FirestoreCollections.Settings.PUBLISHING_BOTS_DOC).set(
            mapOf("enabled" to enabled, "updatedAt" to Instant.now().toString(), "updatedBy" to updatedByUserId),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        Unit
    }

    /** Admin-only read of the bot activity log — server-written only (Admin SDK), never client-writable. */
    suspend fun fetchRecentBotActivity(limitCount: Int = 30): Result<List<BotActivityLogEntry>> = safeCall {
        val snap = botActivityLogCol.orderBy("createdAt", Query.Direction.DESCENDING).limit(limitCount.toLong()).get().await()
        snap.documents.mapNotNull { it.toObject(BotActivityLogEntry::class.java)?.copy(id = it.id) }
    }

    /** Articles + tweets actually published by the given bot account ids — for the admin Bots tab
     *  content review list (spec §4.28). Firestore's `whereIn` caps at 10 values per query. */
    suspend fun fetchBotPublishedContent(botIds: List<String>): Result<List<BotPublishedItem>> = safeCall {
        if (botIds.isEmpty()) return@safeCall emptyList()
        val chunks = botIds.chunked(10)
        val items = mutableListOf<BotPublishedItem>()
        val articlesCol = firestore.collection(FirestoreCollections.ARTICLES)
        val tweetsCol = firestore.collection(FirestoreCollections.TWEETS)
        for (chunk in chunks) {
            val articlesSnap = articlesCol.whereIn("writerId", chunk).get().await()
            articlesSnap.documents.forEach { d ->
                items += BotPublishedItem(
                    id = d.id, type = "article",
                    title = d.getString("title") ?: "(بلا عنوان)",
                    createdAt = d.getString("publishedAt") ?: ""
                )
            }
            val tweetsSnap = tweetsCol.whereIn("authorId", chunk).get().await()
            tweetsSnap.documents.forEach { d ->
                items += BotPublishedItem(
                    id = d.id, type = "tweet",
                    title = d.getString("content") ?: "",
                    createdAt = d.getString("createdAt") ?: ""
                )
            }
        }
        items.sortedByDescending { it.createdAt }
    }

    /** Batch-deletes a mixed list of bot-published articles/tweets — chunked at 450 writes per batch
     *  (Firestore's hard limit is 500 per `WriteBatch`). */
    suspend fun deleteBotPublishedContentBatch(items: List<BotPublishedItem>): Result<Unit> = safeCall {
        if (items.isEmpty()) return@safeCall Unit
        val articlesCol = firestore.collection(FirestoreCollections.ARTICLES)
        val tweetsCol = firestore.collection(FirestoreCollections.TWEETS)
        items.chunked(450).forEach { chunk ->
            val batch = firestore.batch()
            chunk.forEach { item ->
                val ref = if (item.type == "article") articlesCol.document(item.id) else tweetsCol.document(item.id)
                batch.delete(ref)
            }
            batch.commit().await()
        }
        Unit
    }
}
