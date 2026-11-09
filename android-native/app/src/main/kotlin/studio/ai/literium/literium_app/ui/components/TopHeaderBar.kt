package studio.ai.literium.literium_app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.R
import studio.ai.literium.literium_app.ui.theme.CairoFamily
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable

/**
 * الشريط العلوي — نسخة طبق الأصل من TopHeader.tsx: ارتفاع h-14 (56dp)، px-3، خلفية white/98
 * (dark: slate-950/98)، حد سفلي slate-200/90 (dark: brand-500/20)، وأزرار rounded-2xl بإطار.
 * الترتيب (RTL): زر القائمة + الشعار على البداية، [جرس الأدمن]، ثم الساعة + نقطة الحالة + دخول الزائر.
 */
@Composable
fun TopHeaderBar(
    isAdmin: Boolean,
    isGuestOrSignedOut: Boolean,
    unreadNotifications: Int,
    onOpenDrawer: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenLogin: () -> Unit,
    onBrandClick: () -> Unit
) {
    val dark = isDark
    val borderColor = if (dark) brand.s500.copy(alpha = 0.20f) else Tw.slate200.copy(alpha = 0.90f)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (dark) Tw.slate950.copy(alpha = 0.98f) else Tw.white.copy(alpha = 0.98f))
            .statusBarsPadding()
    ) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            Row(
                modifier = Modifier
                    .widthIn(max = 1280.dp)
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Start: زر القائمة + الشعار
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconSquareButton(onClick = onOpenDrawer) { LuIcon(Lu.Menu, 20.dp, if (dark) Tw.slate200 else Tw.slate700) }
                    Row(
                        modifier = Modifier.twClickable(onClick = onBrandClick),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Image(
                            painter = painterResource(R.drawable.web_icon),
                            contentDescription = "LITERIUM",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(32.dp)
                                .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = brand.s600.copy(alpha = 0.2f), spotColor = brand.s600.copy(alpha = 0.2f))
                                .clip(RoundedCornerShape(16.dp))
                                .border(2.dp, brand.s500.copy(alpha = 0.30f), RoundedCornerShape(16.dp))
                        )
                        Text(
                            "LITERIUM",
                            style = TextStyle(
                                fontFamily = CairoFamily, fontSize = 16.sp, lineHeight = 16.sp,
                                fontWeight = FontWeight.Black, letterSpacing = (-0.4).sp
                            ),
                            color = if (dark) Tw.white else Tw.slate900
                        )
                    }
                }

                // الوسط: جرس الإشعارات للأدمن فقط
                if (!isGuestOrSignedOut && isAdmin) {
                    Box {
                        IconSquareButton(onClick = onOpenNotifications) {
                            LuIcon(Lu.Bell, 20.dp, if (dark) Tw.slate200 else Tw.slate700)
                        }
                        if (unreadNotifications > 0) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 4.dp, y = (-4).dp)
                                    .height(16.dp)
                                    .widthIn(min = 16.dp)
                                    .background(Tw.rose500, CircleShape)
                                    .padding(horizontal = 4.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    if (unreadNotifications > 9) "9+" else unreadNotifications.toString(),
                                    color = Tw.white,
                                    style = TextStyle(fontFamily = CairoFamily, fontSize = 9.sp, lineHeight = 9.sp, fontWeight = FontWeight.Bold)
                                )
                            }
                        }
                    }
                }

                // End: الساعة + نقطة الحالة + دخول الزائر
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LiveClock()
                    LiveStatusDot()
                    if (isGuestOrSignedOut) {
                        Row(
                            modifier = Modifier
                                .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = brand.s600.copy(alpha = 0.3f), spotColor = brand.s600.copy(alpha = 0.3f))
                                .clip(RoundedCornerShape(16.dp))
                                .background(Brush.horizontalGradient(listOf(brand.s600, brand.s600)))
                                .twClickable(pressScale = 0.95f, onClick = onOpenLogin)
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            LuIcon(Lu.LogIn, 14.dp, Tw.white)
                            Text(
                                "تسجيل الدخول",
                                color = Tw.white,
                                style = TextStyle(fontFamily = CairoFamily, fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Black)
                            )
                        }
                    }
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(borderColor))
    }
}

/** w-10 h-10 rounded-2xl بإطار border-slate-200 (dark: brand-500/20) — زر الرأس القياسي. */
@Composable
private fun IconSquareButton(onClick: () -> Unit, content: @Composable () -> Unit) {
    val dark = isDark
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, if (dark) brand.s500.copy(alpha = 0.20f) else Tw.slate200, RoundedCornerShape(16.dp))
            .twClickable(pressScale = 0.95f, onClick = onClick),
        contentAlignment = Alignment.Center
    ) { content() }
}
