package studio.ai.literium.literium_app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import studio.ai.literium.literium_app.ui.theme.LiteriumTheme

private const val PRODUCTION_HOST = "literium-wjct.onrender.com"
private const val BASE_URL = "https://$PRODUCTION_HOST/"

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val startUrl = resolveStartUrl(intent?.data)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val webView = webViewRef
                if (webView != null && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        setContent {
            LiteriumTheme {
                val context = LocalContext.current
                Surface(modifier = Modifier.fillMaxSize()) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = {
                            WebView(context).apply {
                                webViewRef = this
                                layoutParams = ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.mediaPlaybackRequiresUserGesture = false
                                settings.allowFileAccess = true

                                webViewClient = object : WebViewClient() {
                                    // روابط خارجية (mailto:, tel:, نطاقات خارج موقعنا) تُفتح بمتصفح
                                    // النظام الافتراضي عبر Intent عادي — وليس Custom Tabs — فلا يظهر
                                    // إشعار "قيد التشغيل في Chrome" في هذه الحالة أيضاً.
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
                                }

                                webChromeClient = object : WebChromeClient() {
                                    // لمس <input type="file"> في الموقع (رفع صورة مقال/رسالة/وثيقة
                                    // KYC) — منتقي ملفات حقيقي من الجهاز، مطابق لسلوك نسخة Flutter
                                    // السابقة (file_picker) لكن بلا أي تبعية خارجية هنا.
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
                                }

                                loadUrl(startUrl)
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webViewRef?.loadUrl(resolveStartUrl(intent.data))
    }
}
