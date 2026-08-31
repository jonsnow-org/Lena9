package studio.ai.literium.literium_app.ui.screens.aiassistant

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Login
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.navigation.Screen

/**
 * "المساعد الذكي ليتيريوم" — Compose port of `AiAssistantModal.tsx`: a
 * chat feed with quick-shortcut prompts, a live daily/monthly quota bar,
 * and a login/upgrade gate — talking to `POST /api/ai/chat` exactly per
 * [AiAssistantViewModel]'s documented request shape.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiAssistantScreen(
    navController: NavController,
    viewModel: AiAssistantViewModel = remember { AiAssistantViewModel() }
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                },
                title = { Text("المساعد الذكي ليتيريوم") }
            )
        }
    ) { padding ->
        val user = currentUser
        if (user == null) {
            Column(
                Modifier.fillMaxSize().padding(padding).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.padding(bottom = 12.dp))
                Text("تسجيل الدخول إجباري لاستخدام المساعد الذكي", fontWeight = FontWeight.Black)
                Text(
                    "لحماية استهلاك الخدمة وتقديم تجربة مخصصة لك، يتطلب الذكاء الاصطناعي تسجيل الدخول. " +
                        "يحصل كل مستخدم جديد على 10 استخدامات مجانية كل 24 ساعة.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
                )
                Button(onClick = { navController.navigate(Screen.Login.route) }) {
                    Icon(Icons.Filled.Login, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                    Text("تسجيل الدخول / إنشاء حساب مجاناً")
                }
            }
            return@Scaffold
        }

        val stats = viewModel.quotaStats(user)
        val isOutOfQuota = !stats.isUnlimited && stats.remaining <= 0

        Column(Modifier.fillMaxSize().padding(padding)) {
            // Quota bar
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (stats.isSubscriber) {
                    Text(
                        if (stats.plan == "annual") "مشترك VIP السنوي (استخدام غير محدود)"
                        else "مشترك Pro (متبقي ${stats.remaining} استخدام شهري)",
                        style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold
                    )
                } else {
                    Text("تبقى لك ${stats.remaining} من ${stats.limit} استخدامات مجانية اليوم", style = MaterialTheme.typography.labelSmall)
                }
                if (!stats.isSubscriber) {
                    OutlinedButton(onClick = { navController.navigate(Screen.Subscription.route) }) { Text("ترقية الباقة") }
                }
            }

            // Quick shortcuts
            LazyRow(
                Modifier.fillMaxWidth().padding(vertical = 6.dp),
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(
                    listOf(
                        "💰 نظام الأرباح" to "كيف يتم توزيع أرباح إعلانات Google AdSense والمقالات المقفولة؟",
                        "🛡️ توثيق KYC والسحب" to "كيف أقوم بتوثيق حسابي (KYC) وسحب الأرباح؟",
                        "📢 إطلاق إعلان" to "كيف أنشئ حملة إعلانية بالنقرات CPC أو مدة ثابتة؟"
                    )
                ) { (label, prompt) ->
                    OutlinedButton(onClick = { if (!isOutOfQuota) viewModel.sendMessage(prompt, user) }) { Text(label) }
                }
            }

            // Chat feed
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(messages, key = { it.id }) { msg ->
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = if (msg.isUser) Arrangement.End else Arrangement.Start
                    ) {
                        Card(
                            modifier = Modifier.widthIn(max = 320.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (msg.isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Column(Modifier.padding(10.dp)) {
                                Text(
                                    msg.text,
                                    color = if (msg.isUser) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    msg.timestamp,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (msg.isUser) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
                if (isLoading) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp))
                            Text("جاري المعالجة وتوليد الإجابة...", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            if (isOutOfQuota) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Text(
                        "استنفدت الاستخدامات المجانية لليوم. ترقية الباقة تمنحك استخداماً فورياً غير محدود.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    enabled = !isOutOfQuota && !isLoading,
                    placeholder = { Text(if (isOutOfQuota) "انتهت الاستخدامات المجانية لليوم..." else "اكتب استفسارك هنا...") },
                    modifier = Modifier.weight(1f)
                )
                IconButton(
                    enabled = inputText.isNotBlank() && !isLoading && !isOutOfQuota,
                    onClick = {
                        val text = inputText
                        inputText = ""
                        scope.launch { viewModel.sendMessage(text, user) }
                    }
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "إرسال")
                }
            }
        }
    }
}
