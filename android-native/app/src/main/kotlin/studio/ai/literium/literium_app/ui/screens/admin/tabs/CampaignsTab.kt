package studio.ai.literium.literium_app.ui.screens.admin.tabs

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.ArticlePromotion
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.ui.ads.ADSTERRA_UNITS
import studio.ai.literium.literium_app.ui.ads.StartIoAds
import studio.ai.literium.literium_app.ui.screens.admin.AdminViewModel
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

private val BLUE = Color(0xFF2563EB)

/** "مركز الإعلانات والترويج" — ترجمة حرفية لـ AdminAdsTab.tsx بتبويباته الثلاثة. */
@Composable
fun CampaignsTab(
    viewModel: AdminViewModel,
    campaigns: List<AdCampaign>,
    promotions: List<ArticlePromotion>,
    users: List<User>
) {
    var subTab by remember { mutableStateOf("ad_campaigns") }
    val pendingCampaigns = campaigns.count { it.status == "pending" }
    val pendingPromos = promotions.count { it.status == "pending" }
    val tabs = listOf(
        Triple("ad_campaigns", "حملات المعلنين", Lu.Megaphone) to pendingCampaigns,
        Triple("promotions", "ترويج المقالات", Lu.Rocket) to pendingPromos,
        Triple("external_networks", "الشبكات الخارجية", Lu.Globe) to 0
    )

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        AdmCard(bg = Tw.slate900.copy(alpha = 0.9f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.Megaphone, 20.dp, Adm.blue400)
                Text("مركز الإعلانات والترويج", style = twText(16, FontWeight.Bold, 24), color = Color.White)
            }
            Text("إدارة حملات المعلنين، رعاية وترويج مقالات الكُتّاب، والشبكات الإعلانية الخارجية.", Modifier.padding(top = 2.dp, bottom = 16.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).horizontalScroll(rememberScrollState()).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                tabs.forEach { (t, badge) ->
                    val on = subTab == t.first
                    Row(Modifier.clip(RoundedCornerShape(8.dp)).background(if (on) BLUE else Color.Transparent).twClickable(pressScale = 1f) { subTab = t.first }.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(t.third, 14.dp, if (on) Color.White else Tw.slate400)
                        Text(t.second, style = twText(12, FontWeight.Bold, 16), color = if (on) Color.White else Tw.slate400, maxLines = 1)
                        if (badge > 0) Text(arNum(badge.toLong()), Modifier.clip(RoundedCornerShape(50)).background(if (on) Color.White.copy(alpha = 0.2f) else Tw.slate800).padding(horizontal = 6.dp, vertical = 1.dp),
                            style = twText(10, FontWeight.Bold, 14), color = if (on) Color.White else Adm.amber300, fontFamily = Adm.mono)
                    }
                }
            }
        }
        when (subTab) {
            "ad_campaigns" -> CampaignsSection(viewModel, campaigns)
            "promotions" -> PromotionsSection(viewModel, promotions, users)
            else -> ExternalNetworksSection(viewModel)
        }
    }
}

@Composable
private fun StatusBadge(text: String, bg: Color, fg: Color) {
    Text(text, Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 2.dp), style = twText(10, FontWeight.Bold, 14), color = fg)
}

