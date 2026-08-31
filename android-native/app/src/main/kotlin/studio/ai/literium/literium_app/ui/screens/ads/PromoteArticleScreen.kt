package studio.ai.literium.literium_app.ui.screens.ads

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import studio.ai.literium.literium_app.data.model.PromotionPricingModel

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PromoteArticleScreen(navController: NavController, articleId: String) {
    val viewModel: PromoteArticleViewModel = viewModel(
        key = "promote_article_$articleId",
        factory = viewModelFactory { initializer { PromoteArticleViewModel(articleId) } }
    )
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ترويج المقال") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "عودة")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) { Snackbar(it) } }
    ) { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }
        if (state.article == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("لم يُعثر على هذا المقال.") }
            return@Scaffold
        }
        val article = state.article!!

        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp)) {
            if (state.isDone) {
                Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(10.dp))
                    Text("تم إرسال طلبك", fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "طلب الترويج الآن بانتظار مراجعة إدارة المنصة. ولن يُخصم أي مبلغ قبل الاعتماد.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { navController.popBackStack() }) { Text("إغلاق") }
                }
                return@Column
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text("المقال المُروَّج", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(article.title, fontWeight = FontWeight.Bold, maxLines = 2)
                }
            }

            Spacer(Modifier.height(16.dp))
            Text("نموذج التسعير:", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PricingCard(
                    title = "مبلغ ثابت لمدة",
                    subtitle = "ظهور مضمون طوال المدة",
                    icon = Icons.Filled.Schedule,
                    selected = state.pricingModel == PromotionPricingModel.FIXED,
                    modifier = Modifier.weight(1f)
                ) { viewModel.onPricingModelChange(PromotionPricingModel.FIXED) }
                PricingCard(
                    title = "حسب النقرات",
                    subtitle = "${"%.2f".format(PROMOTION_CPC_RATE)}$ لكل نقرة صالحة",
                    icon = Icons.Filled.TouchApp,
                    selected = state.pricingModel == PromotionPricingModel.CPC,
                    modifier = Modifier.weight(1f)
                ) { viewModel.onPricingModelChange(PromotionPricingModel.CPC) }
            }

            Spacer(Modifier.height(16.dp))
            if (state.pricingModel == PromotionPricingModel.FIXED) {
                Text("مدة الترويج:", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PROMOTION_DURATION_OPTIONS.chunked(2).forEach { pair ->
                        Column(modifier = Modifier.weight(1f)) {
                            pair.forEach { opt ->
                                Card(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp).clickable { viewModel.onDurationChange(opt.hours) },
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (state.durationHours == opt.hours) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                                    )
                                ) {
                                    Column(Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(opt.label, fontWeight = FontWeight.Black, style = MaterialTheme.typography.labelMedium)
                                        Text("${opt.fixedCost}$", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                Text("ميزانية النقرات (بالدولار):", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = state.cpcBudget.toInt().toString(),
                    onValueChange = { it.toDoubleOrNull()?.let(viewModel::onCpcBudgetChange) },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "تكفي لحوالي ${state.estimatedClicks} نقرة صالحة. النقرات المرفوضة كاحتيال لا تُحتسب ولا تُخصم منك.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(Modifier.height(16.dp))
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.AccountBalanceWallet, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("رصيدك المتاح", style = MaterialTheme.typography.labelSmall)
                        }
                        Text("${"%.2f".format(state.availableBalance)}$", fontWeight = FontWeight.Black)
                    }
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("تكلفة الترويج", style = MaterialTheme.typography.labelSmall)
                        Text("${"%.2f".format(state.cost)}$", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.tertiary)
                    }
                }
            }

            if (!state.hasEnoughBalance) {
                Spacer(Modifier.height(10.dp))
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                    Row(Modifier.padding(12.dp)) {
                        Icon(Icons.Filled.Warning, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "رصيدك الحالي أقل من تكلفة الترويج. يمكنك إرسال الطلب الآن، وسيراجعه فريق المنصة ولن يُعتمد قبل توفر الرصيد.",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            Text(
                "تتم مراجعة طلبات الترويج يدوياً من إدارة المنصة خلال 24 إلى 48 ساعة. لا يُخصم أي مبلغ من رصيدك قبل اعتماد الطلب.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(18.dp))
            Button(onClick = viewModel::submit, enabled = !state.isSubmitting, modifier = Modifier.fillMaxWidth()) {
                if (state.isSubmitting) {
                    CircularProgressIndicator(Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Icon(Icons.Filled.TrendingUp, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("إرسال طلب الترويج")
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun PricingCard(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.height(4.dp))
            Text(title, fontWeight = FontWeight.Black, style = MaterialTheme.typography.labelMedium)
            Text(subtitle, style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
        }
    }
}
