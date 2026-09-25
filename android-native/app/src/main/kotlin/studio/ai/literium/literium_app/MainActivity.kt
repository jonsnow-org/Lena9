package studio.ai.literium.literium_app

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebViewClient
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import android.widget.EditText
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import studio.ai.literium.literium_app.ui.theme.LiteriumTheme

private val HOSTS = arrayOf(
    "literium.ai.studio",
    "literium-wjct.onrender.com"
)

private const val REAL_APP_TITLE_MARKER = "LITERIUM"

/**
 * المحتوى الآن هو الموقع الحي نفسه بحذافيره — عبر WebView أصيل (android.webkit.WebView) مباشرة
 * داخل هذا الـActivity، وليس عبر Trusted Web Activity/Chrome Custom Tabs. القرار مقصود: TWA يُظهر
 * دائماً إشعار نظام دائم "قيد التشغيل في Chrome" بصرف النظر عن تحقق Digital Asset Links — هذا سلوك
 * إلزامي من Google لكل جلسة Custom Tabs، وليس خللاً في الإعداد يمكن إصلاحه. WebView خام هنا لا يمرّ
 * عبر خدمة Custom Tabs إطلاقاً، فلا يوجد أي التزام إشعار من النظام — هذا بالضبط ما يجعل تطبيقات
 * Capacitor/Cordova الهجينة لا تُظهر هذا الإشعار مطلقاً خلافاً لأي تطبيق TWA.
 */
private fun resolveStartUrl(uri: Uri?, host: String = HOSTS[0]): String {
    val base = "https://$host/"
    if (uri == null) return base
    val oobCode = uri.getQueryParameter("oobCode")
    if (uri.getQueryParameter("mode") == "resetPassword" && !oobCode.isNullOrBlank()) {
        return "${base}?mode=resetPassword&oobCode=$oobCode"
    }
    val articleId = uri.getQueryParameter("article")
    if (!articleId.isNullOrBlank()) {
        return "${base}?article=$articleId"
    }
    return base
}

class MainActivity : ComponentActivity() {

    private var webViewRef: WebView? = null
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var pageReadyState = mutableStateOf(false)
    private var loadFailedState = mutableStateOf(false)
    private var activeHostIndex = 0
    private var lastShareAt = 0L
    private val revealTimeoutHandler = Handler(Looper.getMainLooper())

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = pendingFileCallback
        pendingFileCallback = null
        val uris = if (result.resultCode == RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else {
            null
        }
        callback?.onReceiveValue(uris)
    }

