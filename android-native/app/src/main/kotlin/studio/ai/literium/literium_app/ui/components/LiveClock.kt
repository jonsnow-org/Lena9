package studio.ai.literium.literium_app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val TURKEY_ZONE: ZoneId = ZoneId.of("Europe/Istanbul")
private val SYRIA_ZONE: ZoneId = ZoneId.of("Asia/Damascus")
private val ARABIC_LOCALE = Locale.forLanguageTag("ar")
private val TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm:ss a", ARABIC_LOCALE)
private val DATE_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy", ARABIC_LOCALE)

/**
 * Live Turkey + Syria clock — exact port of `LiveClock.tsx` (spec §2.1). Both zones are computed
 * from real `ZoneId`s rather than assuming they always coincide, so this stays correct if either
 * region's offset ever diverges; when they read identically (currently both UTC+3) only one time is
 * shown, exactly like source's `sameTime` collapse.
 *
 * The 1-second ticker is isolated locally inside this one small composable (its own
 * [LaunchedEffect]) rather than hoisted into any shared state — the same isolation rationale
 * source's own code comment gives, so a per-second re-render never touches the rest of the shell.
 */
@Composable
fun LiveClock(modifier: Modifier = Modifier) {
    var now by remember { mutableStateOf(Instant.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = Instant.now()
            delay(1000)
        }
    }

    val turkeyTime = TIME_FORMATTER.format(now.atZone(TURKEY_ZONE))
    val syriaTime = TIME_FORMATTER.format(now.atZone(SYRIA_ZONE))
    val dateLabel = DATE_FORMATTER.format(now.atZone(TURKEY_ZONE))
    val sameTime = turkeyTime == syriaTime

    Column(
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f), RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        horizontalAlignment = Alignment.End
    ) {
        Text(
            text = if (sameTime) turkeyTime else "$turkeyTime | $syriaTime",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = dateLabel,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/** Pulsing green "platform is live" status dot — pure animation, no timer/JS-equivalent polling,
 *  matching `LiveStatusDot` in source. Source hides its "مباشر" label below the `sm:` breakpoint
 *  (`hidden sm:inline`) — this app is always that mobile width, so the dot renders alone here too,
 *  exactly like the real mobile web layout, not a departure from it. */
@Composable
fun LiveStatusDot(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "liveStatusDot")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.75f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "pulseAlpha"
    )
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.9f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "pulseScale"
    )
    val emerald = Color(0xFF10B981)

    Row(
        modifier = modifier
            .background(emerald.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
            .padding(horizontal = 7.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center, modifier = Modifier.size(10.dp)) {
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .size(10.dp * pulseScale)
                    .background(emerald.copy(alpha = pulseAlpha), CircleShape)
            )
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(emerald, CircleShape)
            )
        }
    }
}
