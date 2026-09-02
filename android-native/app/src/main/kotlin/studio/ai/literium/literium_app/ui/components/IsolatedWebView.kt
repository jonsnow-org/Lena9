package studio.ai.literium.literium_app.ui.components

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

/**
 * A single small, isolated `WebView` for rendering third-party HTML/JS this app cannot avoid loading
 * as raw markup — a YouTube/Vimeo `<iframe>` embed ([studio.ai.literium.literium_app.ui.components.VideoEmbed])
 * or an external ad network's raw creative tag
 * ([studio.ai.literium.literium_app.ui.ads.ExternalAdNetworkView]). This is deliberately NOT the
 * app's rendering engine (see the root `build.gradle.kts`/CI workflow KDoc on why this rewrite drops
 * WebView everywhere else) — every other screen in this app is 100% native Compose. Only these two,
 * narrowly-scoped call sites use it, exactly the way the web itself has no native alternative for a
 * third party's own embed/ad markup either.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun IsolatedWebView(html: String? = null, url: String? = null, baseUrl: String? = null, modifier: Modifier = Modifier) {
    AndroidView(
        modifier = modifier.fillMaxWidth(),
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                // مطابق لمنطق الويب في ExternalAdScript.tsx (iframe معزول بلا allow-same-origin): بلا
                // baseUrl لمحتوى الإعلانات الخارجية غير الموثوق (القيمة الافتراضية null هنا)، تحصل
                // صفحة loadDataWithBaseURL على أصل فريد/معزول (شبيه about:blank) بلا وصول لأي
                // تخزين/كوكيز حقيقية لنطاقنا — عزل مكافئ، وليس نفس الآلية حرفياً. تشديد إضافي: بلا
                // وصول لملفات الجهاز، ومحتوى، وموقع جغرافي.
                //
                // ملاحظة: [VideoEmbed] (تضمين يوتيوب/فيميو من طرفنا نحن، وليس محتوى إعلان طرف ثالث)
                // يمرّر baseUrl حقيقياً (نطاق الإنتاج) عمداً — أصل about:blank المعزول هو بالضبط
                // سبب "الخطأ 153" الذي أبلغ عنه مستخدم حقيقي: يوتيوب يرفض التشغيل من أصل iframe بلا
                // نطاق أب حقيقي/مصرَّح.
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                // false هنا (لا true): نقرة المستخدم تحدث على واجهة Compose الأصلية (زر التشغيل
                // المُرسوم فوق الغلاف)، وليست نقرة حقيقية داخل مستند iframe المضمّن — فلا "تنتقل"
                // كإيماءة مستخدم لمحرك YouTube/Vimeo داخل هذا الـ WebView المعزول، ما يجعله يرفض
                // التشغيل (اليوتيوب: "الخطأ 153"، وهو خطأ تضمين/بيئة تشغيل وليس معرّف فيديو).
                settings.mediaPlaybackRequiresUserGesture = false
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                settings.setGeolocationEnabled(false)
                // مطلوب لدعم HTML5 fullscreen الذي تعتمد عليه أغلب تضمينات YouTube/Vimeo — بلا
                // WebChromeClient يبقى WebView صامتاً افتراضياً عن أي طلب onShowCustomView.
                webChromeClient = WebChromeClient()
            }
        },
        update = { webView ->
            when {
                url != null -> webView.loadUrl(url)
                html != null -> webView.loadDataWithBaseURL(baseUrl, html, "text/html", "utf-8", null)
            }
        }
    )
}
