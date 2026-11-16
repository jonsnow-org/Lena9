package studio.ai.literium.literium_app.ui.screens.ads

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.model.PromotionPricingModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwButton
import studio.ai.literium.literium_app.ui.theme.TwError
import studio.ai.literium.literium_app.ui.theme.TwInput
import studio.ai.literium.literium_app.ui.theme.TwLoading
import studio.ai.literium.literium_app.ui.theme.TwPage
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

/** ترويج المقال — PromoteArticleModal.tsx: بطاقات نموذج التسعير/المدة (حدّ amber/brand عند الاختيار)، ملخّص الرصيد والتكلفة، زر amber-600. */
@Composable
fun PromoteArticleScreen(navController: NavController, articleId: String) {
    val viewModel: PromoteArticleViewModel = viewModel(
        key = "promote_article_$articleId",
        factory = viewModelFactory { initializer { PromoteArticleViewModel(articleId) } }
    )
    val state by viewModel.state.collectAsState()
    val dark = isDark
    val amber = Color(0xFFD97706)

    TwPage(title = "ترويج المقال", onClose = { navController.popBackStack() }) {
        Text("اعرض مقالك في مكان بارز بالصفحة الرئيسية", style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
        when {
            state.isLoading -> TwLoading()
            state.isDone -> Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(56.dp).clip(CircleShape).background(Tw.emerald500.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) { LuIcon(Lu.CheckCircle2, 28.dp, Tw.emerald600) }
                Text("تم إرسال طلبك", style = twText(16, FontWeight.ExtraBold, 24), color = if (dark) Tw.white else Tw.slate900)
                Text("طلب الترويج الآن بانتظار مراجعة إدارة المنصة. ستظهر حالته في صفحة مقالاتك، ولن يُخصم أي مبلغ قبل الاعتماد.", style = twText(12, FontWeight.Normal, 20).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate400 else Tw.slate500)
                Box(Modifier.clip(RoundedCornerShape(16.dp)).background(if (dark) Tw.slate100 else Tw.slate900).twClickable { navController.popBackStack() }.padding(horizontal = 24.dp, vertical = 10.dp)) {
                    Text("إغلاق", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate900 else Tw.white)
                }
            }
            else -> {
                val box = RoundedCornerShape(16.dp)
                Column(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.50f) else Tw.slate50).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, box).padding(14.dp)) {
                    Text("المقال المُروَّج", Modifier.padding(bottom = 4.dp), style = twText(10, FontWeight.Bold, 15), color = Tw.slate400)
                    Text(state.article?.title.orEmpty(), style = twText(14, FontWeight.Bold, 20), color = if (dark) Tw.white else Tw.slate900, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                state.error?.let { TwError(it) }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("نموذج التسعير:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Choice(Modifier.weight(1f), state.pricingModel == PromotionPricingModel.FIXED, amber, dark, { viewModel.onPricingModelChange(PromotionPricingModel.FIXED) }) {
                            LuIcon(Lu.Clock, 16.dp, if (state.pricingModel == PromotionPricingModel.FIXED) amber else Tw.slate500)
                            Text("مبلغ ثابت لمدة", style = twText(12, FontWeight.Black, 16), color = if (state.pricingModel == PromotionPricingModel.FIXED) amber else (if (dark) Tw.slate400 else Tw.slate600))
                            Text("ظهور مضمون طوال المدة", style = twText(10, FontWeight.Normal, 15), color = Tw.slate500)
                        }
                        Choice(Modifier.weight(1f), state.pricingModel == PromotionPricingModel.CPC, amber, dark, { viewModel.onPricingModelChange(PromotionPricingModel.CPC) }) {
                            LuIcon(Lu.MousePointerClick, 16.dp, if (state.pricingModel == PromotionPricingModel.CPC) amber else Tw.slate500)
                            Text("حسب النقرات", style = twText(12, FontWeight.Black, 16), color = if (state.pricingModel == PromotionPricingModel.CPC) amber else (if (dark) Tw.slate400 else Tw.slate600))
                            Text("${"%.2f".format(PROMOTION_CPC_RATE)}$ لكل نقرة صالحة", style = twText(10, FontWeight.Normal, 15), color = Tw.slate500)
                        }
                    }
                }

                if (state.pricingModel == PromotionPricingModel.FIXED) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("مدة الترويج:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                    PROMOTION_DURATION_OPTIONS.chunked(2).forEach { pair ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            pair.forEach { opt ->
                                val sel = state.durationHours == opt.hours
                                Choice(Modifier.weight(1f), sel, brand.s500, dark, { viewModel.onDurationChange(opt.hours) }) {
                                    Text(opt.label, style = twText(12, FontWeight.Black, 16), color = if (sel) brand.s600 else (if (dark) Tw.slate400 else Tw.slate600))
                                    Text("${"%.2f".format(opt.fixedCost)}$", style = twText(11, FontWeight.Bold, 16), color = if (sel) brand.s600 else (if (dark) Tw.slate400 else Tw.slate600))
                                }
                            }
                            if (pair.size == 1) Box(Modifier.weight(1f)) {}
                        }
                    }
                } else Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("ميزانية النقرات (بالدولار):", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
                    TwInput(
                        if (state.cpcBudget % 1.0 == 0.0) state.cpcBudget.toLong().toString() else state.cpcBudget.toString(),
                        { v -> viewModel.onCpcBudgetChange(v.toDoubleOrNull() ?: 0.0) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                    Text("تكفي لحوالي ${state.estimatedClicks} نقرة صالحة. النقرات المرفوضة كاحتيال لا تُحتسب ولا تُخصم منك.", style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                }

                Column(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.50f) else Tw.slate50).border(1.dp, if (dark) Tw.slate800 else Tw.slate200, box).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            LuIcon(Lu.Wallet, 14.dp, if (dark) Tw.slate400 else Tw.slate500)
                            Text("رصيدك المتاح", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                        }
                        Text("$${"%.2f".format(state.availableBalance)}", style = twText(12, FontWeight.Black, 16).copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace), color = if (dark) Tw.white else Tw.slate900)
                    }
                    Box(Modifier.fillMaxWidth().height(1.dp).background(if (dark) Tw.slate700 else Tw.slate200))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("تكلفة الترويج", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                        Text("$${"%.2f".format(state.cost)}", style = twText(12, FontWeight.Black, 16).copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace), color = amber)
                    }
                }
                if (!state.hasEnoughBalance) Row(Modifier.fillMaxWidth().clip(box).background(Tw.amber500.copy(alpha = 0.10f)).border(1.dp, Tw.amber500.copy(alpha = 0.20f), box).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LuIcon(Lu.AlertCircle, 16.dp, amber)
                    Text("رصيدك الحالي أقل من تكلفة الترويج. يمكنك إرسال الطلب الآن، وسيراجعه فريق المنصة ولن يُعتمد قبل توفر الرصيد.", style = twText(11, FontWeight.Normal, 18), color = if (dark) Tw.amber400 else Color(0xFFB45309))
                }
                Box(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.60f) else Tw.slate100).padding(14.dp)) {
                    Text("تتم مراجعة طلبات الترويج يدوياً من إدارة المنصة خلال 24 إلى 48 ساعة. لا يُخصم أي مبلغ من رصيدك قبل اعتماد الطلب.", style = twText(11, FontWeight.Normal, 18), color = if (dark) Tw.slate400 else Tw.slate500)
                }
                TwButton(if (state.isSubmitting) "جارٍ الإرسال…" else "إرسال طلب الترويج", { viewModel.submit() }, loading = state.isSubmitting, icon = Lu.Rocket, container = amber)
            }
        }
    }
}

@Composable
private fun Choice(modifier: Modifier, selected: Boolean, tone: Color, dark: Boolean, onClick: () -> Unit, content: @Composable () -> Unit) {
    val s = RoundedCornerShape(16.dp)
    Column(
        modifier.clip(s).background(if (selected) tone.copy(alpha = 0.10f) else Color.Transparent)
            .border(if (selected) 2.dp else 1.dp, if (selected) tone else (if (dark) Tw.slate800 else Tw.slate200), s)
            .twClickable(onClick = onClick).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)
    ) { content() }
}
