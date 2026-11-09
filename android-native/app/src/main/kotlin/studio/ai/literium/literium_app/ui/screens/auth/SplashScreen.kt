package studio.ai.literium.literium_app.ui.screens.auth

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.firstOrNull
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.ui.theme.BrandAmber
import studio.ai.literium.literium_app.ui.theme.BrandTeal
import studio.ai.literium.literium_app.ui.theme.BrandTealLight

/** الحد الأدنى لعرض شاشة البداية. */
private const val MIN_SPLASH_MILLIS = 900L

/**
 * شاشة البداية — مطابقة لشاشة التحميل الحالية للتطبيق (خلفية #0D2968 + شعار 140dp + مؤشر أبيض).
 * التوجيه كما في التطبيق المثبَّت على الويب: جلسة حقيقية ⇒ الرئيسية، وبدونها ⇒ شاشة الدخول الإلزامية
 * (لا تصفّح كزائر في التطبيق، App.tsx `showLandingPage && isNativeApp`).
 */
@Composable
fun SplashScreen(
    onNavigateToFeed: () -> Unit,
    onNavigateToLogin: () -> Unit,
    authRepository: AuthRepository = remember { AuthRepository() }
) {
    var skipRequested by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        coroutineScope {
            val authDeferred = async { runCatching { authRepository.authState().firstOrNull() }.getOrNull() }
            var waited = 0L
            while (waited < MIN_SPLASH_MILLIS && !skipRequested) { delay(50); waited += 50 }
            val fbUser = authDeferred.await()
            if (fbUser != null && !fbUser.isAnonymous) onNavigateToFeed() else onNavigateToLogin()
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0D2968))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { skipRequested = true },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            androidx.compose.foundation.Image(
                painter = androidx.compose.ui.res.painterResource(id = studio.ai.literium.literium_app.R.drawable.ic_launcher_foreground),
                contentDescription = null, modifier = Modifier.size(140.dp)
            )
            CircularProgressIndicator(color = Color.White, modifier = Modifier.padding(top = 24.dp).size(32.dp))
        }
    }
}
