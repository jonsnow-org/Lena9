# Literium — تطبيق Android أصيل (Flutter)

نسخة أصيلة كاملة بديلة عن نسخة TWA السابقة (المؤرشفة على فرع
`archive/twa-final-v1` في هذا المستودع) — واجهة Flutter 100%، بلا أي
WebView، متصلة بنفس مشروع Firebase (`literium`) الذي يستخدمه الموقع الحي.

## حالة الميزات (المرحلة الأولى)

| الميزة | الحالة |
|---|---|
| تسجيل الدخول (بريد + Google) | ✅ كامل |
| عرض المقالات + قراءة | ✅ كامل |
| إعلانات AdMob (بانر + بيني كل 3 مقالات) | ✅ كامل (بمعرّفات اختبار — انظر أدناه) |
| المحفظة | 🔶 عرض الرصيد فقط — الإيداع/السحب لاحقاً |
| الرسائل | 🔶 عنصر نائب — النظام الكامل لاحقاً |
| فتح مقال مقفول من داخل التطبيق | 🔶 لاحقاً (يستخدم endpoint `/api/articles/unlock` الموجود أصلاً) |

## خطوتان يدويتان مطلوبتان قبل أول بناء ناجح

### 1. `google-services.json`
1. افتح [Firebase Console](https://console.firebase.google.com) → مشروع **literium**.
2. أضف تطبيق Android جديداً: Package name = `studio.ai.literium.literium_app`.
3. نزّل `google-services.json` الناتج.
4. حوّله لنص Base64 (`base64 -w0 google-services.json`) وأضفه كسرّ GitHub جديد باسم
   **`FLUTTER_GOOGLE_SERVICES_JSON_BASE64`** في إعدادات هذا المستودع (Settings → Secrets → Actions).

### 2. معرّفات AdMob الحقيقية
الكود يستخدم حالياً **معرّفات اختبار رسمية من Google** (آمنة، تعمل، لا تُحقق عائداً حقيقياً):
- `lib/services/admob_service.dart` — بانر + بيني.
- `.github/workflows/build-flutter-apk.yml` — `ADMOB_APP_ID`.

ابحث عن `TODO: AdMob` في كلا الملفين واستبدل بالقيم الحقيقية من [AdMob Console](https://apps.admob.com) بعد تسجيل التطبيق هناك.

## تشغيل السير لأول مرة

بعد إضافة السرّ أعلاه: **Actions → Build Flutter Android APK → Run workflow**.

⚠️ من المتوقع فعلياً أن يفشل التشغيل الأول أو يحتاج تعديلاً بسيطاً — نفس ما
حدث بالضبط مع سير TWA السابق (`build-apk.yml`) في أول محاولاته. لا يوجد
Flutter مثبَّت في بيئة كتابة هذا الكود لأختبر خطوة تعديل ملفات Gradle
تلقائياً قبل التسليم؛ إن فشل السير، أرسل لي سجل الخطأ (Job logs) وسأصلحه
فوراً بنفس الأسلوب المتبع طوال هذا المشروع.

## البنية

```
flutter_app/
  lib/
    main.dart
    models/article.dart
    services/auth_service.dart      # Firebase Auth
    services/article_service.dart   # قراءة Firestore مباشرة (articles)
    services/admob_service.dart
    screens/login_screen.dart
    screens/home_screen.dart
    screens/articles_screen.dart
    screens/article_detail_screen.dart
    screens/wallet_screen.dart
    screens/messages_screen.dart
  android/   # يُولَّد تلقائياً عبر flutter create داخل CI — غير موجود محلياً بعد
```