@Composable
private fun CampaignsSection(viewModel: AdminViewModel, campaigns: List<AdCampaign>) {
    var filter by remember { mutableStateOf("all") }
    var search by remember { mutableStateOf("") }
    val reviewingIds by viewModel.reviewingCampaignIds.collectAsState()
    val q = search.trim().lowercase()
    val filtered = campaigns.filter { c ->
        (filter == "all" || c.status == filter) &&
            (q.isEmpty() || c.campaignName.lowercase().contains(q) || c.description.lowercase().contains(q))
    }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        AdmSearch(search, { search = it }, "البحث في الحملات الإعلانية...")
        AdmSegment(listOf("all" to "الكل", "active" to "النشطة", "pending" to "بانتظار الاعتماد", "paused" to "المتوقفة", "rejected" to "المرفوضة"), filter, BLUE) { filter = it }
        if (filtered.isEmpty()) AdmEmpty("لا توجد حملات إعلانية تطابق هذا البحث أو الفلتر.")
        else filtered.forEach { camp ->
            val isPlatformAd = camp.advertiserId.isNullOrBlank()
            val reviewing = camp.id in reviewingIds
            AdmCard {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    AdmFlow {
                        when (camp.status) {
                            "active" -> StatusBadge("نشطة ✓", Adm.emerald500, Tw.slate950)
                            "pending" -> StatusBadge("بانتظار تمويل المعلن ⏳", Adm.amber500, Tw.slate950)
                            "paused" -> StatusBadge("متوقفة مؤقتاً", Tw.slate700, Tw.slate300)
                            else -> StatusBadge("مرفوضة ✗", Adm.rose500, Color.White)
                        }
                        if (isPlatformAd) AdmBadge("إعلان منصة (100%)", Adm.blue300, Adm.blue500.copy(alpha = 0.2f), Adm.blue500.copy(alpha = 0.3f), mono = false)
                        else AdmBadge("معلن خارجي", Color(0xFFD8B4FE), Color(0xFFA855F7).copy(alpha = 0.2f), Color(0xFFA855F7).copy(alpha = 0.3f), mono = false)
                    }
                    Text(camp.campaignName, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (camp.imageUrl.isNotBlank()) {
                        AsyncImage(camp.imageUrl, camp.campaignName, Modifier.fillMaxWidth().height(112.dp).clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                    }
                    Text(camp.description, style = twText(12, FontWeight.Normal, 20), color = Tw.slate400, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800.copy(alpha = 0.8f), RoundedCornerShape(12.dp)).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        @Composable
                        fun Cell(label: String, value: String, color: Color, m: Modifier) {
                            Column(m, horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(label, style = twText(10, FontWeight.Normal, 14), color = Tw.slate500)
                                Text(value, style = twText(12, FontWeight.Bold, 16), color = color, fontFamily = Adm.mono)
                            }
                        }
                        Cell("الميزانية", "$" + (if (camp.status == "pending") camp.requestedBudget ?: 0.0 else camp.totalBudget).toString().removeSuffix(".0"), Color.White, Modifier.weight(1f))
                        Cell("المُنفَق", Adm.usd(camp.totalSpent), Adm.amber400, Modifier.weight(1f))
                        Cell("الظهور", "${camp.impressionsCount}", Adm.blue400, Modifier.weight(1f))
                        Cell("النقرات", "${camp.clicksCount}", Adm.emerald400, Modifier.weight(1f))
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(Tw.slate800.copy(alpha = 0.6f)))
                AdmFlow {
                    when (camp.status) {
                        "pending" -> {
                            AdmButton(if (reviewing) "جارٍ التنفيذ..." else "موافقة وتفعيل", { viewModel.reviewCampaign(camp.id, true) }, Adm.emerald600, icon = Lu.CheckCircle2, enabled = !reviewing)
                            AdmButton("رفض", { viewModel.reviewCampaign(camp.id, false) }, Tw.slate800, Tw.slate300, icon = Lu.XCircle, enabled = !reviewing)
                        }
                        "paused" -> {
                            AdmButton("استئناف", { viewModel.setCampaignStatus(camp.id, "active") }, Adm.emerald600, icon = Lu.Play)
                            AdmButton("رفض", { viewModel.setCampaignStatus(camp.id, "rejected") }, Tw.slate800, Tw.slate400)
                        }
                        "active" -> {
                            AdmButton("إيقاف مؤقت", { viewModel.setCampaignStatus(camp.id, "paused") }, Tw.slate800, Tw.slate300, icon = Lu.Pause)
                            AdmButton("رفض", { viewModel.setCampaignStatus(camp.id, "rejected") }, Tw.slate800, Tw.slate400)
                        }
                    }
                    AdmButton("حذف الحملة نهائياً", { viewModel.deleteCampaign(camp.id) }, Tw.slate800, Tw.slate400, icon = Lu.Trash2)
                }
            }
        }
    }
}

