plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
}

android {
    namespace = "studio.ai.literium.literium_app"
    // ⚠️ نفس مساحة الاسم/applicationId المستخدمة في flutter_app سابقاً عمداً:
    // تسمح بإعادة استخدام نفس تسجيل تطبيق Firebase Android الموجود فعلاً
    // (نفس سرّ FLUTTER_GOOGLE_SERVICES_JSON_BASE64) ونفس مفتاح التوقيع
    // (ANDROID_KEYSTORE_BASE64/PASSWORD) بلا أي إعداد جديد في Firebase
    // Console أو توليد مفتاح جديد يكسر التحديث فوق أي تثبيت سابق.
    compileSdk = 36

    defaultConfig {
        applicationId = "studio.ai.literium.literium_app"
        minSdk = 26
        targetSdk = 36
        // ⚠️ يُمرَّر من CI عبر -PversionCode=<github.run_number> ليبقى
        // دائماً أعلى من أي بناء سابق تلقائياً (أندرويد يرفض تثبيت أي حزمة
        // فوق نسخة مثبَّتة إن لم يكن رقم إصدارها أعلى صراحة، بصرف النظر عن
        // توقيعها) — نفس الدرس المستفاد من مشكلة حقيقية واجهناها في
        // flutter_app سابقاً. القيمة 1 هنا احتياطية فقط لبناء محلي مباشر.
        versionCode = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
        versionName = "1.0"
        vectorDrawables.useSupportLibrary = true
    }

    signingConfigs {
        create("release") {
            storeFile = file("literium.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = "literium"
            keyPassword = System.getenv("KEYSTORE_PASSWORD")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // ---- Compose ----
    val composeBom = platform("androidx.compose:compose-bom:2025.01.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // ---- Firebase (نفس مشروع "literium" المستخدم في الموقع) ----
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("com.google.firebase:firebase-crashlytics-ktx")
    implementation("com.google.firebase:firebase-analytics-ktx")

    // ---- شبكة (نقاط server.ts) ----
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // ---- صور (Cloudinary عبر روابط HTTPS عادية) ----
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")

    // ⚠️ محتوى جسم المقال في الموقع HTML خام من محرر غني (ليس Markdown) —
    // Jsoup لتحليل الوسوم فقط (فقرات/عناوين/قوائم/روابط/صور)، ثم نرسمها
    // يدوياً كعناصر Compose حقيقية في ArticleReaderScreen. عمداً بلا أي
    // WebView لعرض المحتوى: هذا بالضبط المحرك الثاني الذي كان يُبطئ نسخة
    // Flutter+WebView السابقة (انظر الملاحظة في build.gradle.kts الجذري) —
    // تكراره هنا لعرض جسم المقال فقط يُبطل الفائدة الكاملة من هذا الانتقال.
    implementation("org.jsoup:jsoup:1.18.3")

    // ---- اختيار صورة/وثيقة (رفع الوسائط + KYC) ----
    implementation("androidx.activity:activity-ktx:1.9.3")

    implementation("androidx.core:core-ktx:1.15.0")

    // ---- تفضيلات محلية على الجهاز (المظهر الداكن/الفاتح، اللغة، الحسابات المحفوظة) —
    // خاصة بكل مستخدم على جهازه، بلا أي مزامنة حية عبر Firestore، خلافاً لقالب الألوان
    // الإداري العام أعلاه. ----
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // ---- مشغّل فيديو حقيقي (الإبداعات الإعلانية من نوع فيديو، AdSlot.kt) —
    // Media3 هو خليفة ExoPlayer الرسمي الحالي من Google. media3-ui (وليس
    // الإصدار التجريبي media3-ui-compose) لأنه الأكثر استقراراً ونضجاً؛
    // يُستخدم هنا عبر AndroidView التقليدي حول PlayerView. ----
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-ui:1.5.1")

    // ---- عرض HTML/JS خام لشبكات الإعلانات الخارجية الاحتياطية (PropellerAds/Adsterra/
    // Taboola) عند تفعيلها إدارياً فقط — WebView واحد صغير معزول لهذا الغرض حصراً، وليس
    // محرك عرض التطبيق (انظر ExternalAdWebView.kt لتفصيل هذا القرار). ----
    implementation("androidx.webkit:webkit:1.12.1")
}
