# Literium — تطبيق Android أصيل (Flutter)

نسخة أصيلة كاملة بديلة عن نسخة TWA السابقة (المؤرشفة على فرع
`archive/twa-final-v1` في هذا المستودع) — واجهة Flutter 100%، بلا أي
WebView، متصلة بنفس مشروع Firebase (`literium`) الذي يستخدمه الموقع الحي.

## حالة الميزات

| الميزة | الحالة |
|---|---|
| تسجيل الدخول (بريد + Google) | ✅ كامل |
| عرض المقالات + قراءة | ✅ كامل |
| فتح مقال مقفول من رصيد المحفظة | ✅ كامل (`/api/articles/unlock` الموجود أصلاً) |
| إعلانات AdMob (بانر + بيني كل 3 مقالات) | ✅ كامل (بمعرّفات اختبار — انظر أدناه) |
| المحفظة — عرض الرصيد الحي | ✅ كامل |
| المحفظة — إيداع حقيقي (Stripe Checkout) | ✅ كامل |
| المحفظة — طلب سحب حقيقي | ✅ كامل |
| الرسائل — قائمة المحادثات + مؤشر غير مقروء | ✅ كامل |
| الرسائل — محادثة حية (إرسال/استقبال فوري) | ✅ كامل |
| الرسائل — مؤشر "يكتب الآن" | ✅ كامل |
| الرسائل — إغلاق/كتم/حظر/إبلاغ | ✅ كامل |
| بدء محادثة جديدة (تصفح/بحث عن مستخدمين) | ❌ غير مبني بعد — يمكن حالياً متابعة محادثات موجودة فقط |
| التحقق من الهوية (KYC) | ❌ غير مبني بعد |
| الإشعارات | ❌ غير مبني بعد |
| المتابعة (Follow/Followers) | ❌ غير مبني بعد |
| التغريدات (Tweets) | ❌ غير مبني بعد |
| محرر/نشر المقالات للكاتب | ❌ غير مبني بعد |
| لوحة تحكم الأدمن | ❌ غير مبني بعد |

الأقسام أعلاه المعلّمة ❌ موجودة في الموقع لكن لم تُبنَ في نسخة Flutter بعد — لم يتم إخفاء ذلك عمداً.

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
    services/article_service.dart   # قراءة Firestore مباشرة (articles) + فتح المقفول
    services/admob_service.dart
    services/payment_api.dart       # إيداع/سحب حقيقيان عبر server.ts
    services/message_service.dart   # انعكاس كامل لقسم الرسائل في firestoreService.ts
    models/article.dart
    models/conversation.dart
    models/dm_message.dart
    screens/login_screen.dart
    screens/home_screen.dart
    screens/articles_screen.dart
    screens/article_detail_screen.dart
    screens/wallet_screen.dart
    screens/messages_screen.dart
    screens/chat_screen.dart
  android/   # يُولَّد تلقائياً عبر flutter create داخل CI — غير موجود محلياً بعد
```
