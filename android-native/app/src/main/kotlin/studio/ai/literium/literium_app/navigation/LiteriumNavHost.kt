package studio.ai.literium.literium_app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

/**
 * ⚠️ حالة مؤقتة: يحتوي فقط وجهة Splash نائبة حتى تكتمل شاشات المصادقة
 * والتنقل الحقيقية (المرحلة التالية). هذا الملف سيُستبدل بالكامل برسم
 * بياني حقيقي يغطي كل الوجهات المعرَّفة في Screen.kt بمجرد اكتمال تلك
 * المرحلة — موجود الآن فقط ليبقى المشروع قابلاً للبناء والتحقق من صحة
 * الهيكل الأساسي (Gradle + Firebase + Compose) بشكل مستقل أولاً.
 */
@Composable
fun LiteriumNavHost() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = Screen.Splash.route) {
        composable(Screen.Splash.route) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("ليتيريوم")
            }
        }
    }
}
