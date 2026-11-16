package studio.ai.literium.literium_app.ui.screens.ads

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.AdPlacementType
import studio.ai.literium.literium_app.data.model.CampaignStatus
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.ui.theme.Lu
import studio.ai.literium.literium_app.ui.theme.LuIcon
import studio.ai.literium.literium_app.ui.theme.Tw
import studio.ai.literium.literium_app.ui.theme.arNum
import studio.ai.literium.literium_app.ui.theme.brand
import studio.ai.literium.literium_app.ui.theme.twClickable
import studio.ai.literium.literium_app.ui.theme.twText

private val Mono = FontFamily.Monospace

/**
 * لوحة المعلن — AdvertiserDashboard.tsx (داكنة دائماً كما في الويب): ترويسة تدرّج brand-950→slate-900→brand-950،
 * تبويبات داخل slate-900، أربع بطاقات أرقام، ثم الحملات/التقارير/الفوترة.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdvertiserDashboardScreen(navController: NavController, viewModel: AdvertiserDashboardViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val ctx = LocalContext.current
    LaunchedEffect(state.error) {
        state.error?.let { android.widget.Toast.makeText(ctx, it, android.widget.Toast.LENGTH_SHORT).show(); viewModel.clearError() }
    }
    val card = RoundedCornerShape(24.dp)
    val line = brand.s500.copy(alpha = 0.20f)

    if (state.isLoading) { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Tw.teal600) }; return }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 64.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        item {
            Row(Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate900).twClickable { navController.popBackStack() }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LuIcon(Lu.ArrowRight, 16.dp, Tw.slate300)
                Text("رجوع", style = twText(12, FontWeight.Bold, 16), color = Tw.slate300)
            }
        }
        // الترويسة
        item {
            Column(Modifier.fillMaxWidth().clip(card).background(Brush.horizontalGradient(listOf(brand.s950, Tw.slate900, brand.s950))).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        val ib = RoundedCornerShape(16.dp)
                        Box(Modifier.size(36.dp).clip(ib).background(brand.s600.copy(alpha = 0.30f)).border(1.dp, brand.s500.copy(alpha = 0.40f), ib), contentAlignment = Alignment.Center) { LuIcon(Lu.Megaphone, 20.dp, brand.s300) }
                        Text("لوحة تحكم المعلن والحملات الإعلانية", Modifier.weight(1f), style = twText(20, FontWeight.Black, 28), color = Tw.white)
                    }
                    Text("أطلق إعلاناتك بنماذج تسعير ذكية (Fixed / CPM / CPC) مع حماية فائقة ضد النقرات الوهمية", style = twText(12, FontWeight.Normal, 18), color = Tw.slate300)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    val b = RoundedCornerShape(16.dp)
                    Row(Modifier.clip(b).background(brand.s900.copy(alpha = 0.40f)).border(1.dp, brand.s500.copy(alpha = 0.40f), b).twClickable { navController.navigate(Screen.MoneyRequest.of(isDeposit = true)) }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LuIcon(Lu.DollarSign, 16.dp, Tw.emerald400)
                        Text("الرصيد: $${"%.2f".format(state.advertiserBalance)}", style = twText(12, FontWeight.Bold, 16), color = brand.s200)
                    }
                    Row(Modifier.clip(b).background(brand.s600).twClickable { navController.navigate(Screen.NewCampaign.route) }.padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LuIcon(Lu.PlusCircle, 16.dp, Tw.white)
                        Text("إنشاء حملة جديدة", style = twText(12, FontWeight.Bold, 16), color = Tw.white)
                    }
                }
            }
        }
        // التبويبات
        item {
            val tb = RoundedCornerShape(16.dp)
            Row(Modifier.fillMaxWidth().clip(tb).background(Tw.slate900).border(1.dp, line, tb).horizontalScroll(rememberScrollState()).padding(6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple(AdvertiserDashboardTab.CAMPAIGNS, "الحملات النشطة (${arNum(state.myCampaigns.size.toLong())})", Lu.Megaphone),
                    Triple(AdvertiserDashboardTab.ANALYTICS, "تقارير الأداء ومكافحة الاحتيال", Lu.BarChart3),
                    Triple(AdvertiserDashboardTab.BILLING, "الميزانية وشحن الرصيد", Lu.DollarSign)
                ).forEach { (tab, label, icon) ->
                    val active = state.activeTab == tab
                    Row(Modifier.clip(RoundedCornerShape(12.dp)).background(if (active) brand.s600 else Color.Transparent).twClickable { viewModel.selectTab(tab) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LuIcon(icon, 16.dp, if (active) Tw.white else Tw.slate400)
                        Text(label, style = twText(12, FontWeight.Bold, 16), color = if (active) Tw.white else Tw.slate400, maxLines = 1)
                    }
                }
            }
        }
        // البطاقات الأربع
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Stat("إجمالي الظهور الصالح", Lu.Eye, brand.s400, arNum(state.totalImpressions), "فحص بقاء 50% لأكثر من 1ث", Tw.emerald400, Tw.white, line, Modifier.weight(1f))
                    Stat("النقرات المؤكدة", Lu.MousePointerClick, Color(0xFF22D3EE), arNum(state.totalClicks), "معدل النقر ${"%.2f".format(state.avgCtr)}%", brand.s300, Tw.white, line, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Stat("النقرات المشبوهة المحجوبة", Lu.ShieldAlert, Tw.rose400, arNum(state.totalFraudBlocked), "تم توفير ميزانيتك 100%", Tw.emerald400, Tw.rose400, line, Modifier.weight(1f))
                    Stat("إجمالي الإنفاق الفعلي", Lu.DollarSign, Tw.emerald400, "$${"%.2f".format(state.totalSpent)}", "من أصل $${"%.2f".format(state.totalBudget)}", brand.s300, Tw.emerald400, line, Modifier.weight(1f), mono = true)
                }
            }
        }

        when (state.activeTab) {
            AdvertiserDashboardTab.CAMPAIGNS -> item {
                Column(Modifier.fillMaxWidth().clip(card).background(Tw.slate900).border(1.dp, line, card).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            LuIcon(Lu.Megaphone, 20.dp, brand.s400)
                            Text("إدارة الحملات الإعلانية ومعدلات الأمان", style = twText(14, FontWeight.Bold, 20), color = Tw.white)
                        }
                    }
                    Row(Modifier.clip(RoundedCornerShape(12.dp)).background(brand.s600).twClickable { navController.navigate(Screen.NewCampaign.route) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LuIcon(Lu.PlusCircle, 16.dp, Tw.white); Text("إنشاء حملة جديدة", style = twText(12, FontWeight.Bold, 16), color = Tw.white)
                    }
                    if (state.myCampaigns.isEmpty()) {
                        val eb = RoundedCornerShape(16.dp)
                        Column(Modifier.fillMaxWidth().clip(eb).background(Tw.slate950.copy(alpha = 0.60f)).border(1.dp, brand.s500.copy(alpha = 0.10f), eb).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            LuIcon(Lu.Megaphone, 40.dp, Tw.slate500)
                            Text("لا توجد حملات إعلانية منشأة بعد", Modifier.padding(top = 8.dp), style = twText(14, FontWeight.Bold, 20), color = Tw.slate300)
                            Box(Modifier.padding(top = 12.dp).clip(RoundedCornerShape(12.dp)).background(brand.s600).twClickable { navController.navigate(Screen.NewCampaign.route) }.padding(horizontal = 16.dp, vertical = 8.dp)) { Text("إنشاء أول إعلان الآن", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
                        }
                    } else state.myCampaigns.forEach { c -> CampaignRow(c, ctx, { viewModel.toggleCampaignStatus(c.id) }, { viewModel.deleteCampaign(c.id) }) }
                }
            }
            AdvertiserDashboardTab.ANALYTICS -> item {
                Column(Modifier.fillMaxWidth().clip(card).background(Tw.slate900).border(1.dp, line, card).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LuIcon(Lu.ShieldCheck, 24.dp, Tw.emerald400)
                        Column {
                            Text("درع الحماية ومكافحة الاحتيال الإعلاني", style = twText(14, FontWeight.Bold, 20), color = Tw.white)
                            Text("قواعد آلية للتحقق من صحة النقرات والمشاهدات قبل احتسابها", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                        }
                    }
                    Box(Modifier.clip(CircleShape).background(Tw.emerald500.copy(alpha = 0.20f)).border(1.dp, Tw.emerald500.copy(alpha = 0.30f), CircleShape).padding(horizontal = 12.dp, vertical = 4.dp)) { Text("الحماية مفعلة ونشطة", style = twText(12, FontWeight.Bold, 16), color = Color(0xFF6EE7B7)) }
                    Rule("فحص الرؤية (Viewability)", brand.s300, "لا تُخصم أي ميزانية لنموذج CPM إلا بعد ثبات 50% من مساحة الإعلان في شاشة القارئ لثانية متصلة على الأقل.", line)
                    Rule("منع النقر الذاتي (Anti Self-Click)", Color(0xFF67E8F9), "حظر فوري لأي نقرات يقوم بها صاحب المقال على إعلاناتك، وحماية ميزانيتك من الهدر.", line)
                    Rule("كشف البوتات والنقرات المتسارعة", Color(0xFFFDA4AF), "استبعاد النقرات التي تحدث في أقل من 1.5 ثانية من فتح الصفحة وفلترة الزيارات الآلية.", line)
                }
            }
            AdvertiserDashboardTab.BILLING -> item {
                Column(Modifier.fillMaxWidth().clip(card).background(Tw.slate900).border(1.dp, line, card).padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    Column {
                        Text("رصيد الإعلانات والفوترة", style = twText(14, FontWeight.Bold, 20), color = Tw.white)
                        Text("اشحن رصيدك عبر البطاقات البنكية، Apple Pay، أو USDT TRC20", style = twText(11, FontWeight.Normal, 16), color = Tw.slate400)
                    }
                    Box(Modifier.clip(RoundedCornerShape(16.dp)).background(brand.s600).twClickable { navController.navigate(Screen.MoneyRequest.of(isDeposit = true)) }.padding(horizontal = 24.dp, vertical = 10.dp)) { Text("شحن الرصيد الآن", style = twText(12, FontWeight.Bold, 16), color = Tw.white) }
                    val bb = RoundedCornerShape(16.dp)
                    Column(Modifier.fillMaxWidth().clip(bb).background(Tw.slate950).border(1.dp, brand.s500.copy(alpha = 0.15f), bb).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("الرصيد المتاح حالياً", style = twText(12, FontWeight.Normal, 16), color = Tw.slate400)
                        Text("$${"%.2f".format(state.advertiserBalance)}", Modifier.padding(vertical = 4.dp), style = twText(30, FontWeight.Black, 36).copy(fontFamily = Mono), color = Tw.emerald400)
                        Text("يتم السحب تلقائياً من الرصيد مع كل ظهور أو نقرة مؤكدة وصالحة فقط", style = twText(12, FontWeight.Normal, 16).copy(textAlign = TextAlign.Center), color = Tw.slate300)
                    }
                }
            }
        }
    }
}

@Composable
private fun Stat(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, iconTint: Color, value: String, sub: String, subTint: Color, valueTint: Color, line: Color, modifier: Modifier, mono: Boolean = false) {
    val s = RoundedCornerShape(16.dp)
    Column(modifier.shadow(1.dp, s, clip = false).clip(s).background(Tw.slate900).border(1.dp, line, s).padding(20.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(title, Modifier.weight(1f), style = twText(12, FontWeight.Bold, 16), color = Tw.slate400, maxLines = 2)
            LuIcon(icon, 16.dp, iconTint)
        }
        Text(value, style = twText(20, FontWeight.Black, 28).let { if (mono) it.copy(fontFamily = Mono) else it }, color = valueTint)
        Text(sub, style = twText(10, FontWeight.Bold, 15), color = subTint)
    }
}

@Composable
private fun Rule(title: String, tone: Color, body: String, line: Color) {
    val s = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(s).background(Tw.slate950).border(1.dp, brand.s500.copy(alpha = 0.15f), s).padding(16.dp)) {
        Text(title, Modifier.padding(bottom = 4.dp), style = twText(12, FontWeight.Bold, 16), color = tone)
        Text(body, style = twText(12, FontWeight.Normal, 20), color = Tw.slate300)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CampaignRow(c: AdCampaign, ctx: android.content.Context, onToggle: () -> Unit, onDelete: () -> Unit) {
    val s = RoundedCornerShape(16.dp)
    val (stLabel, stBg, stFg) = when (c.status) {
        CampaignStatus.ACTIVE -> Triple("نشطة 🟢", Tw.emerald500.copy(alpha = 0.20f), Color(0xFF6EE7B7))
        CampaignStatus.PAUSED -> Triple("متوقفة مؤقتاً ⏸️", Tw.amber500.copy(alpha = 0.20f), Color(0xFFFCD34D))
        CampaignStatus.PENDING -> Triple("بانتظار مراجعة الإدارة ⏳", Tw.amber500.copy(alpha = 0.20f), Color(0xFFFCD34D))
        CampaignStatus.REJECTED -> Triple("مرفوضة", Tw.rose500.copy(alpha = 0.20f), Color(0xFFFDA4AF))
        else -> Triple("مكتملة", Tw.slate800, Tw.slate400)
    }
    Column(Modifier.fillMaxWidth().clip(s).background(Tw.slate950.copy(alpha = 0.60f)).border(1.dp, brand.s500.copy(alpha = 0.15f), s).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            AsyncImage(c.imageUrl, c.campaignName, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(c.campaignName, style = twText(14, FontWeight.Bold, 20), color = Tw.white)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Chip(stLabel, stBg, stFg)
                    Chip(when (c.pricingModel) { "fixed" -> "ثابت (مدة)"; "cpm" -> "CPM (ظهور)"; else -> "CPC (نقرات)" }, brand.s500.copy(alpha = 0.20f), brand.s300)
                    Chip(if (c.placementType == AdPlacementType.PLATFORM) "إعلان المنصة (100%)" else "إعلان المنصة", brand.s500.copy(alpha = 0.20f), brand.s300)
                }
                Text(c.adText, style = twText(12, FontWeight.Normal, 16), color = Tw.slate300, maxLines = 1, overflow = TextOverflow.Ellipsis)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    val m = twText(11, FontWeight.Normal, 16).copy(fontFamily = Mono)
                    Text("الظهور: ${c.impressionsCount}", style = m, color = brand.s300)
                    Text("النقرات: ${c.clicksCount}", style = m, color = Color(0xFF67E8F9))
                    Text("الإنفاق: $${"%.2f".format(c.totalSpent)} / $${"%.2f".format(if (c.totalBudget > 0) c.totalBudget else (c.requestedBudget ?: 0.0))}", style = m, color = Tw.emerald400)
                    val fr = c.blockedFraudClicks ?: 0L
                    if (fr > 0) Text("حظر $fr نقرة مشبوهة 🛡️", style = m.copy(fontWeight = FontWeight.Bold), color = Tw.rose400)
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
            if (c.status == CampaignStatus.ACTIVE || c.status == CampaignStatus.PAUSED) {
                val act = c.status == CampaignStatus.ACTIVE
                val tone = if (act) Color(0xFFFCD34D) else Color(0xFF6EE7B7)
                val base = if (act) Tw.amber500 else Tw.emerald500
                Row(Modifier.clip(RoundedCornerShape(12.dp)).background(base.copy(alpha = 0.20f)).border(1.dp, base.copy(alpha = 0.40f), RoundedCornerShape(12.dp)).twClickable(onClick = onToggle).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LuIcon(if (act) Lu.Pause else Lu.Play, 14.dp, tone); Text(if (act) "إيقاف" else "تفعيل", style = twText(12, FontWeight.Bold, 16), color = tone)
                }
            }
            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate800).twClickable { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(c.destinationUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }.padding(8.dp)) { LuIcon(Lu.ExternalLink, 16.dp, Tw.slate200) }
            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Tw.slate800).twClickable(onClick = onDelete).padding(8.dp)) { LuIcon(Lu.Trash2, 16.dp, Tw.slate300) }
        }
    }
}

@Composable
private fun Chip(text: String, bg: Color, fg: Color) {
    Box(Modifier.clip(CircleShape).background(bg).padding(horizontal = 8.dp, vertical = 2.dp)) { Text(text, style = twText(10, FontWeight.Bold, 15), color = fg) }
}
