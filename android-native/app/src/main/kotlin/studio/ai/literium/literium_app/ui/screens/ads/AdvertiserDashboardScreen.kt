package studio.ai.literium.literium_app.ui.screens.ads

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import studio.ai.literium.literium_app.data.model.AdCampaign
import studio.ai.literium.literium_app.data.model.CampaignStatus
import studio.ai.literium.literium_app.navigation.Screen
import studio.ai.literium.literium_app.util.RevenueShares
import java.util.Locale

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun AdvertiserDashboardScreen(navController: NavController, viewModel: AdvertiserDashboardViewModel = viewModel()) {
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
                title = { Text("لوحة تحكم المعلن") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "عودة")
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.NewCampaign.route) }) {
                        Icon(Icons.Filled.Add, contentDescription = "حملة جديدة")
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

        Column(Modifier.fillMaxSize().padding(padding)) {
            // Metric cards
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetricCard("الظهور الصالح", "${state.totalImpressions}", Modifier.weight(1f))
                MetricCard("النقرات المؤكدة", "${state.totalClicks}", Modifier.weight(1f))
            }
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetricCard("نقرات محجوبة (احتيال)", "${state.totalFraudBlocked}", Modifier.weight(1f))
                MetricCard("الإنفاق الفعلي", String.format(Locale.US, "$%.2f", state.totalSpent), Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))

            TabRow(selectedTabIndex = state.activeTab.ordinal) {
                Tab(selected = state.activeTab == AdvertiserDashboardTab.CAMPAIGNS, onClick = { viewModel.selectTab(AdvertiserDashboardTab.CAMPAIGNS) }, text = { Text("الحملات (${state.myCampaigns.size})") })
                Tab(selected = state.activeTab == AdvertiserDashboardTab.ANALYTICS, onClick = { viewModel.selectTab(AdvertiserDashboardTab.ANALYTICS) }, text = { Text("مكافحة الاحتيال") })
                Tab(selected = state.activeTab == AdvertiserDashboardTab.BILLING, onClick = { viewModel.selectTab(AdvertiserDashboardTab.BILLING) }, text = { Text("الفوترة") })
            }

            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                when (state.activeTab) {
                    AdvertiserDashboardTab.CAMPAIGNS -> CampaignsTab(state.myCampaigns, navController, viewModel)
                    AdvertiserDashboardTab.ANALYTICS -> AntiFraudExplainerTab()
                    AdvertiserDashboardTab.BILLING -> BillingTab(state.advertiserBalance, navController)
                }
            }
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(Modifier.padding(12.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun CampaignsTab(campaigns: List<AdCampaign>, navController: NavController, viewModel: AdvertiserDashboardViewModel) {
    val uriHandler = LocalUriHandler.current
    if (campaigns.isEmpty()) {
        Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Filled.Campaign, contentDescription = null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))
            Text("لا توجد حملات إعلانية منشأة بعد", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Button(onClick = { navController.navigate(Screen.NewCampaign.route) }) { Text("إنشاء أول إعلان الآن") }
        }
        return
    }

    campaigns.forEach { campaign ->
        Card(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Column(Modifier.padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    AsyncImage(
                        model = campaign.imageUrl,
                        contentDescription = null,
                        modifier = Modifier.size(56.dp).clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(campaign.campaignName, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatusChip(campaign.status)
                            Text(
                                when (campaign.pricingModel) {
                                    "fixed" -> "ثابت (مدة)"
                                    "cpm" -> "CPM (ظهور)"
                                    else -> "CPC (نقرات)"
                                },
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(campaign.adText, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(6.dp))
                Text(
                    "الظهور: ${campaign.impressionsCount}  •  النقرات: ${campaign.clicksCount}  •  الإنفاق: ${String.format(Locale.US, "%.2f", campaign.totalSpent)}$/${String.format(Locale.US, "%.2f", campaign.totalBudget)}$" +
                        if ((campaign.blockedFraudClicks ?: 0) > 0) "  •  حظر ${campaign.blockedFraudClicks} نقرة مشبوهة 🛡️" else "",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { viewModel.toggleCampaignStatus(campaign.id) }) {
                        Icon(
                            if (campaign.status == CampaignStatus.ACTIVE) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(if (campaign.status == CampaignStatus.ACTIVE) "إيقاف" else "تفعيل")
                    }
                    IconButton(onClick = { runCatching { uriHandler.openUri(campaign.destinationUrl) } }) {
                        Icon(Icons.Filled.OpenInNew, contentDescription = "معاينة الرابط")
                    }
                    IconButton(onClick = { viewModel.deleteCampaign(campaign.id) }) {
                        Icon(Icons.Filled.Delete, contentDescription = "حذف")
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val label = when (status) {
        CampaignStatus.ACTIVE -> "نشطة 🟢"
        CampaignStatus.PAUSED -> "متوقفة ⏸️"
        CampaignStatus.PENDING -> "بانتظار المراجعة"
        CampaignStatus.REJECTED -> "مرفوضة"
        else -> "مكتملة"
    }
    Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
}

@Composable
private fun AntiFraudExplainerTab() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Shield, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text("درع الحماية ومكافحة الاحتيال الإعلاني", fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(12.dp))
            ProtectionRow("فحص الرؤية (Viewability)", "لا تُخصم أي ميزانية لنموذج CPM إلا بعد ثبات 50% من مساحة الإعلان في شاشة القارئ لثانية متصلة.")
            ProtectionRow("منع النقر الذاتي", "حظر فوري لأي نقرات يقوم بها صاحب المقال على إعلاناتك، وحماية ميزانيتك من الهدر.")
            ProtectionRow("كشف البوتات والنقرات المتسارعة", "استبعاد النقرات التي تحدث في أقل من 1.5 ثانية من فتح الصفحة وفلترة الزيارات الآلية.")
        }
    }
}

@Composable
private fun ProtectionRow(title: String, desc: String) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
        Text(desc, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun BillingTab(balance: Double, navController: NavController) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("الرصيد المتاح حالياً", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(6.dp))
            Text(String.format(Locale.US, "$%.2f", balance), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(10.dp))
            Text(
                "يتم السحب تلقائياً من الرصيد مع كل ظهور أو نقرة مؤكدة وصالحة فقط.",
                style = MaterialTheme.typography.bodySmall,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(Modifier.height(14.dp))
            Button(onClick = { navController.navigate(Screen.MoneyRequest.of(isDeposit = true)) }) {
                Text("شحن الرصيد الآن")
            }
        }
    }
    Spacer(Modifier.height(16.dp))
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(14.dp)) {
            Text("قواعد توزيع العوائد للحملات داخل مقالات الكتّاب:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
            Text("• ${RevenueShares.IN_ARTICLE_ADS.label}", style = MaterialTheme.typography.labelSmall)
            Text("• صفحات الكتّاب الشخصية: ${RevenueShares.WRITER_PROFILE_ADS.label}", style = MaterialTheme.typography.labelSmall)
        }
    }
}
