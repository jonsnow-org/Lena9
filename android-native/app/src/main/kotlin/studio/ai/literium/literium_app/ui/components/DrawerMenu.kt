package studio.ai.literium.literium_app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.local.UserPreferencesRepository
import studio.ai.literium.literium_app.data.model.AiQuota
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.model.UserRole
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.CairoFamily
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import java.time.Instant
import java.time.temporal.ChronoUnit

private fun t(size: TextUnit, weight: FontWeight, lh: TextUnit = TextUnit.Unspecified, mono: Boolean = false) = TextStyle(
    fontFamily = if (mono) FontFamily.Monospace else CairoFamily, fontSize = size, fontWeight = weight, lineHeight = lh
)

/**
 * القائمة الجانبية — نسخة طبق الأصل من DrawerMenu.tsx: طبقة قاتمة slate-950/70 + لوحة بعرض
 * max-w-sm (384dp) على جهة end (يسار في RTL) بخلفية slate-900 دائماً (في الوضعين) وحد brand-500/20.
 * الأقسام: رأس المستخدم، بطاقة الزائر، حصة المساعد الذكي، الروابط، الصفحات القانونية، المظهر،
 * اللغة، ثم تسجيل الدخول/الخروج وسطر النسخة.
 */
@Composable
fun DrawerOverlay(
    open: Boolean,
    currentUser: User?,
    isGuestOrSignedOut: Boolean,
    isAdmin: Boolean,
    onClose: () -> Unit,
    onNavigate: (String) -> Unit,
    onOpenProfile: () -> Unit,
    onLogin: () -> Unit,
    onLogout: () -> Unit
) {
    val rtl = androidx.compose.ui.platform.LocalLayoutDirection.current == androidx.compose.ui.unit.LayoutDirection.Rtl
    val dir = if (rtl) -1 else 1
    Box(Modifier.fillMaxSize()) {
        AnimatedVisibility(visible = open, enter = fadeIn(tween(200)), exit = fadeOut(tween(200))) {
            Box(
                Modifier.fillMaxSize().background(Tw.slate950.copy(alpha = 0.70f)).twClickable(onClick = onClose)
            )
        }
        AnimatedVisibility(
            visible = open,
            modifier = Modifier.align(Alignment.CenterEnd),
            // animate-slide-in-right: تنزلق من خارج الحافة (end) إلى مكانها
            enter = slideInHorizontally(tween(300)) { full -> full * dir },
            exit = slideOutHorizontally(tween(250)) { full -> full * dir }
        ) {
            DrawerPanel(currentUser, isGuestOrSignedOut, isAdmin, onClose, onNavigate, onOpenProfile, onLogin, onLogout)
        }
    }
}

private fun refreshedQuotaRemaining(q: AiQuota?): Triple<Boolean, Long, Long> { // (unlimited, remaining, limit)
    val now = Instant.now()
    var subscriber = q?.isSubscriber == true
    var plan = q?.plan ?: "none"
    q?.planExpiresAt?.let { e -> runCatching { Instant.parse(e) }.getOrNull()?.let { if (now.isAfter(it)) { subscriber = false; plan = "none" } } }
    var used = q?.usedToday ?: 0L
    val last = runCatching { Instant.parse(q?.lastResetTime ?: "") }.getOrDefault(now)
    if (ChronoUnit.MINUTES.between(last, now) / 60.0 >= 24) used = 0
    if (subscriber && plan == "annual") return Triple(true, 9999, 9999)
    if (subscriber && plan == "monthly") { val l = q?.planLimit ?: 200L; return Triple(false, maxOf(0L, l - used), l) }
    val l = if ((q?.freeDailyLimit ?: 0L) > 0) q!!.freeDailyLimit else 10L
    return Triple(false, maxOf(0L, l - used), l)
}

