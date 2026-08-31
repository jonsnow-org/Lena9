package studio.ai.literium.literium_app.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.savedAccountsDataStore by preferencesDataStore(name = "literium_saved_accounts")

@Serializable
data class SavedAccount(
    val uid: String,
    val email: String,
    val fullName: String,
    val avatarUrl: String,
    val role: String,
    val lastUsedAt: String
)

/**
 * Kotlin port of `src/utils/savedAccounts.ts` — lets a returning user pick a previously-used account
 * on this device instead of retyping their email, without ever storing a password (the app still
 * always prompts for it, exactly like the web: "لا تُحفظ كلمات المرور على الجهاز — تُطلب في كل
 * مرة."). Distinct from Android's system-level Credential Manager/autofill (which only fills a
 * password field already on screen) — this drives the Login screen's own account-picker cards, the
 * same UX the web's `AuthModal` shows.
 */
class SavedAccountsRepository(context: Context) {
    private val dataStore = context.applicationContext.savedAccountsDataStore
    private val json = Json { ignoreUnknownKeys = true }

    private object Keys {
        val ACCOUNTS_JSON = stringPreferencesKey("saved_accounts_json")
    }

    private companion object {
        const val MAX_SAVED_ACCOUNTS = 5
    }

    val savedAccounts: Flow<List<SavedAccount>> = dataStore.data.map { prefs ->
        parseAccounts(prefs[Keys.ACCOUNTS_JSON])
    }

    private fun parseAccounts(raw: String?): List<SavedAccount> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching { json.decodeFromString<List<SavedAccount>>(raw) }
            .getOrDefault(emptyList())
            .sortedByDescending { it.lastUsedAt }
    }

    /** Adds an account or refreshes its data/`lastUsedAt` without disturbing the rest of the list. */
    suspend fun rememberAccount(uid: String, email: String, fullName: String, avatarUrl: String, role: String) {
        if (uid.isBlank() || email.isBlank()) return
        val current = savedAccounts.first().filter { it.uid != uid }
        val updated = (listOf(
            SavedAccount(
                uid = uid,
                email = email,
                fullName = fullName.ifBlank { email.substringBefore('@') },
                avatarUrl = avatarUrl,
                role = role.ifBlank { "reader" },
                lastUsedAt = java.time.Instant.now().toString()
            )
        ) + current).take(MAX_SAVED_ACCOUNTS)
        dataStore.edit { prefs -> prefs[Keys.ACCOUNTS_JSON] = json.encodeToString(updated) }
    }

    suspend fun forgetAccount(uid: String) {
        val remaining = savedAccounts.first().filter { it.uid != uid }
        dataStore.edit { prefs -> prefs[Keys.ACCOUNTS_JSON] = json.encodeToString(remaining) }
    }
}
