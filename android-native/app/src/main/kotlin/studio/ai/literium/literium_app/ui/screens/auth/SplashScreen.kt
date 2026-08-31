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

/** Minimum time the branded splash stays on screen, even if auth resolves instantly — a much
 *  shorter, native-appropriate stand-in for the web's ~3.2s canvas/Web-Audio splash (spec §2.1);
 *  see this scope's final report for why the visual itself is simplified, not a literal port. */
private const val MIN_SPLASH_MILLIS = 1100L

/**
 * One-time branded splash shown on cold app load (spec §2.1's `SplashScreen`) — purely cosmetic,
 * never a gate. Resolves [AuthRepository.authState] once and routes accordingly:
 *
 * - A real (non-anonymous) signed-in Firebase user → [onNavigateToFeed] directly, matching
 *   `App.tsx`'s `onAuthStateChanged` handler which always lands a returning session on the feed
 *   tab (spec §3.3), never re-prompting for login.
 * - No real session (fully signed out, or only an anonymous guest identity already on file) →
 *   silently establishes/confirms a guest identity via [AuthRepository.ensureGuestIdentity] and
 *   still routes to [onNavigateToFeed] — per spec §2.2/§3.3, guests browse Home/Explore freely
 *   with no login wall at startup; the web app's header merely offers a "تسجيل الدخول" button for
 *   when a guest later chooses to authenticate, it never forces the login screen up front.
 * - [onNavigateToLogin] is reserved for the one case guest browsing itself can't recover from: the
 *   anonymous-identity bootstrap failing outright (e.g. Anonymous Auth unreachable/misconfigured),
 *   so the visitor isn't left stranded on a splash that can never resolve.
 *
 * Tapping the splash early (per spec §2.1, "dismissible early by tapping") skips the minimum
 * display time and resolves immediately.
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
            val authDeferred = async {
                runCatching { authRepository.authState().firstOrNull() }.getOrNull()
            }
            var waited = 0L
            while (waited < MIN_SPLASH_MILLIS && !skipRequested) {
                delay(50)
                waited += 50
            }
            val fbUser = authDeferred.await()
            if (fbUser != null && !fbUser.isAnonymous) {
                onNavigateToFeed()
            } else {
                val guestResult = authRepository.ensureGuestIdentity()
                if (guestResult.isSuccess) onNavigateToFeed() else onNavigateToLogin()
            }
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "splash")
    val ringRotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(3600, easing = LinearEasing)),
        label = "ringRotation"
    )
    val pulse by infiniteTransition.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), repeatMode = RepeatMode.Reverse),
        label = "pulse"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0F172A), BrandTeal.copy(alpha = 0.55f), Color(0xFF0F172A))))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) { skipRequested = true },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(contentAlignment = Alignment.Center) {
                // Orbiting ring — a simplified stand-in for the web splash's moon/stars/orbiting-rings
                // canvas animation (spec §2.1); see this scope's final report.
                Box(
                    modifier = Modifier
                        .size(128.dp)
                        .rotate(ringRotation)
                        .background(Color.Transparent)
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .align(Alignment.TopCenter)
                            .background(BrandAmber, CircleShape)
                    )
                }
                Box(
                    modifier = Modifier
                        .size(88.dp * pulse)
                        .background(BrandTealLight.copy(alpha = 0.25f), CircleShape)
                )
                Box(
                    modifier = Modifier
                        .size(76.dp)
                        .background(Color.White, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.MenuBook,
                        contentDescription = null,
                        tint = BrandTeal,
                        modifier = Modifier.size(38.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "LITERIUM",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 2.sp
            )
            Text(
                text = "ليتيريوم — فضاء الأدب والفكر",
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
            Spacer(modifier = Modifier.height(28.dp))
            CircularProgressIndicator(color = BrandAmber, modifier = Modifier.size(22.dp))
        }
    }
}