@Composable
private fun DrawerPanel(
    currentUser: User?,
    isGuestOrSignedOut: Boolean,
    isAdmin: Boolean,
    onClose: () -> Unit,
    onNavigate: (String) -> Unit,
    onOpenProfile: () -> Unit,
    onLogin: () -> Unit,
    onLogout: () -> Unit
) {
    var showLogoutConfirm by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val prefs = remember { UserPreferencesRepository(context) }
    val scope = rememberCoroutineScope()
    val darkOverride by prefs.darkModeOverride.collectAsState(initial = null)
    val dark = isDark
    val lang by prefs.languageCode.collectAsState(initial = "ar")
    val guest = isGuestOrSignedOut
    val b = brand

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .widthIn(max = 384.dp)
            .fillMaxWidth()
            .background(Tw.slate900)
            // border-s: حد على جهة البداية من اللوحة (الجهة المواجهة للمحتوى)
            .drawStartBorder(b.s500.copy(alpha = 0.20f))
    ) {
        // ── Header: p-5 border-b brand-500/20 bg slate-950/80
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Tw.slate950.copy(alpha = 0.80f))
                .statusBarsPadding()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .clip(RoundedCornerShape(12.dp))
                    .twClickable(enabled = !guest) { onOpenProfile(); onClose() }
                    .padding(4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                val shape = RoundedCornerShape(16.dp)
                if (!currentUser?.avatarUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = currentUser!!.avatarUrl, contentDescription = null, contentScale = ContentScale.Crop,
                        modifier = Modifier.size(48.dp).clip(shape).border(2.dp, b.s500.copy(alpha = 0.40f), shape)
                    )
                } else {
                    Box(Modifier.size(48.dp).clip(shape).background(Tw.slate800).border(2.dp, b.s500.copy(alpha = 0.40f), shape), contentAlignment = Alignment.Center) {
                        LuIcon(Lu.User, 24.dp, Tw.slate400)
                    }
                }
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            if (guest) "زائر" else (currentUser?.fullName ?: ""),
                            style = t(14.sp, FontWeight.ExtraBold, 20.sp), color = Tw.white, maxLines = 1
                        )
                        if (currentUser?.isVerified == true) LuIcon(Lu.CheckCircle2, 14.dp, Color(0xFF60A5FA))
                    }
                    Text(
                        roleLabel(currentUser),
                        style = t(11.sp, FontWeight.Bold, 16.sp), color = b.s400
                    )
                }
            }
            Box(
                Modifier.clip(RoundedCornerShape(12.dp)).twClickable(onClick = onClose).padding(6.dp)
            ) { LuIcon(Lu.X, 20.dp, Tw.slate400) }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(b.s500.copy(alpha = 0.20f)))

        // ── Body
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            if (guest) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                        .background(b.s950.copy(alpha = 0.40f))
                        .border(1.dp, b.s500.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                        .padding(14.dp)
                ) {
                    Text("أنت تتصفح حالياً:", style = t(11.sp, FontWeight.Bold, 16.sp), color = b.s200, modifier = Modifier.padding(bottom = 4.dp))
                    Text("زائر (بدون تسجيل دخول)", style = t(14.sp, FontWeight.ExtraBold, 20.sp), color = Tw.white)
                }
            }

            // ── بطاقة حصة المساعد الذكي
            val (unlimited, remaining, _) = refreshedQuotaRemaining(currentUser?.aiQuota)
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                    .background(Brush.horizontalGradient(listOf(b.s950.copy(alpha = 0.60f), b.s950.copy(alpha = 0.60f))))
                    .border(1.dp, b.s500.copy(alpha = 0.30f), RoundedCornerShape(16.dp))
                    .padding(14.dp)
            ) {
                Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(Lu.Sparkles, 16.dp, b.s400)
                        Text("المساعد الذكي (Gemini AI)", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.white)
                    }
                    if (unlimited) {
                        Text(
                            "باقة غير محدودة ⭐",
                            modifier = Modifier.clip(CircleShape).background(b.s500.copy(alpha = 0.30f)).border(1.dp, b.s500.copy(alpha = 0.40f), CircleShape).padding(horizontal = 8.dp, vertical = 2.dp),
                            style = t(10.sp, FontWeight.Bold, 15.sp), color = b.s300
                        )
                    } else {
                        Text(
                            "$remaining استخدام متبقي",
                            modifier = Modifier.clip(CircleShape).background(b.s500.copy(alpha = 0.20f)).padding(horizontal = 8.dp, vertical = 2.dp),
                            style = t(10.sp, FontWeight.Bold, 15.sp), color = b.s300
                        )
                    }
                }
                Box(
                    Modifier.padding(top = 8.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(b.s600)
                        .twClickable { onNavigate(Screen.AiAssistant.route); onClose() }.padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) { Text("محادثة المساعد الذكي", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.white) }
            }

            // ── الروابط
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (!guest && !isAdmin) {
                    NavRow(Lu.Megaphone, Color(0xFF22D3EE), "إنشاء إعلان وترويج") { onNavigate(Screen.AdvertiserDashboard.route); onClose() }
                }
                if (!guest) {
                    NavRow(Lu.Wallet, Color(0xFF34D399), "المحفظة", trailingMono = "$" + "%.2f".format(currentUser?.walletBalance ?: 0.0)) { onNavigate(Screen.Wallet.route); onClose() }
                }
                if (!guest && isAdmin) {
                    NavRow(Lu.User, Color(0xFF60A5FA), "إدارة المستخدمين", chevron = true) { onNavigate(Screen.Admin.route); onClose() }
                }
                if (!guest && !isAdmin) {
                    NavRow(Lu.ShieldCheck, Color(0xFF60A5FA), "توثيق الهوية (KYC)", chevron = currentUser?.isKycVerified != true, badge = if (currentUser?.isKycVerified == true) "معتمد ✓" else null) {
                        onNavigate(Screen.Kyc.route); onClose()
                    }
                }
                NavRow(Lu.Scale, Tw.slate400, "السياسات والشروط ومكافحة الاحتيال", chevron = true) { onNavigate(Screen.Policies.of("privacy")); onClose() }
                if (!guest) {
                    NavRow(Lu.Bell, Color(0xFFFBBF24), "إعدادات الإشعارات", chevron = true) { onNavigate(Screen.Notifications.route); onClose() }
                }
                // استوديو توليد الصور: from-brand-950/60 via-slate-900 to-cyan-950/40 + border cyan-500/30
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                        .background(Brush.horizontalGradient(listOf(b.s950.copy(alpha = 0.60f), Tw.slate900, Color(0xFF083344).copy(alpha = 0.40f))))
                        .border(1.dp, Color(0xFF06B6D4).copy(alpha = 0.30f), RoundedCornerShape(16.dp))
                        .twClickable { onNavigate(Screen.ImageStudio.route); onClose() }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.weight(1f)) {
                        Box(
                            Modifier.clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(listOf(b.s500, Color(0xFF06B6D4)))).padding(6.dp)
                        ) { LuIcon(Lu.Wand2, 14.dp, Tw.white) }
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("استوديو توليد الصور (Gemini)", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.slate100)
                                Text(
                                    "AI",
                                    modifier = Modifier.clip(CircleShape).background(Color(0xFF06B6D4).copy(alpha = 0.20f)).border(1.dp, Color(0xFF06B6D4).copy(alpha = 0.40f), CircleShape).padding(horizontal = 6.dp, vertical = 1.dp),
                                    style = t(9.sp, FontWeight.Black, 13.sp), color = Tw.cyan300
                                )
                            }
                            Text("أغلفة مقالات ولوحات فنية ذكية", style = t(10.sp, FontWeight.Normal, 15.sp), color = Tw.slate400)
                        }
                    }
                    // rtl:rotate-0 ⇒ ChevronLeft كما هو
                    LuIcon(Lu.ChevronLeft, 16.dp, Color(0xFF22D3EE))
                }

                // الصفحات القانونية: pt-2 mt-2 border-t slate-800 grid-cols-2 gap-1.5
                Column(Modifier.padding(top = 8.dp)) {
                    Box(Modifier.fillMaxWidth().height(1.dp).background(Tw.slate800))
                    Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(
                            listOf("privacy" to "سياسة الخصوصية", "terms" to "شروط الاستخدام"),
                            listOf("about" to "من نحن", "contact" to "اتصل بنا")
                        ).forEach { rowItems ->
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                rowItems.forEach { (id, label) ->
                                    Text(
                                        label,
                                        modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                                            .twClickable { onNavigate(Screen.Policies.of(id)); onClose() }.padding(10.dp),
                                        style = t(11.sp, FontWeight.Bold, 16.sp), color = Tw.slate300
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── المظهر واللغة: px-4 pb-2 space-y-2
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val cardShape = RoundedCornerShape(16.dp)
            Row(
                Modifier.fillMaxWidth().clip(cardShape).background(Tw.slate900.copy(alpha = 0.60f)).border(1.dp, Tw.slate800, cardShape)
                    .twClickable { scope.launch { prefs.setDarkModeOverride(!dark) } }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (dark) LuIcon(Lu.Moon, 16.dp, b.s400) else LuIcon(Lu.Sun, 16.dp, Color(0xFFFBBF24))
                    Text("المظهر: ${if (dark) "داكن" else "فاتح"}", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.slate200)
                }
                Text(if (lang == "ar") "تبديل" else "Switch", style = t(10.sp, FontWeight.Normal, 15.sp), color = Tw.slate400)
            }
            Column(Modifier.fillMaxWidth().clip(cardShape).background(Tw.slate900.copy(alpha = 0.60f)).border(1.dp, Tw.slate800, cardShape).padding(12.dp)) {
                Row(Modifier.padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LuIcon(Lu.Globe, 16.dp, Color(0xFF22D3EE))
                    Text("اللغة", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.slate200)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("ar" to "AR", "en" to "EN", "fr" to "FR", "es" to "ES", "zh" to "中文").forEach { (code, label) ->
                        val sel = lang == code
                        val s = RoundedCornerShape(12.dp)
                        Box(
                            Modifier.weight(1f).clip(s)
                                .then(if (sel) Modifier.background(Color(0xFF0891B2)) else Modifier.background(Tw.slate950).border(1.dp, Tw.slate800, s))
                                .twClickable { scope.launch { prefs.setLanguageCode(code) } }.padding(vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) { Text(label, style = t(11.sp, FontWeight.Bold, 16.sp), color = if (sel) Tw.white else Tw.slate400) }
                    }
                }
            }
        }

        // ── Footer: p-4 border-t brand-500/20 bg slate-950/80
        Box(Modifier.fillMaxWidth().height(1.dp).background(b.s500.copy(alpha = 0.20f)))
        Column(
            Modifier.fillMaxWidth().background(Tw.slate950.copy(alpha = 0.80f)).navigationBarsPadding().padding(16.dp)
        ) {
            val btn = RoundedCornerShape(12.dp)
            if (guest) {
                Row(
                    Modifier.fillMaxWidth().clip(btn).background(b.s600).twClickable { onClose(); onLogin() }.padding(vertical = 10.dp),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
                ) {
                    LuIcon(Lu.User, 16.dp, Tw.white); Box(Modifier.width(8.dp))
                    Text("تسجيل الدخول / إنشاء حساب", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.white)
                }
            } else if (showLogoutConfirm) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("هل تريد تسجيل الخروج؟", Modifier.fillMaxWidth(), style = t(12.sp, FontWeight.Bold, 16.sp).copy(textAlign = TextAlign.Center), color = Color(0xFFFCD34D))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1f).clip(btn).background(Color(0xFFDC2626)).twClickable { onLogout(); onClose() }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                            Text("تسجيل الخروج", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.white)
                        }
                        Box(Modifier.weight(1f).clip(btn).background(Tw.slate800).twClickable { showLogoutConfirm = false }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                            Text("إلغاء", style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.slate300)
                        }
                    }
                }
            } else {
                Row(
                    Modifier.fillMaxWidth().clip(btn).background(Color(0xFFEF4444).copy(alpha = 0.10f)).twClickable { showLogoutConfirm = true }.padding(vertical = 10.dp),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
                ) {
                    LuIcon(Lu.LogOut, 16.dp, Color(0xFFF87171)); Box(Modifier.width(8.dp))
                    Text("تسجيل الخروج", style = t(12.sp, FontWeight.Bold, 16.sp), color = Color(0xFFF87171))
                }
            }
            Text(
                "build v0.0.12-fix11",
                Modifier.fillMaxWidth().padding(top = 12.dp),
                style = t(10.sp, FontWeight.Normal, 15.sp, mono = true).copy(textAlign = TextAlign.Center), color = Tw.slate600
            )
        }
    }
}

