package studio.ai.literium.literium_app.ui.screens.admin.tabs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.ArticlePromotion
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.ads.ADSTERRA_UNITS
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.DarkCard
import studio.ai.literium.literium_app.ui.theme.SlateMuted

/**
 * "مركز الإعلانات والترويج" — Compose port of `AdminAdsTab.tsx`'s three
 * sub-sections: advertiser campaign approve/reject/pause/delete, article
 * promotion requests, and the external ad-network (PropellerAds/
 * Adsterra/Taboola) fallback config. Pending-campaign approve/reject goes
 * through the real server endpoint via [AdminViewModel.reviewCampaign]
 * (see its KDoc); everything else here is a plain Firestore write.
 */
@Composable
fun CampaignsTab(
    viewModel: AdminViewModel,
    campaigns: List<AdCampaign>,
    promotions: List<ArticlePromotion>,
    users: List<User>
) {
    var subTab by remember { mutableStateOf("ad_campaigns") }

    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            FilterChip(selected = subTab == "ad_campaigns", onClick = { subTab = "ad_campaigns" }, label = { Text("حملات المعلنين") })
            FilterChip(selected = subTab == "promotions", onClick = { subTab = "promotions" }, label = { Text("ترويج المقالات") })
            FilterChip(selected = subTab == "external_networks", onClick = { subTab = "external_networks" }, label = { Text("الشبكات الخارجية") })
        }

        when (subTab) {
            "ad_campaigns" -> CampaignsList(viewModel, campaigns, users)
            "promotions" -> PromotionsList(viewModel, promotions, users)
            "external_networks" -> ExternalNetworksSection(viewModel)
        }
    }
}

