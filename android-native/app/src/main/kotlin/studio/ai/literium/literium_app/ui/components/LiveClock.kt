package studio.ai.literium.literium_app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import studio.ai.literium.literium_app.ui.theme.CairoFamily
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import java.time.Instant
import java.time.ZoneId

private val TURKEY_ZONE: ZoneId = ZoneId.of("Europe/Istanbul")
private val SYRIA_ZONE: ZoneId = ZoneId.of("Asia/Damascus")

private const val ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
private fun arabicDigits(s: String) = buildString { s.forEach { append(if (it in '0'..'9') ARABIC_DIGITS[it - '0'] else it) } }

/** `toLocaleTimeString('ar', {hour:'numeric', minute:'2-digit', second:'2-digit', hour12:false})`. */
private fun clockText(now: Instant, zone: ZoneId): String {
    val z = now.atZone(zone)
    return arabicDigits("%d:%02d:%02d".format(z.hour, z.minute, z.second))
}

/** `toLocaleDateString('ar-SY', {day:'numeric', month:'numeric'})` ⇒ «٩‏/١١». */
private fun dateText(now: Instant): String {
    val z = now.atZone(TURKEY_ZONE)
    return arabicDigits("${z.dayOfMonth}‏/${z.monthValue}")
}

/**
 * مطابق لـ LiveClock.tsx: صندوق px-2 py-1 rounded-xl بخلفية slate-100/95 وإطار slate-300/80، الوقت
 * mono 11px font-black، والتاريخ 9px semibold. الساعة تتحدّث محلياً كل ثانية فقط (لا إعادة رسم للشاشة).
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
    val turkeyTime = clockText(now, TURKEY_ZONE)
    val syriaTime = clockText(now, SYRIA_ZONE)
    val sameTime = turkeyTime == syriaTime
    val dark = isDark
    val shape = RoundedCornerShape(12.dp)

    Column(
        modifier = modifier
            .background(if (dark) Tw.slate900.copy(alpha = 0.90f) else Tw.slate100.copy(alpha = 0.95f), shape)
            .border(1.dp, if (dark) brand.s500.copy(alpha = 0.30f) else Tw.slate300.copy(alpha = 0.80f), shape)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        val mono = TextStyle(
            fontFamily = FontFamily.Monospace, fontSize = 11.sp, lineHeight = 11.sp, fontWeight = FontWeight.Black,
            letterSpacing = (-0.275).sp
        )
        if (sameTime) {
            Text(
                turkeyTime, style = mono,
                color = if (dark) Tw.teal300 else Tw.teal700
            )
        } else {
            Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(4.dp)) {
                val c = if (dark) Tw.emerald300 else Tw.slate900
                Text(turkeyTime, style = mono, color = c)
                Text("|", style = mono.copy(fontWeight = FontWeight.Normal), color = if (dark) Tw.slate600 else Tw.slate400)
                Text(syriaTime, style = mono, color = c)
            }
        }
        Text(
            dateText(now),
            modifier = Modifier.padding(top = 2.dp),
            style = TextStyle(
                fontFamily = CairoFamily, fontSize = 9.sp, lineHeight = 9.sp, fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.225).sp
            ),
            color = if (dark) Tw.slate300 else Tw.slate600
        )
    }
}

/** نقطة «المنصة متصلة» النابضة — مطابقة لـ LiveStatusDot (التسمية «مباشر» مخفية على الهاتف كما في الويب). */
@Composable
fun LiveStatusDot(modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "ping")
    // animate-ping: scale 1→2 وشفافية .75→0 خلال 1s بمنحنى cubic-bezier(0,0,.2,1)
    val p by t.animateFloat(
        0f, 1f,
        infiniteRepeatable(tween(1000, easing = androidx.compose.animation.core.CubicBezierEasing(0f, 0f, 0.2f, 1f)), RepeatMode.Restart),
        label = "p"
    )
    val dark = isDark
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier = modifier
            .background(if (dark) Tw.emerald950.copy(alpha = 0.50f) else Tw.emerald50.copy(alpha = 0.90f), shape)
            .border(1.dp, if (dark) Color_emerald700_60 else Tw.emerald300.copy(alpha = 0.80f), shape)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.size(8.dp), contentAlignment = Alignment.Center) {
            Box(
                Modifier
                    .size(8.dp)
                    .graphicsLayer { val s = 1f + p; scaleX = s; scaleY = s; alpha = 0.75f * (1f - p) }
                    .background(Tw.emerald400, CircleShape)
            )
            Box(Modifier.size(8.dp).background(Tw.emerald500, CircleShape))
        }
    }
}

private val Color_emerald700_60 = Tw.emerald700.copy(alpha = 0.60f)
