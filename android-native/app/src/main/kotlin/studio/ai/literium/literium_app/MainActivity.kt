package studio.ai.literium.literium_app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import studio.ai.literium.literium_app.data.local.UserPreferencesRepository
import studio.ai.literium.literium_app.navigation.DeepLinkTarget
import studio.ai.literium.literium_app.navigation.LiteriumNavHost
import studio.ai.literium.literium_app.ui.theme.LiteriumTheme

/** Resolves an incoming intent's `Uri` into a navigation target, mirroring `App.tsx`'s own two
 *  deep-link entry points: `?article=<id>` (shared-article App Link, `getShareUrl`/`ArticleReader.tsx`)
 *  and `?mode=resetPassword&oobCode=<code>` (`getPasswordResetCodeFromUrl`/`firebase.ts`). Both arrive
 *  on the same verified App Link host declared in the manifest, so a single
 *  parser distinguishes them by query param rather than by path. */
private fun resolveDeepLink(uri: Uri?): DeepLinkTarget? {
    if (uri == null) return null
    val oobCode = uri.getQueryParameter("oobCode")
    if (uri.getQueryParameter("mode") == "resetPassword" && !oobCode.isNullOrBlank()) {
        return DeepLinkTarget.ResetPassword(oobCode)
    }
    val articleId = uri.getQueryParameter("article")
    if (!articleId.isNullOrBlank()) {
        return DeepLinkTarget.Article(articleId)
    }
    return null
}

class MainActivity : ComponentActivity() {

    private var deepLinkState = mutableStateOf<DeepLinkTarget?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        deepLinkState.value = resolveDeepLink(intent?.data)

        setContent {
            val deepLink by deepLinkState
            val userPreferencesRepository = remember { UserPreferencesRepository(this) }
            // اللغة تفضيل خاص بهذا الجهاز/المستخدم فقط (بلا مزامنة حية عبر Firestore، خلافاً لقالب
            // الألوان الإداري) — نفس تفرقة App.tsx بين `literium_lang` (محلي) و`settings/theme`
            // (عام). عربي (RTL) هو الافتراضي طالما لم يُغيَّر صراحة، مطابقاً لسلوك الموقع.
            val languageCode by userPreferencesRepository.languageCode.collectAsState(initial = "ar")
            val layoutDirection = if (languageCode == "ar") LayoutDirection.Rtl else LayoutDirection.Ltr

            // المظهر الداكن/الفاتح تفضيل محلي حقيقي أيضاً (`App.tsx`'s `theme` state) — يتبع نظام
            // الجهاز افتراضياً حتى يُغيَّر صراحة من القائمة الجانبية، عندها يبقى ثابتاً بصرف النظر
            // عن نظام الجهاز.
            val systemDark = isSystemInDarkTheme()
            val darkModeOverride by userPreferencesRepository.darkModeOverride.collectAsState(initial = null)

            CompositionLocalProvider(LocalLayoutDirection provides layoutDirection) {
                LiteriumTheme(darkTheme = darkModeOverride ?: systemDark) {
                    Surface(modifier = Modifier.fillMaxSize()) {
                        LiteriumNavHost(
                            deepLinkTarget = deepLink,
                            onDeepLinkConsumed = { deepLinkState.value = null }
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        resolveDeepLink(intent.data)?.let { deepLinkState.value = it }
    }
}