@Composable
private fun CampaignsList(viewModel: AdminViewModel, campaigns: List<AdCampaign>, users: List<User>) {
    var filter by remember { mutableStateOf("all") }
    var searchQuery by remember { mutableStateOf("") }
    val reviewingIds by viewModel.reviewingCampaignIds.collectAsState()

    val filtered = campaigns.filter { c ->
        (filter == "all" || c.status == filter) &&
            (searchQuery.isBlank() || c.campaignName.contains(searchQuery, ignoreCase = true))
    }

    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            OutlinedTextField(
                value = searchQuery, onValueChange = { searchQuery = it },
                label = { Text("البحث في الحملات...") }, modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("all" to "الكل", "active" to "النشطة", "pending" to "بانتظار الاعتماد", "paused" to "المتوقفة", "rejected" to "المرفوضة")
                    .forEach { (key, label) -> FilterChip(selected = filter == key, onClick = { filter = key }, label = { Text(label) }) }
            }
        }
        if (filtered.isEmpty()) {
            item { EmptyHint("لا توجد حملات إعلانية تطابق هذا البحث أو الفلتر.") }
        } else {
            items(filtered, key = { it.id }) { camp ->
                DarkCard {
                    Column(Modifier.padding(12.dp)) {
                        Text(camp.campaignName, fontWeight = FontWeight.Bold)
                        Text(
                            when (camp.status) {
                                "active" -> "نشطة ✓"
                                "pending" -> "بانتظار تمويل المعلن ⏳"
                                "paused" -> "متوقفة مؤقتاً"
                                else -> "مرفوضة ✗"
                            },
                            fontSize = 11.sp, color = SlateMuted
                        )
                        Text(camp.description, fontSize = 12.sp, color = SlateMuted, maxLines = 2)
                        Text(
                            "الميزانية: $${if (camp.status == "pending") camp.requestedBudget ?: 0.0 else camp.totalBudget} • المُنفَق: $${"%.2f".format(camp.totalSpent)} • الظهور: ${camp.impressionsCount} • النقرات: ${camp.clicksCount}",
                            fontSize = 11.sp, color = SlateMuted
                        )
                        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            when (camp.status) {
                                "pending" -> {
                                    val isReviewing = camp.id in reviewingIds
                                    Button(
                                        enabled = !isReviewing,
                                        onClick = { viewModel.reviewCampaign(camp.id, true) }
                                    ) { Text(if (isReviewing) "جارٍ المعالجة..." else "موافقة وتفعيل") }
                                    OutlinedButton(
                                        enabled = !isReviewing,
                                        onClick = { viewModel.reviewCampaign(camp.id, false) }
                                    ) { Text("رفض") }
                                }
                                "active" -> OutlinedButton(onClick = { viewModel.setCampaignStatus(camp.id, "paused") }) { Text("إيقاف مؤقت") }
                                "paused" -> Button(onClick = { viewModel.setCampaignStatus(camp.id, "active") }) { Text("استئناف") }
                            }
                            OutlinedButton(onClick = { viewModel.deleteCampaign(camp.id) }) { Text("حذف نهائي") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PromotionsList(viewModel: AdminViewModel, promotions: List<ArticlePromotion>, users: List<User>) {
    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("طلبات ترويج المقالات (${promotions.size})", fontWeight = FontWeight.Bold) }
        if (promotions.isEmpty()) {
            item { EmptyHint("لا توجد طلبات ترويج مقالات حالياً.") }
        } else {
            items(promotions, key = { it.id }) { promo ->
                val writer = users.find { it.id == promo.writerId }
                DarkCard {
                    Column(Modifier.padding(12.dp)) {
                        Text(promo.articleTitle ?: promo.articleId, fontWeight = FontWeight.Bold)
                        Text(
                            "الكاتب: ${writer?.fullName ?: promo.writerId} • التكلفة: $${promo.cost} • ${if (promo.pricingModel == "cpc") "لكل نقرة" else "سعر ثابت"}",
                            fontSize = 11.sp, color = SlateMuted
                        )
                        if (promo.status == "pending") {
                            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(onClick = { viewModel.setPromotionStatus(promo.id, "approved") }) { Text("اعتماد الترويج") }
                                OutlinedButton(onClick = { viewModel.setPromotionStatus(promo.id, "rejected") }) { Text("رفض") }
                            }
                        } else {
                            Text(if (promo.status == "approved") "موافق عليه ونشط ✓" else "مرفوض ✗", fontSize = 11.sp, color = SlateMuted)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExternalNetworksSection(viewModel: AdminViewModel) {
    val platformAdsEnabled by viewModel.platformAdsEnabled.collectAsState()
    val config by viewModel.externalAdsConfig.collectAsState()

    var propellerEnabled by remember(config) { mutableStateOf((config["propellerAds"] as? Map<*, *>)?.get("enabled") as? Boolean ?: false) }
    var propellerSnippet by remember(config) { mutableStateOf((config["propellerAds"] as? Map<*, *>)?.get("snippet") as? String ?: "") }
    var adsterraEnabled by remember(config) { mutableStateOf((config["adsterra"] as? Map<*, *>)?.get("enabled") as? Boolean ?: true) }
    var adsterraApkEnabled by remember(config) { mutableStateOf((config["adsterra"] as? Map<*, *>)?.get("appSafe") as? Boolean ?: true) }
    // Adsterra's codes are hardcoded (see AdsterraUnits.kt) — no paste box, one on/off switch per unit.
    var adsterraUnitToggles by remember(config) {
        @Suppress("UNCHECKED_CAST")
        val saved = (config["adsterraUnits"] as? Map<String, Any?>)
            ?.mapNotNull { (k, v) -> (v as? Boolean)?.let { k to it } }?.toMap() ?: emptyMap()
        mutableStateOf(ADSTERRA_UNITS.associate { it.id to (saved[it.id] != false) })
    }
    var taboolaEnabled by remember(config) { mutableStateOf((config["taboola"] as? Map<*, *>)?.get("enabled") as? Boolean ?: false) }
    var taboolaSnippet by remember(config) { mutableStateOf((config["taboola"] as? Map<*, *>)?.get("snippet") as? String ?: "") }
    var estimatedCpm by remember(config) { mutableStateOf((config["estimatedCpmUsd"] as? Number)?.toString() ?: "2") }

    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            DarkCard {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("تفعيل إعلانات المنصة العامة")
                    Switch(checked = platformAdsEnabled, onCheckedChange = { viewModel.setPlatformAdsEnabled(it) })
                }
            }
        }

        item {
            Text(
                "ربط شبكات الإعلانات الخارجية البديلة (PropellerAds/Monetag، Adsterra، Taboola) — الصق كود " +
                    "الإعلان الكامل من لوحة الشبكة، اختر Banner/Native ثابت المقاس فقط.",
                fontSize = 12.sp, color = SlateMuted
            )
        }

        item {
            NetworkCard("PropellerAds (ويشمل Monetag)", propellerEnabled, { propellerEnabled = it }, propellerSnippet) { propellerSnippet = it }
        }
        item {
            AdsterraUnitsCard(
                enabled = adsterraEnabled,
                onEnabledChange = { adsterraEnabled = it },
                apkEnabled = adsterraApkEnabled,
                onApkEnabledChange = { adsterraApkEnabled = it },
                unitToggles = adsterraUnitToggles,
                onUnitToggle = { id, value -> adsterraUnitToggles = adsterraUnitToggles + (id to value) }
            )
        }
        item {
            NetworkCard("Taboola", taboolaEnabled, { taboolaEnabled = it }, taboolaSnippet) { taboolaSnippet = it }
        }

        item {
            OutlinedTextField(
                value = estimatedCpm, onValueChange = { estimatedCpm = it },
                label = { Text("سعر تقديري (USD) لكل 1000 مشاهدة إعلان خارجي في مواضع الكاتب") },
                modifier = Modifier.fillMaxWidth()
            )
        }

        item {
            Button(onClick = {
                viewModel.saveExternalAdsConfig(
                    mapOf(
                        "propellerAds" to mapOf("enabled" to propellerEnabled, "snippet" to propellerSnippet.trim()),
                        "adsterra" to mapOf("enabled" to adsterraEnabled, "snippet" to "", "appSafe" to adsterraApkEnabled),
                        "adsterraUnits" to adsterraUnitToggles,
                        "taboola" to mapOf("enabled" to taboolaEnabled, "snippet" to taboolaSnippet.trim()),
                        "estimatedCpmUsd" to (estimatedCpm.toDoubleOrNull() ?: 2.0)
                    )
                )
            }) { Text("حفظ إعدادات الشبكات الخارجية") }
        }
    }
}

/**
 * Adsterra's real ad-unit codes (7 fixed sizes, see [ADSTERRA_UNITS]) are hardcoded in the app now —
 * no paste box. This card gives one enable/disable switch per unit so an admin can kill a specific
 * annoying ad without disabling every Adsterra banner, plus the network-wide switch and one
 * "متوافقة مع APK" master switch that stops all Adsterra units inside this app specifically (the
 * website is controlled separately from its own admin panel and is unaffected either way).
 */
@Composable
private fun AdsterraUnitsCard(
    enabled: Boolean,
    onEnabledChange: (Boolean) -> Unit,
    apkEnabled: Boolean,
    onApkEnabledChange: (Boolean) -> Unit,
    unitToggles: Map<String, Boolean>,
    onUnitToggle: (String, Boolean) -> Unit
) {
    DarkCard {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Adsterra", fontWeight = FontWeight.Bold)
                Switch(checked = enabled, onCheckedChange = onEnabledChange)
            }
            Text(
                "أكواد Adsterra الحقيقية ثابتة في الشيفرة — أوقف وحدة واحدة إن أزعجت المستخدم بدل إيقاف الجميع.",
                fontSize = 12.sp, color = SlateMuted,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)
            )
            ADSTERRA_UNITS.forEach { unit ->
                val unitEnabled = unitToggles[unit.id] != false
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(unit.label, fontSize = 12.sp, color = SlateMuted)
                    Switch(checked = unitEnabled, onCheckedChange = { onUnitToggle(unit.id, it) })
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(top = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("متوافقة مع نسخة APK (مفتاح شامل)", fontSize = 12.sp, color = SlateMuted)
                Switch(checked = apkEnabled, onCheckedChange = onApkEnabledChange)
            }
        }
    }
}

@Composable
private fun NetworkCard(title: String, enabled: Boolean, onEnabledChange: (Boolean) -> Unit, snippet: String, onSnippetChange: (String) -> Unit) {
    DarkCard {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(title, fontWeight = FontWeight.Bold)
                Switch(checked = enabled, onCheckedChange = onEnabledChange)
            }
            OutlinedTextField(
                value = snippet, onValueChange = onSnippetChange,
                label = { Text("كود <script> الكامل") },
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                minLines = 3
            )
        }
    }
}