@Composable
private fun PromotionsSection(viewModel: AdminViewModel, promotions: List<ArticlePromotion>, users: List<User>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("طلبات ترويج المقالات من الكُتّاب (${promotions.size})", style = twText(14, FontWeight.Black, 20), color = Color.White)
        if (promotions.isEmpty()) AdmEmpty("لا توجد طلبات ترويج مقالات حالياً.")
        else promotions.forEach { promo ->
            val writer = users.find { it.id == promo.writerId }
            AdmCard {
                when (promo.status) {
                    "pending" -> StatusBadge("بانتظار الاعتماد", Adm.amber500, Tw.slate950)
                    "approved" -> StatusBadge("موافق عليه ونشط ✓", Adm.emerald500, Tw.slate950)
                    else -> StatusBadge("مرفوض ✗", Adm.rose500, Color.White)
                }
                Text(promo.articleTitle ?: promo.articleId, style = twText(14, FontWeight.Bold, 20), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("الكاتب: ${writer?.fullName ?: promo.writerId} • التكلفة: $${promo.cost} • ${if (promo.pricingModel == "cpc") "الدفع لكل نقرة" else "سعر ثابت"}", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                if (promo.status == "pending") {
                    AdmFlow {
                        AdmButton("اعتماد الترويج", { viewModel.setPromotionStatus(promo.id, "approved") }, Adm.emerald600)
                        AdmButton("رفض", { viewModel.setPromotionStatus(promo.id, "rejected") }, Tw.slate800, Tw.slate300)
                    }
                }
            }
        }
    }
}

@Composable
private fun ToggleBtn(on: Boolean, onText: String, offText: String, small: Boolean = false, onClick: () -> Unit) {
    Text(if (on) onText else offText,
        Modifier.clip(RoundedCornerShape(if (small) 6.dp else 8.dp)).background(if (on) Adm.emerald600 else Tw.slate800).twClickable { onClick() }.padding(horizontal = if (small) 8.dp else 10.dp, vertical = if (small) 2.dp else 4.dp),
        style = twText(10, FontWeight.Bold, 14), color = if (on) Color.White else Tw.slate400)
}

@Composable
private fun ApkSafeRow(on: Boolean, label: String, onText: String, offText: String, onClick: () -> Unit) {
    val s = RoundedCornerShape(8.dp)
    Row(
        Modifier.fillMaxWidth().clip(s).background(if (on) Color(0xFF0D9488).copy(alpha = 0.2f) else Tw.slate900)
            .border(1.dp, if (on) Color(0xFF0D9488).copy(alpha = 0.4f) else Tw.slate800, s).twClickable { onClick() }.padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, Modifier.weight(1f), style = twText(10, FontWeight.Bold, 14), color = if (on) Color(0xFF5EEAD4) else Tw.slate500)
        Text(if (on) onText else offText, style = twText(10, FontWeight.Bold, 14), color = if (on) Color(0xFF5EEAD4) else Tw.slate500)
    }
}

