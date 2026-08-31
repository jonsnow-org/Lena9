package studio.ai.literium.literium_app.data.local

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "literium_user_prefs")

/**
 * Per-device, per-user local preferences — the counterpart to
 * [studio.ai.literium.literium_app.ui.theme.LiteriumTheme]'s live *admin* color/background system.
 * Ports `App.tsx`'s own `localStorage.setItem('literium_theme', ...)`/`literium_lang` `useEffect`s
 * exactly: **not** Firestore-synced, since each of these is a personal device setting the web itself
 * only ever persists to `localStorage`, never broadcasts to other users or devices.
 *
 * Dark/light here is the genuine per-user override `App.tsx`'s own `theme` state drives
 * (`document.documentElement.classList.toggle('dark')`) — distinct from the admin-controlled color
 * *palette* ([studio.ai.literium.literium_app.ui.theme.THEME_PRESETS]), which stays live-synced.
 *
 * Language persistence here only stores the chosen code and flips layout direction (RTL/LTR) —
 * `translations.kt`, the actual per-string dictionary the web's own i18n coverage is honestly
 * "shallow" on too (spec §13.5), is not part of this scope.
 */
class UserPreferencesRepository(context: Context) {
    private val dataStore = context.applicationContext.dataStore

    private object Keys {
        val DARK_MODE_OVERRIDE = booleanPreferencesKey("dark_mode_override")
        val HAS_DARK_MODE_OVERRIDE = booleanPreferencesKey("has_dark_mode_override")
        val LANGUAGE_CODE = stringPreferencesKey("language_code")
    }

    /** Null = follow system light/dark (this device's own default, never set explicitly). */
    val darkModeOverride: Flow<Boolean?> = dataStore.data.map { prefs ->
        if (prefs[Keys.HAS_DARK_MODE_OVERRIDE] == true) prefs[Keys.DARK_MODE_OVERRIDE] else null
    }

    suspend fun setDarkModeOverride(isDark: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.DARK_MODE_OVERRIDE] = isDark
            prefs[Keys.HAS_DARK_MODE_OVERRIDE] = true
        }
    }

    val languageCode: Flow<String> = dataStore.data.map { prefs -> prefs[Keys.LANGUAGE_CODE] ?: "ar" }

    suspend fun setLanguageCode(code: String) {
        dataStore.edit { prefs -> prefs[Keys.LANGUAGE_CODE] = code }
    }
}
