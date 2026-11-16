package studio.ai.literium.literium_app.ui.screens.aiassistant

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arDigits
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/**
 * المساعد الذكي — AiAssistantModal.tsx: ترويسة بتدرّج slate-950→teal-950→slate-900 مع شارة الحصّة، شريط اقتراحات،
 * فقاعات (أفاتار 32dp + max-w 82%)، شريط انتهاء الحصّة، وصف إدخال + زر إرسال teal-600.
 */
@Composable
fun AiAssistantScreen(
    navController: NavController,
    viewModel: AiAssistantViewModel = viewModel()
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val dark = isDark
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    LaunchedEffect(messages.size, isLoading) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size) }

    val user = currentUser
    val stats = user?.let { viewModel.quotaStats(it) }
    val outOfQuota = stats?.let { !it.isUnlimited && it.remaining <= 0 } ?: true
    val shell = RoundedCornerShape(24.dp)
    val line = if (dark) Tw.slate800 else Tw.slate200
    val teal = Color(0xFF14B8A6)

    fun send(text: String) {
        val u = user ?: run { navController.navigate(Screen.Login.route); return }
        if (outOfQuota) { navController.navigate(Screen.Subscription.route); return }
        if (text.isBlank() || isLoading) return
        viewModel.sendMessage(text, u); input = ""
    }

    Box(Modifier.fillMaxSize().padding(8.dp)) {
        Column(Modifier.fillMaxSize().shadow(16.dp, shell, clip = false).clip(shell).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, line, shell)) {
            // الترويسة
            Column(Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(Tw.slate950, Color(0xFF042F2E), Tw.slate900))).padding(horizontal = 20.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        val ib = RoundedCornerShape(16.dp)
                        Box(Modifier.size(36.dp).clip(ib).background(teal.copy(alpha = 0.20f)).border(1.dp, Color(0xFF2DD4BF).copy(alpha = 0.30f), ib), contentAlignment = Alignment.Center) { LuIcon(Lu.Sparkles, 20.dp, Color(0xFF5EEAD4)) }
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("المساعد الذكي ليتيريوم", style = twText(16, FontWeight.Black, 24), color = Tw.white)
                                Box(Modifier.clip(RoundedCornerShape(6.dp)).background(teal.copy(alpha = 0.30f)).padding(horizontal = 6.dp, vertical = 2.dp)) { Text("Gemini 3.7", style = twText(10, FontWeight.Bold, 14).copy(fontFamily = FontFamily.Monospace), color = Color(0xFF99F6E4)) }
                            }
                            Text("إرشاد مالي وثقافي وأدوات ذكية متكاملة", style = twText(11, FontWeight.Normal, 16), color = Color(0xFF99F6E4).copy(alpha = 0.90f))
                        }
                    }
                    Box(Modifier.twClickable { navController.popBackStack() }.padding(6.dp)) { LuIcon(Lu.X, 20.dp, Tw.slate300) }
                }
                if (user != null && stats != null) {
                    val qs = RoundedCornerShape(12.dp)
                    Row(Modifier.fillMaxWidth().clip(qs).background(Color.Black.copy(alpha = 0.25f)).border(1.dp, Color.White.copy(alpha = 0.10f), qs).padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (stats.isSubscriber) {
                                LuIcon(Lu.Crown, 14.dp, Tw.amber400)
                                Text(if (stats.plan == "annual") "مشترك VIP السنوي (استخدام غير محدود)" else arDigits("مشترك Pro (متبقي ${stats.remaining} استخدام شهري)"), style = twText(11, FontWeight.Bold, 16), color = Color(0xFFFCD34D))
                            } else {
                                LuIcon(Lu.Zap, 14.dp, Color(0xFF5EEAD4))
                                Text(arDigits("تبقى لك ${stats.remaining} من ${stats.limit} استخدامات مجانية اليوم"), style = twText(11, FontWeight.Normal, 16), color = Tw.slate200)
                            }
                        }
                        if (!stats.isSubscriber) Row(Modifier.clip(RoundedCornerShape(8.dp)).background(Brush.horizontalGradient(listOf(Tw.amber400, Tw.amber500))).twClickable { navController.navigate(Screen.Subscription.route) }.padding(horizontal = 8.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            LuIcon(Lu.Crown, 12.dp, Tw.slate950); Text("ترقية الباقة", style = twText(10, FontWeight.Black, 15), color = Tw.slate950)
                        } else Text("نشط", style = twText(10, FontWeight.Bold, 15), color = Color(0xFF6EE7B7))
                    }
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(line))

            if (user == null) {
                Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically)) {
                    Box(Modifier.size(64.dp).clip(RoundedCornerShape(24.dp)).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.60f) else Color(0xFFCCFBF1)), contentAlignment = Alignment.Center) { LuIcon(Lu.Lock, 32.dp, if (dark) Tw.teal300 else Tw.teal600) }
                    Text("تسجيل الدخول إجباري لاستخدام المساعد الذكي", style = twText(18, FontWeight.Black, 28).copy(textAlign = TextAlign.Center), color = if (dark) Tw.white else Tw.slate900)
                    Text("لحماية استهلاك الخدمة وتقديم تجربة مخصصة لك، يتطلب الذكاء الاصطناعي تسجيل الدخول. يمكنك إنشاء حساب مجاناً في ثوانٍ.", style = twText(12, FontWeight.Normal, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate400 else Tw.slate600)
                    Row(Modifier.clip(RoundedCornerShape(16.dp)).background(Tw.teal600).twClickable(pressScale = 0.95f) { navController.navigate(Screen.Login.route) }.padding(horizontal = 24.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(Lu.LogIn, 16.dp, Tw.white); Text("تسجيل الدخول / إنشاء حساب مجاناً", style = twText(14, FontWeight.Bold, 20), color = Tw.white)
                    }
                }
            } else {
                // اقتراحات
                Row(Modifier.fillMaxWidth().background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50).horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("🛡️ توثيق KYC والسحب" to "كيف أقوم بتوثيق حسابي (KYC) والتحقق من هويتي؟", "📢 إطلاق إعلان" to "كيف أنشئ حملة إعلانية بالنقرات CPC أو مدة ثابتة؟").forEach { (label, prompt) ->
                        val cs = RoundedCornerShape(8.dp)
                        Box(Modifier.clip(cs).background(if (dark) Tw.slate800 else Tw.white).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, cs).twClickable { send(prompt) }.padding(horizontal = 10.dp, vertical = 4.dp)) { Text(label, style = twText(11, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700, maxLines = 1) }
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(line))
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = listState, contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(messages.size) { i ->
                        val m = messages[i]
                        val me = m.isUser
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                            Box(Modifier.size(32.dp).clip(RoundedCornerShape(12.dp)).background(if (me) Tw.teal600 else (if (dark) Tw.slate800 else Tw.slate100)), contentAlignment = Alignment.Center) { LuIcon(if (me) Lu.User else Lu.Bot, 16.dp, if (me) Tw.white else (if (dark) Tw.teal300 else Tw.teal600)) }
                            val shape = RoundedCornerShape(topStart = if (me) 16.dp else 0.dp, topEnd = if (me) 0.dp else 16.dp, bottomStart = 16.dp, bottomEnd = 16.dp)
                            Column(Modifier.weight(1f, fill = false).clip(shape).background(if (me) Tw.teal600 else (if (dark) Tw.slate800 else Tw.slate100)).padding(horizontal = 16.dp, vertical = 12.dp)) {
                                Text(m.text, style = twText(12, if (me) FontWeight.Medium else FontWeight.Normal, 20), color = if (me) Tw.white else (if (dark) Tw.white else Tw.slate900))
                                Text(m.timestamp, Modifier.align(Alignment.End).padding(top = 4.dp), style = twText(9, FontWeight.Normal, 13), color = if (me) Color(0xFF99F6E4) else Tw.slate400)
                            }
                        }
                    }
                    if (isLoading) item {
                        Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator(Modifier.size(16.dp), color = Tw.teal600, strokeWidth = 2.dp)
                            Text("جاري المعالجة وتوليد الإجابة...", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal600)
                        }
                    }
                }
                if (outOfQuota) Row(Modifier.fillMaxWidth().background(if (dark) Color(0xFF451A03).copy(alpha = 0.40f) else Tw.amber50).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    LuIcon(Lu.AlertCircle, 16.dp, Tw.amber600)
                    Text("استنفدت الاستخدامات المجانية لليوم. ترقية الباقة تمنحك استخداماً فورياً غير محدود.", Modifier.weight(1f), style = twText(11, FontWeight.Normal, 16), color = if (dark) Color(0xFFFCD34D) else Color(0xFF92400E))
                    Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.teal600).twClickable(pressScale = 0.95f) { navController.navigate(Screen.Subscription.route) }.padding(horizontal = 12.dp, vertical = 6.dp)) { Text("ترقية الآن", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(line))
                Row(Modifier.fillMaxWidth().background(if (dark) Tw.slate900 else Tw.white).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    val fs = RoundedCornerShape(12.dp)
                    Box(Modifier.weight(1f).clip(fs).background(if (dark) Tw.slate800 else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, fs).then(if (outOfQuota || isLoading) Modifier.alpha(0.6f) else Modifier).padding(horizontal = 16.dp, vertical = 10.dp)) {
                        if (input.isEmpty()) Text(if (outOfQuota) "انتهت الاستخدامات المجانية لليوم. يرجى الترقية للمتابعة..." else "اكتب استفسارك هنا وسيجيبك المساعد فوراً...", style = twText(12, FontWeight.Normal, 20), color = Tw.slate400, maxLines = 1)
                        BasicTextField(input, { input = it }, enabled = !outOfQuota && !isLoading, singleLine = true, textStyle = twText(12, FontWeight.Normal, 20).copy(color = if (dark) Tw.white else Tw.slate900), cursorBrush = SolidColor(Tw.teal600), modifier = Modifier.fillMaxWidth())
                    }
                    val can = input.isNotBlank() && !isLoading && !outOfQuota
                    Row(Modifier.clip(fs).background(Tw.teal600).then(if (!can) Modifier.alpha(0.5f) else Modifier).twClickable(enabled = can) { send(input) }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("إرسال", style = twText(12, FontWeight.Bold, 16), color = Tw.white)
                        LuIcon(Lu.Send, 14.dp, Tw.white, Modifier.rotate(180f))
                    }
                }
            }
        }
    }
}