@Composable
private fun ExternalNetworksSection(viewModel: AdminViewModel) {
    val platformAdsEnabled by viewModel.platformAdsEnabled.collectAsState()
    val config by viewModel.externalAdsConfig.collectAsState()
    fun sub(k: String) = config[k] as? Map<*, *>

    var dirty by remember(config) { mutableStateOf(false) }
    var savedMsg by remember { mutableStateOf("") }
    var propellerEnabled by remember(config) { mutableStateOf(sub("propellerAds")?.get("enabled") as? Boolean ?: false) }
    var propellerSnippet by remember(config) { mutableStateOf(sub("propellerAds")?.get("snippet") as? String ?: "") }
    var propellerAppSafe by remember(config) { mutableStateOf(sub("propellerAds")?.get("appSafe") as? Boolean ?: false) }
    var adsterraEnabled by remember(config) { mutableStateOf(sub("adsterra")?.get("enabled") as? Boolean ?: false) }
    var adsterraApkEnabled by remember(config) { mutableStateOf(sub("adsterra")?.get("appSafe") as? Boolean ?: false) }
    var adsterraUnitToggles by remember(config) {
        @Suppress("UNCHECKED_CAST")
        val saved = (config["adsterraUnits"] as? Map<String, Any?>)?.mapNotNull { (k, v) -> (v as? Boolean)?.let { k to it } }?.toMap() ?: emptyMap()
        mutableStateOf(ADSTERRA_UNITS.associate { it.id to (saved[it.id] != false) })
    }
    var taboolaEnabled by remember(config) { mutableStateOf(sub("taboola")?.get("enabled") as? Boolean ?: false) }
    var taboolaSnippet by remember(config) { mutableStateOf(sub("taboola")?.get("snippet") as? String ?: "") }
    var taboolaAppSafe by remember(config) { mutableStateOf(sub("taboola")?.get("appSafe") as? Boolean ?: false) }
    var monetagEnabled by remember(config) { mutableStateOf(sub("monetag")?.get("enabled") as? Boolean ?: false) }
    var startIoEnabled by remember(config) { mutableStateOf(sub("startIo")?.get("enabled") as? Boolean ?: true) }
    var estimatedCpm by remember(config) { mutableStateOf((config["estimatedCpmUsd"] as? Number)?.toString() ?: "2") }

    @Composable
    fun Net(title: String, content: @Composable () -> Unit) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tw.slate950).border(1.dp, Tw.slate800, RoundedCornerShape(12.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
    @Composable
    fun NetHeader(title: String, on: Boolean, onToggle: () -> Unit) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(title, Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = Color.White)
            ToggleBtn(on, "مفعّلة ✓", "معطّلة") { onToggle(); dirty = true }
        }
    }
    @Composable
    fun Note(text: String, color: Color = Tw.slate400) = Text(text, style = twText(11, FontWeight.Normal, 18), color = color)

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        AdmCard(padding = 20.dp) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("تفعيل شبكة إعلانات المنصة العامة", style = twText(14, FontWeight.Bold, 20), color = Color.White)
                    Text("التحكم في ظهور الإعلانات العامة (Banner / Native) في التغذية الرئيسية وصفحات الاستكشاف.", Modifier.padding(top = 2.dp), style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                }
                Text(if (platformAdsEnabled) "مفعلة حالياً ✓" else "معطلة",
                    Modifier.padding(start = 12.dp).clip(RoundedCornerShape(12.dp)).background(if (platformAdsEnabled) Adm.emerald600 else Tw.slate800).twClickable { viewModel.setPlatformAdsEnabled(!platformAdsEnabled) }.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = twText(12, FontWeight.Black, 16), color = if (platformAdsEnabled) Color.White else Tw.slate400)
            }
        }

        AdmCard(padding = 20.dp) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.Globe, 16.dp, Adm.blue400)
                Text("ربط شبكات الإعلانات الخارجية البديلة (Fallback Ad Networks)", style = twText(14, FontWeight.Bold, 20), color = Color.White)
            }
            Note("إذا لم تكن هناك حملات محلية نشطة للمعلنين، يمكن ملء المساحات الشاغرة تلقائياً عبر شبكات خارجية مثل PropellerAds أو Adsterra أو Taboola أو Monetag لتعظيم الدخل السلبي. الصق كود الإعلان الكامل (وسم <script> كاملاً) كما هو من لوحة الشبكة، ثم فعّل المفتاح.")
            Text("⚠️ مهم عند توليد الكود من لوحة الشبكة: اختر نوع وحدة إعلانية "Banner" أو "Native Banner" بمقاس ثابت (مثل 300x250 أو 320x50) فقط. لا تستخدم أنواع "Social Bar" / "In-Page Push" / "Popunder" — هذه الأنواع مصمَّمة لتغطية الشاشة كإشعار عائم على أي موقع، وحمايتنا الأمنية (عزل الإعلان داخل إطار معزول تماماً) تمنعها من تغطية الشاشة هنا لكنها قد تظهر فارغة لأنها غير مصمَّمة أصلاً للعرض داخل صندوق صغير.",
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Adm.amber500.copy(alpha = 0.1f)).border(1.dp, Adm.amber500.copy(alpha = 0.3f), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
                style = twText(11, FontWeight.Normal, 18), color = Adm.amber400)

            Net("PropellerAds") {
                NetHeader("PropellerAds (ويشمل Monetag)", propellerEnabled) { propellerEnabled = !propellerEnabled }
                AdmInput(propellerSnippet, { propellerSnippet = it; dirty = true }, "الصق كود <script> الكامل من PropellerAds/Monetag هنا", minLines = 4, mono = true)
                ApkSafeRow(propellerAppSafe, "متوافقة مع نسخة APK", "مفعّل ✓", "غير مؤكَّد بعد") { propellerAppSafe = !propellerAppSafe; dirty = true }
            }
            Net("Adsterra") {
                NetHeader("Adsterra", adsterraEnabled) { adsterraEnabled = !adsterraEnabled }
                Note("أكواد Adsterra الحقيقية (المُلصَقة من لوحة الشبكة) ثابتة في كود التطبيق نفسه الآن — لا مربع لصق بعد اليوم. لكل وحدة إعلانية مفتاح تفعيل/إيقاف مستقل: إن ظهر إعلان مزعج من نوع معيّن، أوقفه وحده بضغطة بدل إيقاف كل البنرات والبطاقات.")
                ADSTERRA_UNITS.forEach { unit ->
                    val on = adsterraUnitToggles[unit.id] != false
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Tw.slate900).border(1.dp, Tw.slate800, RoundedCornerShape(8.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(unit.label, Modifier.weight(1f), style = twText(11, FontWeight.Normal, 16), color = Tw.slate200, fontFamily = Adm.mono)
                        ToggleBtn(on, "مفعّلة ✓", "معطّلة", small = true) { adsterraUnitToggles = adsterraUnitToggles + (unit.id to !on); dirty = true }
                    }
                }
                ApkSafeRow(adsterraApkEnabled, "متوافقة مع نسخة APK (مفتاح شامل لكل الوحدات أعلاه)", "مفعّل ✓", "موقَفة عن APK") { adsterraApkEnabled = !adsterraApkEnabled; dirty = true }
            }
            Net("Taboola") {
                NetHeader("Taboola", taboolaEnabled) { taboolaEnabled = !taboolaEnabled }
                AdmInput(taboolaSnippet, { taboolaSnippet = it; dirty = true }, "الصق كود Publisher Tag الكامل من Taboola هنا", minLines = 4, mono = true)
                ApkSafeRow(taboolaAppSafe, "متوافقة مع نسخة APK", "مفعّل ✓", "غير مؤكَّد بعد") { taboolaAppSafe = !taboolaAppSafe; dirty = true }
            }
            Net("Monetag") {
                NetHeader("Monetag", monetagEnabled) { monetagEnabled = !monetagEnabled }
                Note("كود المالك الحقيقي (نوع "Vignette" — بيني كامل الشاشة يظهر أحياناً بين تنقلات الصفحة) ثابت في كود التطبيق نفسه — لا مربع لصق. مفتاح واحد فقط للتشغيل/الإيقاف الكامل، بدل مواضع متعددة كـ Adsterra، لأن هذا النوع لا يرتبط بموضع محدد في صفحة معيّنة أصلاً.")
                Note("مستبعدة عن نسخة APK دائماً وبلا أي خيار — هذا النوع يحقن سكربتاً في متصفح الويب مباشرة، ولا يوجد محرك متصفح مماثل داخل تطبيق الجوال الأصلي إطلاقاً.", Tw.slate500)
            }
            Net("Start.io") {
                NetHeader("Start.io (تطبيق APK فقط)", startIoEnabled) { startIoEnabled = !startIoEnabled }
                Note("شريط إعلاني أصلي (App ID: ${StartIoAds.APP_ID}) يظهر أسفل شاشة تطبيق الجوال فقط، ولا يظهر في الموقع. يُخفى تلقائياً عند إيقاف إعلانات المنصة من المفتاح العام.")
            }

            Text("⚠️ "متوافقة مع نسخة APK" لا تؤثر على ظهور الشبكة بالموقع (المتصفح) إطلاقاً — تتحكم فقط بظهورها داخل تطبيق APK حال بنائه لاحقاً. اتركها معطّلة لأي شبكة لم تؤكّد لك بنفسك (بالتواصل معها مباشرة) أن سياستها تسمح بعرض نفس هذا الكود داخل تطبيق مثبَّت، لا موقع ويب فقط — AdSense تحديداً يمنع هذا صراحة.",
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0xFF451A03).copy(alpha = 0.3f)).border(1.dp, Color(0xFF92400E).copy(alpha = 0.4f), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
                style = twText(11, FontWeight.Normal, 18), color = Adm.amber300.copy(alpha = 0.9f))

            Net("CPM") {
                Text("سعر تقديري لكل 1000 مشاهدة إعلان خارجي في مواضع الكاتب (USD)", style = twText(12, FontWeight.Bold, 16), color = Color.White)
                Note("لا تخبرنا الشبكات الخارجية بقيمة كل مشاهدة بالدولار، فنعتمد رقماً ثابتاً تحدّده أنت لحساب حصة الكاتب من مشاهدات إعلانات هذه الشبكات في مقالاته وملفه الشخصي — مستقل تماماً عن أرباحك الحقيقية في لوحة الشبكة نفسها.")
                AdmInput(estimatedCpm, { estimatedCpm = it; dirty = true }, "2", modifier = Modifier.width(128.dp), mono = true, keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal)
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (dirty) AdmButton("حفظ إعدادات الشبكات الخارجية", {
                    viewModel.saveExternalAdsConfig(
                        mapOf(
                            "propellerAds" to mapOf("enabled" to propellerEnabled, "snippet" to propellerSnippet.trim(), "appSafe" to propellerAppSafe),
                            "adsterra" to mapOf("enabled" to adsterraEnabled, "snippet" to "", "appSafe" to adsterraApkEnabled),
                            "adsterraUnits" to adsterraUnitToggles,
                            "taboola" to mapOf("enabled" to taboolaEnabled, "snippet" to taboolaSnippet.trim(), "appSafe" to taboolaAppSafe),
                            "monetag" to mapOf("enabled" to monetagEnabled),
                            "startIo" to mapOf("enabled" to startIoEnabled),
                            "estimatedCpmUsd" to maxOf(0.0, estimatedCpm.toDoubleOrNull() ?: 0.0)
                        )
                    )
                    dirty = false; savedMsg = "تم الحفظ بنجاح ✓"
                }, BLUE, size = 12)
                if (savedMsg.isNotEmpty()) Text(savedMsg, style = twText(12, FontWeight.Bold, 16), color = Adm.emerald400)
            }
        }
    }
}
