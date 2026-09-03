package studio.ai.literium.literium_app.ui.screens.errorlog

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import studio.ai.literium.literium_app.AppErrorLog
import studio.ai.literium.literium_app.LoggedError

/**
 * سجل أخطاء دائم يجمع كل ما التقطه [AppErrorLog] — أعطال قاتلة + فشل شبكة —
 * في مكان واحد، مع زر "نسخ التقرير كاملاً" يهيّئ نصاً جاهزاً للصق مباشرة في
 * محادثة الدعم. يحل هذا مشكلة شاشة العطل الوحيدة السابقة ([studio.ai.literium.literium_app.CrashReportActivity])
 * التي تختفي فور إغلاقها ولا تُبقي أي أثر رجعي.
 *
 * متاح لأي مستخدم عبر القائمة الجانبية — وليس الأدمن فقط — لأن أي شخص قد
 * يحتاج التقاط عطل وإرساله للدعم الفني.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ErrorLogScreen(navController: NavController) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var entries by remember { mutableStateOf(AppErrorLog.getAll(context)) }
    var copiedFeedback by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                },
                title = { Text("سجل الأخطاء (${entries.size})", style = MaterialTheme.typography.titleLarge) }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    modifier = Modifier.weight(1f),
                    enabled = entries.isNotEmpty(),
                    onClick = {
                        clipboard.setText(AnnotatedString(AppErrorLog.buildReportText(context)))
                        copiedFeedback = true
                    }
                ) {
                    Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                    androidx.compose.foundation.layout.Spacer(Modifier.width(6.dp))
                    Text(if (copiedFeedback) "تم نسخ التقرير ✓" else "نسخ التقرير كاملاً")
                }
                OutlinedButton(
                    enabled = entries.isNotEmpty(),
                    onClick = {
                        AppErrorLog.clear(context)
                        entries = emptyList()
                        copiedFeedback = false
                    }
                ) {
                    Icon(Icons.Filled.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp))
                    androidx.compose.foundation.layout.Spacer(Modifier.width(6.dp))
                    Text("مسح")
                }
            }

            if (entries.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Filled.BugReport,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        Text("لا توجد أخطاء مسجَّلة — كل شيء يعمل بسلام حالياً.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                return@Scaffold
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(entries, key = { it.time + it.source + it.message }) { entry ->
                    ErrorEntryCard(entry)
                }
            }
        }
    }
}

@Composable
private fun ErrorEntryCard(entry: LoggedError) {
    var expanded by remember { mutableStateOf(false) }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(12.dp)
        ) {
            Text(entry.time, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(entry.source, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(entry.message, fontSize = 12.sp)
            if (expanded) {
                Text(
                    entry.stack,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp)
                )
            } else {
                Text(
                    "اضغط لعرض تفاصيل الخطأ الكاملة",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
