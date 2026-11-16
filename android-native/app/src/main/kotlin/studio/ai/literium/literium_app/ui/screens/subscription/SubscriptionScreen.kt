package studio.ai.literium.literium_app.ui.screens.subscription

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwError
import studio.ai.literium.literium_app.ui.theme.TwLoading
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

private val Mono = FontFamily.Monospace

/**
 * باقات الذكاء الاصطناعي — SubscriptionModal.tsx: ترويسة slate-950→teal-950→slate-900 مع أيقونة بتدرّج، بطاقة حالة الحساب،
 * بطاقات الباقات (حدّ teal عند الاختيار)، ملخّص الطلب، طرق الدفع، ثم إيصال «تم استلام الطلب».
 */
@Composable
fun SubscriptionScreen(navController: NavController, viewModel: SubscriptionViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val dark = isDark
    val shell = RoundedCornerShape(24.dp)
    val line = if (dark) Tw.slate800 else Tw.slate200
    val teal = Color(0xFF0D9488)

    Box(Modifier.fillMaxSize().padding(8.dp)) {
        Column(Modifier.fillMaxSize().shadow(16.dp, shell, clip = false).clip(shell).background(if (dark) Tw.slate900 else Tw.white).border(1.dp, line, shell)) {
            Row(Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(Tw.slate950, Color(0xFF042F2E), Tw.slate900))).padding(horizontal = 20.dp, vertical = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(listOf(Color(0xFF14B8A6), Color(0xFF22D3EE), Tw.amber400))), contentAlignment = Alignment.Center) { LuIcon(Lu.Crown, 22.dp, Tw.slate950) }
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("باقات الذكاء الاصطناعي Pro", style = twText(16, FontWeight.Black, 24), color = Tw.white)
                            Box(Modifier.clip(CircleShape).background(Brush.horizontalGradient(listOf(Tw.amber400, Tw.amber500))).padding(horizontal = 10.dp, vertical = 2.dp)) { Text("PRO", style = twText(10, FontWeight.Black, 14), color = Tw.slate950) }
                        }
                        Text("ارتقِ بقدراتك في الكتابة والتدقيق والتأليف الأدبي بأحدث نماذج الذكاء الاصطناعي", style = twText(11, FontWeight.Normal, 16), color = Color(0xFF99F6E4))
                    }
                }
                Box(Modifier.twClickable { navController.popBackStack() }.padding(6.dp)) { LuIcon(Lu.X, 20.dp, Tw.slate300) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFF134E4A).copy(alpha = 0.50f)))

            when {
                state.isLoading -> TwLoading()
                state.successReferenceId != null -> Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    val plan = state.selectedPlan
                    Box(Modifier.size(64.dp).clip(RoundedCornerShape(24.dp)).background(if (dark) Color(0xFF451A03).copy(alpha = 0.80f) else Tw.amber100), contentAlignment = Alignment.Center) { LuIcon(Lu.Clock, 32.dp, Tw.amber600) }
                    Text("تم استلام طلب اشتراكك ✅", style = twText(18, FontWeight.Black, 28), color = if (dark) Tw.white else Tw.slate900)
                    Text(
                        if (state.paymentMethod == SubscriptionPaymentMethod.WALLET) "سيُخصم المبلغ من محفظتك ويُفعَّل اشتراكك في ${plan.name} خلال 24 إلى 48 ساعة بعد مراجعة الإدارة."
                        else "تتم مراجعة إثبات الدفع يدوياً خلال 24 إلى 48 ساعة، وسيُفعَّل اشتراكك في ${plan.name} بعد التحقق.",
                        style = twText(12, FontWeight.Normal, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate400 else Tw.slate600
                    )
                    val rs = RoundedCornerShape(24.dp)
                    Column(Modifier.fillMaxWidth().clip(rs).background(if (dark) Tw.slate800.copy(alpha = 0.80f) else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, rs).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("إيصال طلب الاشتراك", style = twText(12, FontWeight.Black, 16), color = if (dark) Tw.white else Tw.slate900)
                            Text(state.successReferenceId.orEmpty(), style = twText(11, FontWeight.Bold, 16).copy(fontFamily = Mono), color = Tw.slate500)
                        }
                        Info("الباقة المطلوبة:", plan.name, dark)
                        Info("حد الاستخدام بعد التفعيل:", plan.aiLimitLabel, dark)
                        Info("حالة الطلب:", "قيد المراجعة اليدوية", dark, if (dark) Tw.amber400 else Tw.amber600)
                    }
                    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(teal).twClickable(pressScale = 0.95f) { viewModel.reset(); navController.popBackStack() }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) { Text("حسناً، فهمت", style = twText(14, FontWeight.Bold, 20), color = Tw.white) }
                }
                else -> {
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        // حالة الحساب
                        val cs = RoundedCornerShape(16.dp)
                        Row(Modifier.fillMaxWidth().clip(cs).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, cs).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            LuIcon(if (state.isCurrentlySubscribed) Lu.Crown else Lu.Zap, 16.dp, if (state.isCurrentlySubscribed) Tw.amber500 else teal)
                            Text("وضع حسابك الحالي: ${state.currentPlanLabel}", style = twText(12, FontWeight.Bold, 18), color = if (dark) Tw.slate200 else Tw.slate800)
                        }
                        state.error?.let { TwError(it) }

                        // الباقات
                        studio.ai.literium.literium_app.ui.screens.subscription.SUBSCRIPTION_PLANS.forEach { plan ->
                            val sel = state.selectedPlanId == plan.id
                            val ps = RoundedCornerShape(24.dp)
                            Column(
                                Modifier.fillMaxWidth().clip(ps).background(if (sel) teal.copy(alpha = 0.06f) else Color.Transparent)
                                    .border(if (sel) 2.dp else 1.dp, if (sel) teal else line, ps).twClickable { viewModel.selectPlan(plan.id) }.padding(20.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                plan.badge?.let { b ->
                                    Row(Modifier.clip(CircleShape).background(if (plan.popular) Brush.horizontalGradient(listOf(Tw.amber500, Color(0xFFF97316))) else Brush.horizontalGradient(listOf(teal, teal))).padding(horizontal = 10.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        if (plan.popular) LuIcon(Lu.Crown, 14.dp, Tw.amber100)
                                        Text(b, style = twText(11, FontWeight.Black, 16), color = Tw.white)
                                    }
                                }
                                Column {
                                    Text(plan.name, style = twText(16, FontWeight.Black, 24), color = if (dark) Tw.white else Tw.slate900)
                                    Text(plan.nameEn, style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
                                }
                                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("${plan.price}$", style = twText(30, FontWeight.Black, 36), color = if (dark) Tw.white else Tw.slate900)
                                    Text("/ ${plan.periodLabel}", Modifier.padding(bottom = 4.dp), style = twText(11, FontWeight.Normal, 16), color = Tw.slate500)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    LuIcon(Lu.Sparkles, 14.dp, teal)
                                    Text(plan.aiLimitLabel, style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.teal300 else Tw.teal700)
                                }
                                Box(Modifier.fillMaxWidth().height(1.dp).background(line))
                                Text("المميزات المضمنة في الباقة:", style = twText(11, FontWeight.Bold, 16), color = Tw.slate500)
                                plan.features.forEach { f ->
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        LuIcon(Lu.CheckCircle2, 14.dp, Tw.emerald500, Modifier.padding(top = 2.dp))
                                        Text(f, style = twText(12, FontWeight.Normal, 18), color = if (dark) Tw.slate300 else Tw.slate700)
                                    }
                                }
                                Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (sel) teal else (if (dark) Tw.slate800 else Tw.slate100)).padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
                                    Text(if (sel) "الباقة المحددة للمتابعة" else "اختيار هذه الباقة", style = twText(12, FontWeight.Bold, 16), color = if (sel) Tw.white else (if (dark) Tw.slate300 else Tw.slate700))
                                }
                            }
                        }

                        // ملخص + طرق الدفع
                        val plan = state.selectedPlan
                        val sm = RoundedCornerShape(24.dp)
                        Row(Modifier.fillMaxWidth().clip(sm).background(if (dark) Color(0xFF042F2E).copy(alpha = 0.40f) else Color(0xFFF0FDFA)).border(1.dp, if (dark) Color(0xFF115E59) else Color(0xFF99F6E4), sm).padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("ملخص الطلب: ${plan.name}", Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.white else Tw.slate900)
                            Text("${plan.price}$", style = twText(20, FontWeight.Black, 28), color = if (dark) Tw.teal300 else Tw.teal700)
                        }
                        Text("اختر طريقة الدفع المعتمدة:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                        SubscriptionPaymentMethod.values().toList().chunked(2).forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                row.forEach { m ->
                                    val sel = state.paymentMethod == m
                                    Box(Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(if (sel) teal.copy(alpha = 0.08f) else Color.Transparent).border(if (sel) 2.dp else 1.dp, if (sel) teal else line, RoundedCornerShape(16.dp)).twClickable { viewModel.selectPaymentMethod(m) }.padding(12.dp), contentAlignment = Alignment.Center) {
                                        Text(m.label, style = twText(12, FontWeight.Bold, 16).copy(textAlign = TextAlign.Center), color = if (sel) (if (dark) Tw.teal300 else Tw.teal700) else (if (dark) Tw.slate400 else Tw.slate600))
                                    }
                                }
                                if (row.size == 1) Box(Modifier.weight(1f)) {}
                            }
                        }
                        if (state.paymentMethod == SubscriptionPaymentMethod.WALLET) {
                            Column(Modifier.fillMaxWidth().clip(sm).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, sm).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("الرصيد المتاح في محفظتك:", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500); Text("${"%.2f".format(state.walletBalance)}$", style = twText(12, FontWeight.Bold, 16).copy(fontFamily = Mono), color = if (dark) Tw.white else Tw.slate900) }
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("قيمة الاشتراك المطلوب:", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500); Text("-${plan.price}$", style = twText(12, FontWeight.Bold, 16).copy(fontFamily = Mono), color = Tw.rose500) }
                                Box(Modifier.fillMaxWidth().height(1.dp).background(line))
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("الرصيد المتبقي بعد الخصم:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate200 else Tw.slate800); Text("${"%.2f".format(state.walletBalance - plan.price)}$", style = twText(12, FontWeight.Black, 16).copy(fontFamily = Mono), color = if (state.hasEnoughWalletBalance) Tw.emerald600 else Tw.rose500) }
                                if (!state.hasEnoughWalletBalance) Text("رصيد محفظتك غير كافٍ. يرجى اختيار طريقة دفع أخرى لإتمام الاشتراك.", style = twText(11, FontWeight.Bold, 16), color = Tw.rose500)
                            }
                        }
                        val busy = state.isSubmitting
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Brush.horizontalGradient(listOf(Color(0xFF0D9488), Color(0xFF0891B2), Color(0xFF0F766E)))).then(if (busy) Modifier.alpha(0.6f) else Modifier)
                                .twClickable(enabled = !busy, pressScale = 0.97f) { viewModel.confirmPurchase() }.padding(vertical = 14.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (busy) CircularProgressIndicator(Modifier.size(16.dp), color = Tw.white, strokeWidth = 2.dp)
                            Text(if (busy) "جاري إرسال طلب الاشتراك..." else "إرسال طلب الاشتراك (${plan.price}$)", style = twText(14, FontWeight.Black, 20), color = Tw.white)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Info(label: String, value: String, dark: Boolean, tone: Color? = null) {
    Column {
        Text(label, style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
        Text(value, style = twText(12, FontWeight.Bold, 18), color = tone ?: (if (dark) Tw.white else Tw.slate900))
    }
}
