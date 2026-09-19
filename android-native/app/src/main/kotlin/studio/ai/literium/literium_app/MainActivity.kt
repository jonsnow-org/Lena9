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
import android.webkit.WebViewClient
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

private const val PRODUCTION_HOST = "literium-wjct.onrender.com"
private const val BASE_URL = "https://$PRODUCTION_HOST/"

// عنوان الصفحة الحقيقي (index.html) لتمييزه عن صفحة "إيقاظ الخدمة" المؤقتة التي
// يعرضها Render نفسه عندما تكون الخدمة نائمة (الخطة المجانية توقفها بعد قلة نشاط) —
// تلك الصفحة HTML صالحة أيضاً فتُطلق onPageFinished مثل أي صفحة حقيقية، لذا العنوان
// وحده هو الفارق الموثوق المتاح هنا لتمييز "جاهز فعلاً" عن "لا يزال يُوقظ الخادم".
private const val REAL_APP_TITLE_MARKER = "LITERIUM"

/**
 * المحتوى الآن هو الموقع الحي نفسه بحذافيره — عبر WebView أصيل (android.webkit.WebView) مباشرة
 * داخل هذا الـActivity، وليس عبر Trusted Web Activity/Chrome Custom Tabs. القرار مقصود: TWA يُظهر
 * دائماً إشعار نظام دائم "قيد التشغيل في Chrome" بصرف النظر عن تحقق Digital Asset Links — هذا سلوك
 * إلزامي من Google لكل جلسة Custom Tabs، وليس خللاً في الإعداد يمكن إصلاحه. WebView خام هنا لا يمرّ
 * عبر خدمة Custom Tabs إطلاقاً، فلا يوجد أي التزام إشعار من النظام — هذا بالضبط ما يجعل تطبيقات
 * Capacitor/Cordova الهجينة لا تُظهر هذا الإشعار مطلقاً خلافاً لأي تطبيق TWA.
 */
private fun resolveStartUrl(uri: Uri?): String {
    if (uri == null) return BASE_URL
    val oobCode = uri.getQueryParameter("oobCode")
    if (uri.getQueryParameter("mode") == "resetPassword" && !oobCode.isNullOrBlank()) {
        return "${BASE_URL}?mode=resetPassword&oobCode=$oobCode"
    }
    val articleId = uri.getQueryParameter("article")
    if (!articleId.isNullOrBlank()) {
        return "${BASE_URL}?article=$articleId"
    }
    return BASE_URL
}

class MainActivity : ComponentActivity() {

    private var webViewRef: WebView? = null
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    // تُقرأ/تُكتب من onPageFinished (Compose state، آمنة من نفس خيط الواجهة الذي
    // يُشغَّل عليه WebViewClient دائماً) — تتحكم بإخفاء شاشة البداية أدناه.
    private var pageReadyState = mutableStateOf(false)
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
                    if (url.host?.endsWith(PRODUCTION_HOST) == true) {
                        return false
                    }
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                        true
                    } catch (_: Exception) {
                        false
                    }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (view?.title?.contains(REAL_APP_TITLE_MARKER, ignoreCase = true) == true) {
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
                    val fresh = buildWebView(this@MainActivity, lastUrl ?: startUrl)
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
        window.statusBarColor = Color.parseColor("#0D9488")
        window.navigationBarColor = Color.parseColor("#0D9488")
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        val startUrl = resolveStartUrl(intent?.data)

        // شبكة أمان: إن لم يتحقق شرط العنوان الحقيقي خلال 45 ثانية لأي سبب غير متوقع
        // (تغيّر عنوان الصفحة الحقيقية، أو صفحة إيقاظ لا تُعيد التوجيه تلقائياً) — يُكشف
        // المحتوى رغم ذلك بدل حبس المستخدم خلف شاشة البداية إلى الأبد. فشل آمن، لا فشل مانع.
        revealTimeoutHandler.postDelayed({ pageReadyState.value = true }, 45_000L)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val webView = webViewRef
                if (webView != null && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    // طلب صريح: تأكيد خروج واحد واضح بدل الاعتماد على ضغطتي رجوع
                    // متتاليتين (نمط "double back to exit" الذي كان يعتمد على منطق
                    // التنبيه (toast) الخاص بالموقع نفسه عبر popstate — غير موثوق هنا
                    // لأن هذا الكولباك يعترض زر الرجوع الفعلي للنظام قبل وصوله لأي
                    // منطق JS في الصفحة أصلاً). حوار نظام أصيل واضح لا لبس فيه.
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("الخروج من التطبيق")
                        .setMessage("هل تريد الخروج من تطبيق ليتيريوم؟")
                        .setPositiveButton("خروج") { _, _ -> finish() }
                        .setNegativeButton("إلغاء", null)
                        .show()
                }
            }
        })

        setContent {
            LiteriumTheme {
                val context = LocalContext.current
                val pageReady by pageReadyState
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
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webViewRef?.loadUrl(resolveStartUrl(intent.data))
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
