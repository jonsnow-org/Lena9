package studio.ai.literium.literium_app.ui.screens.ads

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdPlacementType
import studio.ai.literium.literium_app.data.model.PricingModel
import studio.ai.literium.literium_app.data.model.PromotionKind
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.TwButton
import studio.ai.literium.literium_app.ui.theme.TwError
import studio.ai.literium.literium_app.ui.theme.TwInput
import studio.ai.literium.literium_app.ui.theme.TwLoading
import studio.ai.literium.literium_app.ui.theme.TwPage
import studio.ai.literium.literium_app.ui.theme.TwSecondaryButton
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.isDark
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

private val Mono = FontFamily.Monospace

/** حملة جديدة — NewCampaignModal.tsx: نوع الحملة (عادية/ترويج حساب)، 1) البيانات 2) الوسائط 3) التسعير 4) الجمهور، ثم التكلفة وزر الإطلاق. */
@Composable
fun NewCampaignScreen(navController: NavController, viewModel: NewCampaignViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val dark = isDark
    val line = if (dark) Tw.slate800 else Tw.slate200
    val box = RoundedCornerShape(16.dp)

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let { viewModel.uploadAdMedia(context, it, "image") } }
    val pickVideo = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let { viewModel.uploadAdMedia(context, it, "video") } }

    TwPage(title = "إنشاء حملة إعلانية جديدة", onClose = { navController.popBackStack() }) {
        Text("روّج لمحتواك أو موقعك أمام جمهور ليتيريوم بنماذج تسعير مرنة", style = twText(11, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
        if (state.isLoading) { TwLoading(); return@TwPage }

        state.error?.let { err ->
            TwError(err)
            if (err.contains("غير كافٍ")) TwSecondaryButton("شحن الرصيد الآن", { navController.navigate(Screen.MoneyRequest.of(isDeposit = true)) }, icon = Lu.DollarSign)
        }
        // الرصيد
        Row(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.50f) else Tw.slate50).border(1.dp, line, box).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                LuIcon(Lu.Wallet, 16.dp, brand.s500)
                Text("رصيد محفظتك المتاح: ", style = twText(12, FontWeight.Normal, 16), color = if (dark) Tw.slate400 else Tw.slate500)
                Text("$${"%.2f".format(state.userBalance)}", style = twText(12, FontWeight.Black, 16).copy(fontFamily = Mono), color = if (dark) Tw.white else Tw.slate900)
            }
            Text("+ شحن المحفظة", Modifier.twClickable { navController.navigate(Screen.MoneyRequest.of(isDeposit = true)) }, style = twText(11, FontWeight.Bold, 16), color = brand.s600)
        }

        Section("نوع الحملة")
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Kind(Modifier.weight(1f), !state.isSocialPromotion, "حملة إعلانية عادية", "ترويج موقع أو منتج", dark) { viewModel.setNormalCampaign() }
            Kind(Modifier.weight(1f), state.isSocialPromotion, "ترويج قناة/حساب اجتماعي", "يوتيوب، تيليجرام، إنستغرام...", dark) { viewModel.setSocialPromotion(PROMOTION_PLATFORMS.first().kind) }
        }
        if (state.isSocialPromotion) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PROMOTION_PLATFORMS.chunked(3).first().forEach { p -> Pill(p.label, state.promotionKind == p.kind, dark) { viewModel.setSocialPromotion(p.kind) } }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PROMOTION_PLATFORMS.drop(3).forEach { p -> Pill(p.label, state.promotionKind == p.kind, dark) { viewModel.setSocialPromotion(p.kind) } }
            }
        }

        Section("1. بيانات الإعلان الأساسية")
        TwInput(state.campaignName, viewModel::onCampaignNameChange, placeholder = "عنوان الحملة (مثال: ترويج كتاب الفلسفة المعاصرة)")
        TwInput(state.adText, viewModel::onAdTextChange, placeholder = "النص الترويجي الجذاب الذي يظهر للمستخدمين", singleLine = false, minLines = 3)
        TwInput(state.destinationUrl, viewModel::onDestinationUrlChange, placeholder = if (state.isSocialPromotion) (PROMOTION_PLATFORMS.find { it.kind == state.promotionKind }?.urlHint ?: "https://...") else "الرابط الخارجي المستهدف (https://...)", ltr = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))

        Section("2. الوسائط الإعلانية")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill("صورة", state.mediaMode == "image", dark) { viewModel.onMediaModeChange("image") }
            Pill("فيديو قصير (حتى دقيقة)", state.mediaMode == "video", dark) { viewModel.onMediaModeChange("video") }
        }
        if (state.mediaMode == "image") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                presetBanners().forEach { (label, url) ->
                    val sel = state.imageUrl == url
                    Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).border(if (sel) 2.dp else 1.dp, if (sel) brand.s500 else line, RoundedCornerShape(12.dp)).twClickable { viewModel.onImageUrlChange(url) }) {
                        AsyncImage(url, label, Modifier.fillMaxWidth().height(56.dp), contentScale = ContentScale.Crop)
                        Text(label, Modifier.padding(4.dp), style = twText(9, FontWeight.Bold, 13).copy(textAlign = TextAlign.Center), color = if (dark) Tw.slate300 else Tw.slate600, maxLines = 1)
                    }
                }
            }
            TwInput(state.imageUrl, viewModel::onImageUrlChange, placeholder = "رابط الصورة (https://...)", ltr = true)
            TwSecondaryButton(if (state.isUploadingMedia) "جارٍ الرفع..." else "أو ارفع صورة خاصة بك", { pickImage.launch("image/*") }, enabled = !state.isUploadingMedia, icon = Lu.Upload)
        } else {
            val up = state.uploadedVideoUrl.ifBlank { state.videoUrl }
            TwInput(state.videoUrl, viewModel::onVideoUrlChange, placeholder = "رابط الفيديو (https://...)", ltr = true)
            TwSecondaryButton(if (state.isUploadingMedia) "جارٍ الرفع..." else "ارفع مقطع فيديو قصير (حتى دقيقة واحدة)", { pickVideo.launch("video/*") }, enabled = !state.isUploadingMedia, icon = Lu.Upload)
            if (up.isNotBlank()) Text("✓ تم تجهيز الفيديو", style = twText(11, FontWeight.Bold, 16), color = Tw.emerald600)
            Text("يُفضّل ألا تتجاوز مدة الفيديو دقيقة واحدة.", style = twText(10, FontWeight.Normal, 15), color = Tw.slate400)
        }

        if (!state.isSocialPromotion) {
            Section("نوع المساحة الإعلانية")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Triple(AdPlacementType.PLATFORM, "مساحات المنصة", "الرئيسية والتصنيفات"), Triple(AdPlacementType.WRITER, "داخل المقالات", "صفحات الكتّاب"), Triple(AdPlacementType.CATEGORY_SPONSOR, "رعاية قسم", "بانر حصري للقسم")).forEach { (id, label, hint) ->
                    Kind(Modifier.weight(1f), state.placementType == id, label, hint, dark) { viewModel.onPlacementTypeChange(id) }
                }
            }
            if (state.placementType == AdPlacementType.CATEGORY_SPONSOR) Text("رعاية القسم تحجز البانر العلوي لقسم واحد بالكامل طوال المدة. يُنصح بنموذج التسعير الزمني الثابت لهذا النوع.", style = twText(11, FontWeight.Normal, 18), color = Tw.slate500)
        }

        Section("3. نموذج التسعير والميزانية")
        if (state.isSocialPromotion) {
            Column(Modifier.fillMaxWidth().clip(box).background(Tw.amber500.copy(alpha = 0.08f)).border(1.dp, Tw.amber500.copy(alpha = 0.30f), box).padding(14.dp)) {
                Text("$${"%.2f".format(SOCIAL_PROMO_CPC_RATE)} لكل نقرة موثقة", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.amber400 else Tw.amber600)
                Text("سعر خفيف مخصّص لترويج القنوات — يُخصم فقط عند نقرة حقيقية، لا رسوم إضافية.", style = twText(11, FontWeight.Normal, 18), color = Tw.slate500)
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kind(Modifier.weight(1f), state.pricingModel == PricingModel.FIXED, "زمني ثابت", "24h - 7 أيام", dark) { viewModel.onPricingModelChange(PricingModel.FIXED) }
                Kind(Modifier.weight(1f), state.pricingModel == PricingModel.CPC, "بالنقرة (CPC)", "$${"%.2f".format(state.cpcRate)} / نقرة", dark) { viewModel.onPricingModelChange(PricingModel.CPC) }
                Kind(Modifier.weight(1f), state.pricingModel == PricingModel.CPM, "بالمشاهدات (CPM)", "$${"%.2f".format(state.cpmRate)} / ألف", dark) { viewModel.onPricingModelChange(PricingModel.CPM) }
            }
        }
        if (state.pricingModel == PricingModel.FIXED && !state.isSocialPromotion) {
            Text("اختر مدة العرض المستمرة:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
            listOf(listOf(24L to "24 ساعة", 48L to "48 ساعة"), listOf(72L to "3 أيام", 168L to "أسبوع كامل")).forEach { r ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    r.forEach { (h, label) ->
                        val sel = state.durationHours == h
                        Column(Modifier.weight(1f).clip(box).background(if (sel) brand.s500.copy(alpha = 0.10f) else Color.Transparent).border(if (sel) 2.dp else 1.dp, if (sel) brand.s500 else line, box).twClickable { viewModel.onDurationHoursChange(h) }.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(label, style = twText(12, FontWeight.Black, 16), color = if (sel) brand.s600 else (if (dark) Tw.slate400 else Tw.slate600))
                            Text("${state.fixedDurationPrices[h] ?: 0}$", style = twText(11, FontWeight.Bold, 16), color = if (sel) brand.s600 else Tw.slate500)
                        }
                    }
                }
            }
        } else {
            Text("الميزانية الإجمالية المخصصة للحملة:", style = twText(12, FontWeight.Bold, 16), color = if (dark) Tw.slate300 else Tw.slate700)
            TwInput(if (state.totalBudget % 1.0 == 0.0) state.totalBudget.toLong().toString() else state.totalBudget.toString(), { viewModel.onTotalBudgetChange(it.toDoubleOrNull() ?: 0.0) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
        }

        Section("4. تصنيف الجمهور المستهدف")
        var open by remember { mutableStateOf(false) }
        Box {
            val s = RoundedCornerShape(12.dp)
            Row(Modifier.fillMaxWidth().clip(s).background(if (dark) Tw.slate800 else Tw.slate50).border(1.dp, if (dark) Tw.slate700 else Tw.slate200, s).twClickable { open = true }.padding(horizontal = 14.dp, vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(TARGET_CATEGORY_OPTIONS.find { it.first == state.targetCategory }?.second ?: "", Modifier.weight(1f), style = twText(12, FontWeight.Normal, 20), color = if (dark) Tw.white else Tw.slate900)
                LuIcon(Lu.ChevronDown, 16.dp, Tw.slate400)
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = if (dark) Tw.slate800 else Tw.white) {
                TARGET_CATEGORY_OPTIONS.forEach { (id, label) -> DropdownMenuItem(text = { Text(label, style = twText(12, FontWeight.Medium, 18)) }, onClick = { viewModel.onTargetCategoryChange(id); open = false }) }
            }
        }

        Row(Modifier.fillMaxWidth().clip(box).background(if (dark) Tw.slate800.copy(alpha = 0.50f) else Tw.slate50).border(1.dp, line, box).padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("التكلفة التقديرية:", style = twText(12, FontWeight.Normal, 16), color = Tw.slate500)
            Text("$${"%.2f".format(state.estimatedCost)}", style = twText(16, FontWeight.Black, 24).copy(fontFamily = Mono), color = if (dark) Tw.amber400 else Tw.amber600)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TwSecondaryButton("إلغاء", { navController.popBackStack() }, Modifier.weight(0.4f))
            Box(Modifier.weight(1f)) { TwButton(if (state.isSubmitting) "جاري الحفظ..." else "إطلاق الحملة الآن", { viewModel.submit { navController.popBackStack() } }, loading = state.isSubmitting, container = brand.s600) }
        }
    }
}

@Composable
private fun Section(text: String) {
    Text(text, Modifier.padding(top = 4.dp), style = twText(13, FontWeight.Black, 20), color = if (isDark) Tw.white else Tw.slate900)
}

@Composable
private fun Kind(modifier: Modifier, selected: Boolean, title: String, hint: String, dark: Boolean, onClick: () -> Unit) {
    val s = RoundedCornerShape(16.dp)
    Column(
        modifier.clip(s).background(if (selected) brand.s500.copy(alpha = 0.10f) else Color.Transparent)
            .border(if (selected) 2.dp else 1.dp, if (selected) brand.s500 else (if (dark) Tw.slate800 else Tw.slate200), s).twClickable(onClick = onClick).padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(title, style = twText(12, FontWeight.Bold, 16).copy(textAlign = TextAlign.Center), color = if (selected) brand.s600 else (if (dark) Tw.slate300 else Tw.slate700))
        Text(hint, style = twText(10, FontWeight.Normal, 15).copy(textAlign = TextAlign.Center), color = Tw.slate500)
    }
}

@Composable
private fun Pill(text: String, active: Boolean, dark: Boolean, onClick: () -> Unit) {
    studio.ai.literium.literium_app.ui.theme.TwPill(text, active, onClick)
}