    // بلا هذا الإذن الصريح على أندرويد 13+ (API 33+)، أي push فعلي يصل والتطبيق
    // في الخلفية يُسقَط بصمت (الإذن في AndroidManifest.xml وحده غير كافٍ منذ
    // هذا الإصدار — إذن "خطر" (dangerous) يتطلب طلباً وقت التشغيل).
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* رفض المستخدم يعني فقط عدم وصول إشعارات نظام — لا حاجة لأي تعامل هنا */ }

    // يمرّر رمز FCM الحالي إلى صفحة الموقع الحيّة عبر جسر JS بسيط — كود الموقع
    // (installState.ts) يملك سياق المصادقة الحقيقي (WebView الأصيل هنا لا يملك
    // أي جلسة Firebase Auth خاصة به) فهو من يحفظ الرمز فعلياً في مستند المستخدم.
    private fun bridgeFcmTokenToWebView(token: String) {
        val encoded = JSONObject.quote(token)
        webViewRef?.evaluateJavascript(
            "window.__literiumFcmToken && window.__literiumFcmToken($encoded)",
            null
        )
    }

    private fun applySystemBars(colorHex: String, lightBackground: Boolean) {
        val color = try { Color.parseColor(colorHex) } catch (_: Exception) { return }
        window.statusBarColor = color
        window.navigationBarColor = color
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightBackground
            isAppearanceLightNavigationBars = lightBackground
        }
    }

    private fun openNativeShareSheet(title: String, text: String, url: String) {
        val now = System.currentTimeMillis()
        if (now - lastShareAt < 1_000L) return
        lastShareAt = now
        val body = listOf(text, url).filter { it.isNotBlank() }.joinToString("\n")
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title)
            putExtra(Intent.EXTRA_TEXT, body)
        }
        try {
            startActivity(Intent.createChooser(send, title.ifBlank { "مشاركة" }))
        } catch (e: Exception) {
            AppErrorLog.record(this, "فتح نافذة المشاركة", e)
        }
    }

    /**
     * قناة رسائل بين الموقع والتطبيق، مقيَّدة بأصل موقعنا فقط — إطارات الإعلانات
     * (iframes) من نطاقات أخرى لا ترى هذا الكائن إطلاقاً، بخلاف addJavascriptInterface
     * الذي يُحقن في كل إطار بلا تمييز.
     */
    private fun installNativeBridge(webView: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(
            webView,
            "LiteriumNative",
            HOSTS.map { "https://$it" }.toSet()
        ) { _, message, _, isMainFrame, _ ->
            if (!isMainFrame) return@addWebMessageListener
            val json = try { JSONObject(message.data ?: return@addWebMessageListener) } catch (_: Exception) { return@addWebMessageListener }
            when (json.optString("type")) {
                "share" -> openNativeShareSheet(
                    json.optString("title"),
                    json.optString("text"),
                    json.optString("url")
                )
                "systemBars" -> applySystemBars(json.optString("color"), json.optBoolean("light"))
                "haptic" -> webView.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
            }
        }
    }

    private fun showExitDialog() {
        AlertDialog.Builder(this@MainActivity)
            .setTitle("الخروج من التطبيق")
            .setMessage("هل تريد الخروج من تطبيق ليتيريوم؟")
            .setPositiveButton("خروج") { _, _ -> finish() }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    /**
     * منذ أندرويد O، محرّك WebView يعمل دوماً في عملية (process) منفصلة عن عملية التطبيق
     * — هذا هو السبب الأرجح للإغلاق الإجباري الذي كان يحدث عند أول فتح للتطبيق فقط ثم
     * يختفي عند إعادة الفتح: مباشرة بعد التثبيت يكون الجهاز تحت ضغط إدخال/إخراج وذاكرة
     * (فهرسة الحزمة، تهيئة مجلد بيانات WebView لأول مرة...)، فتموت عملية المحرّك بسهولة
     * أكبر من المعتاد. بلا تخصيص [WebViewClient.onRenderProcessGone]، السلوك الافتراضي
     * الموثَّق رسمياً لأندرويد هو **إسقاط عملية التطبيق المضيف بأكملها** حين تموت عملية
     * المحرّك — أي عطل حقيقي، لكنه عطل على مستوى النظام لا استثناء Java، فلا يظهر إطلاقاً
     * في AppErrorLog ولا Crashlytics (وهذا يفسّر عدم وجود أي أثر مسجَّل لهذا العطل تحديداً).
     * الحل: عند موت المحرّك، إزالة WebView المعطوب من شجرة العرض وتدميره، ثم بناء نسخة
     * جديدة كاملة الإعداد وإدراجها في نفس المكان بدل ترك النظام يُسقط التطبيق بأكمله.
     */
    private fun buildWebView(context: android.content.Context, startUrl: String): WebView {
        return WebView(context).apply {
            webViewRef = this
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            setBackgroundColor(Color.parseColor("#0D2968"))
            installNativeBridge(this)
            // أي رابط تنزيل (ملف/APK) يُسلَّم للنظام بدل أن يبدو الضغط عليه بلا أثر.
            setDownloadListener { url, _, _, _, _ ->
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: Exception) {
                }
            }
            settings.userAgentString =
                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 " +
                    "LiteriumNativeApp/1"

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: android.webkit.WebResourceRequest?
                ): Boolean {
                    val url = request?.url ?: return false
                    if (HOSTS.any { url.host?.endsWith(it) == true }) {
                        return false
                    }
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                        true
                    } catch (_: Exception) {
                        false
                    }
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        if (activeHostIndex < HOSTS.size - 1) {
                            activeHostIndex++
                            view?.loadUrl(resolveStartUrl(intent?.data, HOSTS[activeHostIndex]))
                        } else {
                            loadFailedState.value = true
                        }
                    }
                }

                override fun onReceivedHttpError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    errorResponse: WebResourceResponse?
                ) {
                    super.onReceivedHttpError(view, request, errorResponse)
                    val code = errorResponse?.statusCode ?: 0
                    if (request?.isForMainFrame == true && code in 500..599) {
                        if (activeHostIndex < HOSTS.size - 1) {
                            activeHostIndex++
                            view?.loadUrl(resolveStartUrl(intent?.data, HOSTS[activeHostIndex]))
                        } else {
                            loadFailedState.value = true
                        }
                    }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (view?.title?.contains(REAL_APP_TITLE_MARKER, ignoreCase = true) == true) {
                        loadFailedState.value = false
                        pageReadyState.value = true
                        try {
                            FirebaseMessaging.getInstance().token
                                .addOnSuccessListener { token -> bridgeFcmTokenToWebView(token) }
                                .addOnFailureListener { e ->
                                    AppErrorLog.record(this@MainActivity, "جلب رمز FCM", e)
                                }
                        } catch (e: Exception) {
                            AppErrorLog.record(this@MainActivity, "جلب رمز FCM", e)
                        }
                    }
                }

                override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                    AppErrorLog.record(
                        this@MainActivity,
                        "توقف عملية محرّك WebView (Renderer)",
                        RuntimeException(
                            "didCrash=${detail?.didCrash()} rendererPriorityAtExit=${detail?.rendererPriorityAtExit()}"
                        )
                    )
                    val crashed = view ?: return false
                    val parent = crashed.parent as? ViewGroup ?: return false
                    val index = parent.indexOfChild(crashed)
                    val lastUrl = crashed.url
                    parent.removeView(crashed)
                    crashed.destroy()
                    val fresh = buildWebView(this@MainActivity, lastUrl ?: resolveStartUrl(intent?.data, HOSTS[activeHostIndex]))
                    parent.addView(
                        fresh,
                        index,
                        ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    )
                    return true
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    pendingFileCallback = filePathCallback
                    val intent = fileChooserParams?.createIntent()
                        ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "*/*"
                        }
                    return try {
                        fileChooserLauncher.launch(intent)
                        true
                    } catch (_: Exception) {
                        pendingFileCallback = null
                        false
                    }
                }

                override fun onJsAlert(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    result: JsResult?
                ): Boolean {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("حسناً") { _, _ -> result?.confirm() }
                        .setOnCancelListener { result?.confirm() }
                        .setCancelable(false)
                        .show()
                    return true
                }

                override fun onJsConfirm(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    result: JsResult?
                ): Boolean {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("موافق") { _, _ -> result?.confirm() }
                        .setNegativeButton("إلغاء") { _, _ -> result?.cancel() }
                        .setOnCancelListener { result?.cancel() }
                        .show()
                    return true
                }

                override fun onJsPrompt(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    defaultValue: String?,
                    result: JsPromptResult?
                ): Boolean {
                    val input = EditText(this@MainActivity).apply {
                        setText(defaultValue)
                    }
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setView(input)
                        .setPositiveButton("موافق") { _, _ -> result?.confirm(input.text.toString()) }
                        .setNegativeButton("إلغاء") { _, _ -> result?.cancel() }
                        .setOnCancelListener { result?.cancel() }
                        .show()
                    return true
                }
            }

            loadUrl(startUrl)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        // بلا enableEdgeToEdge(): على أندرويد 15+ (targetSdk 36 هنا) يفرض النظام قد يفرض
        // edge-to-edge بصرف النظر عن هذا الاستدعاء، لذا الاعتماد الوحيد الموثوق هو حشو
        // المحتوى فعلياً حسب حواف النظام (أدناه، عبر windowInsetsPadding) بدل الاعتماد على
        // عدم استدعاء enableEdgeToEdge وحده. نفس لون العلامة التجارية المعتمد في
        // manifest.json (theme_color) على الشريطين لتطابق ما يظهر عند تثبيت الموقع كـPWA.
        // لون شاشة البداية نفسه؛ بعد التحميل يضبط الموقع لون الشريطين ليطابق رأس
        // الصفحة الفعلي (فاتح/داكن) عبر قناة LiteriumNative — فلا يبدو شريط
        // الحالة "إطار متصفح" منفصلاً فوق المحتوى.
        applySystemBars("#0D2968", false)

        val startUrl = resolveStartUrl(intent?.data, HOSTS[activeHostIndex])

        // شبكة أمان: إن لم يتحقق شرط العنوان الحقيقي خلال 45 ثانية لأي سبب غير متوقع
        // (تغيّر عنوان الصفحة الحقيقية، أو صفحة إيقاظ لا تُعيد التوجيه تلقائياً) — يُكشف
        // المحتوى رغم ذلك بدل حبس المستخدم خلف شاشة البداية إلى الأبد. فشل آمن، لا فشل مانع.
        revealTimeoutHandler.postDelayed({ pageReadyState.value = true }, 45_000L)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val webView = webViewRef
                if (webView != null && pageReadyState.value && !loadFailedState.value) {
                    // زر الرجوع يُغلق أعلى شاشة مفتوحة داخل التطبيق (مقال، ملف، نافذة...)
                    // كما في أي تطبيق أصيل؛ وعند الشاشة الرئيسية يظهر تأكيد الخروج مباشرة.
                    webView.evaluateJavascript(
                        "(function(){try{return window.__literiumHandleBack?window.__literiumHandleBack():null}catch(e){return null}})()"
                    ) { result ->
                        when (result) {
                            "true" -> Unit
                            "false" -> showExitDialog()
                            else -> if (webView.canGoBack()) webView.goBack() else showExitDialog()
                        }
                    }
                } else {
                    // طلب صريح: تأكيد خروج واحد واضح بدل الاعتماد على ضغطتي رجوع
                    // متتاليتين (نمط "double back to exit" الذي كان يعتمد على منطق
                    // التنبيه (toast) الخاص بالموقع نفسه عبر popstate — غير موثوق هنا
                    // لأن هذا الكولباك يعترض زر الرجوع الفعلي للنظام قبل وصوله لأي
                    // منطق JS في الصفحة أصلاً). حوار نظام أصيل واضح لا لبس فيه.
                    showExitDialog()
                }
            }
        })

        setContent {
            LiteriumTheme {
                val context = LocalContext.current
                val pageReady by pageReadyState
                val loadFailed by loadFailedState
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        // الإصلاح الفعلي لالتصاق شريطي الموقع بحواف الشاشة: حشوة حقيقية بمقدار
                        // ارتفاع شريط الحالة/شريط التنقل الحاليين، بدل ترك WebView يرسم تحتهما.
                        .windowInsetsPadding(WindowInsets.systemBars)
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { buildWebView(context, startUrl) }
                    )

                    // تُغطي WebView بالكامل حتى تتحقق شاشة العنوان الحقيقي أعلاه — يستمر
                    // WebView بالتحميل خلفها بلا انقطاع، فتظهر شاشتنا فوراً فقط دون أي وميض
                    // لصفحة "إيقاظ الخدمة" الخاصة بـRender مهما استغرقت.
                    AnimatedVisibility(
                        visible = !pageReady,
                        exit = fadeOut(),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(ComposeColor(0xFF0D2968)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Image(
                                    painter = painterResource(id = R.drawable.ic_launcher_foreground),
                                    contentDescription = null,
                                    // ضغط مطوَّل على شعار شاشة البداية يفتح سجل الأخطاء الدائم —
                                    // المخرج التشخيصي الوحيد المتاح للمستخدم حين يظهر عطل قاتل
                                    // للحظة قصيرة فقط قبل إغلاق التطبيق (انظر LiteriumApplication.kt)
                                    // ولا تتاح فرصة كافية لقراءة/نسخ شاشة العطل التلقائية نفسها.
                                    modifier = Modifier
                                        .size(140.dp)
                                        .pointerInput(Unit) {
                                            detectTapGestures(onLongPress = {
                                                ErrorLogActivity.launch(context)
                                            })
                                        }
                                )
                                CircularProgressIndicator(
                                    color = ComposeColor.White,
                                    modifier = Modifier
                                        .padding(top = 24.dp)
                                        .size(32.dp)
                                )
                            }
                        }
                    }

                    if (loadFailed) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(ComposeColor(0xFF0D2968)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.padding(32.dp)
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.ic_launcher_foreground),
                                    contentDescription = null,
                                    modifier = Modifier.size(110.dp)
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = "تعذّر الاتصال",
                                    color = ComposeColor.White,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "تحقق من اتصالك بالإنترنت ثم حاول مجدداً.",
                                    color = ComposeColor(0xCCFFFFFF),
                                    fontSize = 14.sp,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(24.dp))
                                Button(
                                    onClick = {
                                        loadFailedState.value = false
                                        activeHostIndex = 0
                                        webViewRef?.loadUrl(resolveStartUrl(intent?.data, HOSTS[activeHostIndex]))
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = ComposeColor(0xFF0D9488),
                                        contentColor = ComposeColor.White
                                    )
                                ) {
                                    Text(text = "إعادة المحاولة", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webViewRef?.loadUrl(resolveStartUrl(intent.data, HOSTS[activeHostIndex]))
    }

    // foregroundTokenListener مُسجَّل فقط بين onResume/onPause عمداً (وليس طوال
    // عمر الـActivity كما بين onCreate/onDestroy): FcmService.onMessageReceived
    // يعتمد على وجوده لتمييز "التطبيق مرئي فعلياً الآن" عن "التطبيق في الخلفية
    // لكن عمليته لا تزال حيّة" — الفرق الوحيد الموثوق بين الحالتين هو دورة حياة
    // onResume/onPause، وليس onCreate/onDestroy التي لا تُستدعى إلا عند إغلاق
    // الـActivity فعلياً.
    override fun onResume() {
        super.onResume()
        FcmService.foregroundTokenListener = { token -> bridgeFcmTokenToWebView(token) }
    }

    override fun onPause() {
        FcmService.foregroundTokenListener = null
        super.onPause()
    }

    override fun onDestroy() {
        revealTimeoutHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
