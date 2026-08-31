package studio.ai.literium.literium_app.ui.screens.kyc

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.MenuAnchorType
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
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun KycScreen(navController: NavController, viewModel: KycViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.onImagePicked(context, it) }
    }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("التحقق من الهوية (KYC)") },
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

        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp)) {
            when {
                state.isVerified -> ResultCard(
                    icon = Icons.Filled.CheckCircle,
                    tint = MaterialTheme.colorScheme.primary,
                    title = "حسابك موثق ومعتمد بنجاح ✓",
                    message = "تمت مراجعة وثيقتك واعتماد حسابك. يمكنك الآن سحب وإيداع الأرباح بحرية كاملة، وتُحتسب أرباح الإعلانات والمبيعات لحسابك عند استيفاء بقية شروط منشئ المحتوى.",
                    buttonLabel = "إتمام والعودة",
                    onButtonClick = { navController.popBackStack() }
                )
                state.isPending || state.justSubmitted -> ResultCard(
                    icon = Icons.Filled.Schedule,
                    tint = MaterialTheme.colorScheme.tertiary,
                    title = "تم إرسال طلب التوثيق — قيد المراجعة",
                    message = "استلمنا وثيقتك وسيراجعها فريق ليتيريوم يدوياً خلال 24 إلى 48 ساعة. سيصلك إشعار فور اعتماد حسابك.",
                    buttonLabel = "حسناً، فهمت",
                    onButtonClick = { navController.popBackStack() }
                )
                else -> KycForm(state, viewModel, pickImage)
            }

            Spacer(Modifier.height(20.dp))
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(14.dp)) {
                    Text("لماذا التحقق من الهوية إلزامي؟", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "التحقق من الهوية شرط إلزامي أخير لاحتساب أرباح الإعلانات والمبيعات لحسابك — بالإضافة إلى شروط المتابعين والمشاهدات وعمر الحساب وعدد المقالات المنشورة. الكتابة والنشر متاحان لك دائماً بلا أي شرط.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

@Composable
private fun ResultCard(
    icon: ImageVector,
    tint: Color,
    title: String,
    message: String,
    buttonLabel: String,
    onButtonClick: () -> Unit
) {
    Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        Button(onClick = onButtonClick) { Text(buttonLabel) }
    }
}

@Composable
private fun KycForm(
    state: KycUiState,
    viewModel: KycViewModel,
    pickImage: ActivityResultLauncher<String>
) {
    if (state.isRejected) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer), modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(12.dp)) {
                Icon(Icons.Filled.Warning, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(
                    "تم رفض طلب التوثيق السابق. راجع بياناتك وأرسل طلباً جديداً بمعلومات ووثيقة صحيحة وواضحة.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        Spacer(Modifier.height(14.dp))
    }

    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Row(Modifier.padding(12.dp)) {
            Icon(Icons.Filled.Lock, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(
                "صورة وثيقتك تُرفع مباشرة إلى خوادمنا بشكل آمن ومشفَّر ولا تُعرض علناً أبداً. تُستخدم فقط لمطابقة اسمها مع اسم حسابك آلياً.",
                style = MaterialTheme.typography.bodySmall
            )
        }
    }

    Spacer(Modifier.height(16.dp))
    var dropdownExpanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = dropdownExpanded, onExpandedChange = { dropdownExpanded = it }) {
        OutlinedTextField(
            value = state.idType,
            onValueChange = {},
            readOnly = true,
            label = { Text("نوع الوثيقة الرسمية") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable)
        )
        DropdownMenu(expanded = dropdownExpanded, onDismissRequest = { dropdownExpanded = false }) {
            KYC_ID_TYPES.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        viewModel.onIdTypeChange(option)
                        dropdownExpanded = false
                    }
                )
            }
        }
    }

    Spacer(Modifier.height(14.dp))
    OutlinedTextField(
        value = state.idNumber,
        onValueChange = viewModel::onIdNumberChange,
        label = { Text("رقم الوثيقة / الهوية") },
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(Modifier.height(14.dp))
    Text("صورة واضحة للوثيقة (يظهر فيها اسمك كاملاً)", style = MaterialTheme.typography.labelMedium)
    Spacer(Modifier.height(6.dp))
    if (state.previewUri != null) {
        AsyncImage(
            model = state.previewUri,
            contentDescription = "معاينة الوثيقة",
            modifier = Modifier.fillMaxWidth().height(180.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "تغيير الصورة",
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.clickable { pickImage.launch("image/*") }
        )
    } else {
        Box(
            Modifier.fillMaxWidth().height(140.dp)
                .border(2.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
                .clickable { pickImage.launch("image/*") },
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.CameraAlt, contentDescription = null)
                Spacer(Modifier.height(6.dp))
                Text("انقر لاختيار صورة الوثيقة", style = MaterialTheme.typography.labelMedium)
                Text("JPG أو PNG، حتى 8 ميغابايت", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }

    Spacer(Modifier.height(20.dp))
    val context = LocalContext.current
    Button(
        onClick = { viewModel.submit(context) },
        enabled = state.canSubmit,
        modifier = Modifier.fillMaxWidth()
    ) {
        if (state.isSubmitting) {
            CircularProgressIndicator(Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary)
            Spacer(Modifier.width(8.dp))
            Text("جاري رفع الوثيقة والتحقق...")
        } else {
            Text("إرسال طلب التوثيق (KYC)")
        }
    }
}
