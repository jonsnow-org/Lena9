package studio.ai.literium.literium_app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import studio.ai.literium.literium_app.navigation.LiteriumNavHost
import studio.ai.literium.literium_app.ui.theme.LiteriumTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            // الموقع الحي بالكامل dir="rtl" افتراضياً (عربي أولاً) — نفس
            // الافتراض هنا بدل انتظار كشف لغة الجهاز، مطابقاً للسلوك الفعلي.
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                LiteriumTheme {
                    Surface(modifier = Modifier.fillMaxSize()) {
                        LiteriumNavHost()
                    }
                }
            }
        }
    }
}
