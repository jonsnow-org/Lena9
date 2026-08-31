package studio.ai.literium.literium_app.ui.screens.ads

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenu
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdPlacementType
import studio.ai.literium.literium_app.data.model.PricingModel
import studio.ai.literium.literium_app.data.model.PromotionKind
import studio.ai.literium.literium_app.navigation.Screen

@Composable
fun NewCampaignScreen(navController: NavController, viewModel: NewCampaignViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.uploadAdMedia(context, it, "image") }
    }
    val pickVideo = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.uploadAdMedia(context, it, "video") }
    }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("إنشاء حملة إعلانية جديدة") },
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

        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp)) {
            // Balance card
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("رصيد محفظتك المتاح: ${"%.2f".format(state.userBalance)}$", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                    Text(
                        "+ شحن المحفظة",
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.clickable { navController.navigate(Screen.MoneyRequest.of(isDeposit = true)) }
                    )
                }
            }

            Spacer(Modifier.height(16.dp))
            Text("نوع الحملة", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectableCard(
                    title = "حملة إعلانية عادية",
                    subtitle = "ترويج موقع أو منتج",
                    selected = state.promotionKind == PromotionKind.WEBSITE,
                    modifier = Modifier.weight(1f),
                    onClick = viewModel::setNormalCampaign
                )
                SelectableCard(
                    title = "ترويج قناة/حساب اجتماعي",
                    subtitle = "يوتيوب، تيليجرام، إنستغرام...",
                    selected = state.promotionKind != PromotionKind.WEBSITE,
                    modifier = Modifier.weight(1f),
                    onClick = { viewModel.setSocialPromotion(PromotionKind.TELEGRAM) }
                )
            }
            if (state.promotionKind != PromotionKind.WEBSITE) {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PROMOTION_PLATFORMS.forEach { p ->
                        SmallChip(
                            label = p.label,
                            selected = state.promotionKind == p.kind,
                            onClick = { viewModel.setSocialPromotion(p.kind) }
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Text("1. بيانات الإعلان الأساسية", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.campaignName,
                onValueChange = viewModel::onCampaignNameChange,
                label = { Text("عنوان الحملة") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.adText,
                onValueChange = viewModel::onAdTextChange,
                label = { Text("النص الترويجي") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.destinationUrl,
                onValueChange = viewModel::onDestinationUrlChange,
                label = {
                    Text(
                        if (state.promotionKind == PromotionKind.WEBSITE) "الرابط الخارجي المستهدف"
                        else PROMOTION_PLATFORMS.find { it.kind == state.promotionKind }?.urlHint ?: "رابط الحساب"
                    )
                },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(20.dp))
            Text("2. الوسائط الإعلانية", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SmallChip("صورة", state.mediaMode == "image") { viewModel.onMediaModeChange("image") }
                SmallChip("فيديو قصير (حتى دقيقة)", state.mediaMode == "video") { viewModel.onMediaModeChange("video") }
            }
            Spacer(Modifier.height(10.dp))
            if (state.mediaMode == "image") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    presetBanners().forEach { (label, url) ->
                        Column(
                            modifier = Modifier.weight(1f).clickable { viewModel.onImageUrlChange(url) }
                        ) {
                            AsyncImage(
                                model = url,
                                contentDescription = label,
                                modifier = Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(8.dp))
                                    .border(
                                        if (state.imageUrl == url) 2.dp else 0.dp,
                                        MaterialTheme.colorScheme.primary,
                                        RoundedCornerShape(8.dp)
                                    )
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                            )
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = { pickImage.launch("image/*") }, enabled = !state.isUploadingMedia) {
                        if (state.isUploadingMedia) CircularProgressIndicator(Modifier.size(16.dp), color = MaterialTheme.colorScheme.onPrimary)
                        else Icon(Icons.Filled.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("ارفع صورة خاصة بك")
                    }
                }
                if (state.imageUrl.isNotBlank() && state.imageUrl !in presetBanners().map { it.second }) {
                    Spacer(Modifier.height(8.dp))
                    AsyncImage(
                        model = state.imageUrl,
                        contentDescription = null,
                        modifier = Modifier.fillMaxWidth().height(120.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                }
            } else {
                Button(onClick = { pickVideo.launch("video/*") }, enabled = !state.isUploadingMedia) {
                    if (state.isUploadingMedia) CircularProgressIndicator(Modifier.size(16.dp), color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(Modifier.width(6.dp))
                    Text("ارفع مقطع فيديو قصير (حتى دقيقة)")
                }
                if (state.uploadedVideoUrl.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text("تم رفع الفيديو ✓", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                }
            }

            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = state.videoUrl,
                onValueChange = viewModel::onVideoUrlChange,
                label = { Text(if (state.promotionKind == PromotionKind.WEBSITE) "فيديو إعلاني مضمّن إضافي (اختياري، رابط يوتيوب/Vimeo)" else "مقطع تعريفي عن القناة (اختياري)") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(20.dp))
            Text("نوع المساحة الإعلانية", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectableCard("مساحات المنصة", "الرئيسية والتصنيفات", state.placementType == AdPlacementType.PLATFORM, Modifier.weight(1f)) {
                    viewModel.onPlacementTypeChange(AdPlacementType.PLATFORM)
                }
                SelectableCard("داخل المقالات", "صفحات الكتّاب", state.placementType == AdPlacementType.WRITER, Modifier.weight(1f)) {
                    viewModel.onPlacementTypeChange(AdPlacementType.WRITER)
                }
                SelectableCard("رعاية قسم", "بانر حصري للقسم", state.placementType == AdPlacementType.CATEGORY_SPONSOR, Modifier.weight(1f)) {
                    viewModel.onPlacementTypeChange(AdPlacementType.CATEGORY_SPONSOR)
                }
            }

            Spacer(Modifier.height(20.dp))
            Text("3. نموذج التسعير والميزانية", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            if (state.isSocialPromotion) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Text(
                        "$${"%.2f".format(SOCIAL_PROMO_CPC_RATE)} لكل نقرة موثقة — يُخصم فقط عند نقرة حقيقية، لا رسوم إضافية.",
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SelectableCard("زمني ثابت", "24h - 7 أيام", state.pricingModel == PricingModel.FIXED, Modifier.weight(1f)) {
                        viewModel.onPricingModelChange(PricingModel.FIXED)
                    }
                    SelectableCard("بالنقرة (CPC)", "$${DEFAULT_CPC_RATE} / نقرة", state.pricingModel == PricingModel.CPC, Modifier.weight(1f)) {
                        viewModel.onPricingModelChange(PricingModel.CPC)
                    }
                    SelectableCard("بالمشاهدات (CPM)", "$${DEFAULT_CPM_RATE} / 1000", state.pricingModel == PricingModel.CPM, Modifier.weight(1f)) {
                        viewModel.onPricingModelChange(PricingModel.CPM)
                    }
                }
            }

            if (!state.isSocialPromotion && state.pricingModel == PricingModel.FIXED) {
                Spacer(Modifier.height(10.dp))
                Text("اختر مدة العرض المستمرة:", style = MaterialTheme.typography.labelMedium)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(24L to "24 ساعة", 48L to "48 ساعة", 72L to "3 أيام", 168L to "أسبوع كامل").forEach { (h, label) ->
                        SmallChip("$label\n$${state.fixedDurationPrices[h]}", state.durationHours == h) { viewModel.onDurationHoursChange(h) }
                    }
                }
            }

            if (state.pricingModel == PricingModel.CPC || state.pricingModel == PricingModel.CPM) {
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = if (state.totalBudget == 0.0) "" else state.totalBudget.toInt().toString(),
                    onValueChange = { it.toDoubleOrNull()?.let(viewModel::onTotalBudgetChange) },
                    label = { Text("الميزانية الإجمالية المخصصة للحملة ($)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(Modifier.height(20.dp))
            Text("4. تصنيف الجمهور المستهدف", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            var categoryExpanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(expanded = categoryExpanded, onExpandedChange = { categoryExpanded = it }) {
                OutlinedTextField(
                    value = TARGET_CATEGORY_OPTIONS.find { it.first == state.targetCategory }?.second ?: "",
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                )
                ExposedDropdownMenu(expanded = categoryExpanded, onDismissRequest = { categoryExpanded = false }) {
                    TARGET_CATEGORY_OPTIONS.forEach { (id, label) ->
                        DropdownMenuItem(text = { Text(label) }, onClick = { viewModel.onTargetCategoryChange(id); categoryExpanded = false })
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(14.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("التكلفة التقديرية:", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("$${"%.2f".format(state.estimatedCost)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                    }
                    Button(
                        onClick = { viewModel.submit { navController.popBackStack() } },
                        enabled = !state.isSubmitting
                    ) {
                        if (state.isSubmitting) {
                            CircularProgressIndicator(Modifier.size(16.dp), color = MaterialTheme.colorScheme.onPrimary)
                        } else {
                            Icon(Icons.Filled.Bolt, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("إطلاق الحملة الآن")
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SelectableCard(title: String, subtitle: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Text(subtitle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
}

@Composable
private fun SmallChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