@Composable
private fun NavRow(
    icon: ImageVector, iconTint: Color, label: String,
    chevron: Boolean = false, trailingMono: String? = null, badge: String? = null,
    onClick: () -> Unit
) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).twClickable(onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LuIcon(icon, 16.dp, iconTint)
            Text(label, style = t(12.sp, FontWeight.Bold, 16.sp), color = Tw.slate200)
        }
        if (trailingMono != null) Text(trailingMono, style = t(11.sp, FontWeight.Bold, 16.sp, mono = true), color = Color(0xFF34D399))
        if (badge != null) Text(
            badge,
            Modifier.clip(CircleShape).background(Tw.emerald500.copy(alpha = 0.20f)).border(1.dp, Tw.emerald500.copy(alpha = 0.30f), CircleShape).padding(horizontal = 8.dp, vertical = 2.dp),
            style = t(10.sp, FontWeight.Bold, 15.sp), color = Tw.emerald300
        )
        if (chevron) LuIcon(Lu.ChevronLeft, 16.dp, Tw.slate400)
    }
}

private fun roleLabel(u: User?): String = when (u?.role) {
    UserRole.ADMIN -> "👑 مالك المنصة (Admin)"
    UserRole.ADVERTISER -> "📢 معلن وشريك أعمال"
    else -> "📖 قارئ مسجل"
}

/** border-s: خط 1dp على الجهة المقابلة لحافة الشاشة التي تلتصق بها اللوحة (جهة end). */
private fun Modifier.drawStartBorder(color: Color): Modifier = this.drawBehind {
    val w = 1.dp.toPx()
    val rtl = layoutDirection == androidx.compose.ui.unit.LayoutDirection.Rtl
    val x = if (rtl) size.width - w else 0f
    drawRect(color, topLeft = androidx.compose.ui.geometry.Offset(x, 0f), size = androidx.compose.ui.geometry.Size(w, size.height))
}
