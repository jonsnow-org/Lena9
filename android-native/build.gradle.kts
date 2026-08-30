// جذر مشروع Gradle — نفس النمط المستخدم في flutter_app سابقاً لضبط إصدارات
// المكوّنات المساعدة مركزياً بدل تكرارها. لا حاجة لملحق Flutter هنا إطلاقاً:
// هذا تطبيق Kotlin/Compose أصيل بالكامل، بلا أي محرك عرض ثانٍ يعمل بجانبه —
// وهذا بالتحديد هو السبب الذي دفع للانتقال من Flutter+WebView إلى هنا (انظر
// docs/literium-web-spec.md للسياق الكامل: محركا عرض متزامنان [Flutter/Skia
// و WebView/Chromium] كانا يتنافسان على نفس المعالج، فأصبح التطبيق أثقل
// وأبطأ بشكل ملحوظ من الموقع نفسه داخل Chrome).
plugins {
    id("com.android.application") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
    id("com.google.firebase.crashlytics") version "3.0.2" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0" apply false
}
