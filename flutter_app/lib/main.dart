import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:provider/provider.dart';

import 'services/admob_service.dart';
import 'services/auth_service.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  // كان التطبيق ينهار فوراً عند الفتح بلا أي رسالة، وحتى بعد إضافة try/catch
  // حول main() لم تظهر شاشة التشخيص إطلاقاً — ما يعني أن الانهيار يحدث قبل
  // أن يبدأ Dart بالتنفيذ أصلاً (على الأرجح أثناء التهيئة الذاتية الأصلية
  // لـ Firebase عبر ContentProvider عند إقلاع العملية، قبل main() بوقت
  // طويل). Firebase Crashlytics يثبّت معالج أعطال أصلياً في وقت مبكر جداً
  // من إقلاع العملية (عبر ContentProvider خاص به أيضاً)، فهو أفضل أداة
  // متاحة لالتقاط هذا النوع من الأعطال وإرساله إلى Firebase Console — يمكن
  // للمستخدم مراجعته من متصفح هاتفه دون أي حاسوب أو ADB.
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    String? startupError;
    try {
      // يعتمد على google-services.json (وليس على قيم مكتوبة يدوياً هنا) —
      // انظر flutter_app/README.md لخطوة الحصول عليه من نفس مشروع Firebase
      // "literium" المستخدم في الموقع الحي.
      await Firebase.initializeApp();

      FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
      PlatformDispatcher.instance.onError = (error, stack) {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
        return true;
      };

      await MobileAds.instance.initialize();
    } catch (e, st) {
      startupError = '$e\n\n$st';
    }

    if (startupError != null) {
      runApp(_StartupErrorApp(message: startupError));
      return;
    }

    runApp(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthService()),
          Provider(create: (_) => AdMobService()..loadInterstitial()),
        ],
        child: const LiteriumApp(),
      ),
    );
  }, (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    runApp(_StartupErrorApp(message: '$error\n\n$stack'));
  });
}

/// شاشة تشخيص تُعرض بدل الانهيار الصامت — نصّها قابل للتحديد والنسخ كي يرسله
/// المستخدم لتشخيص أي مشكلة تشغيل حقيقية بدل إغلاق التطبيق دون أثر.
class _StartupErrorApp extends StatelessWidget {
  const _StartupErrorApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'تعذّر تشغيل التطبيق',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.red),
                ),
                const SizedBox(height: 12),
                const Text('يرجى إرسال النص التالي كاملاً:'),
                const SizedBox(height: 12),
                Expanded(
                  child: SingleChildScrollView(
                    child: SelectableText(message),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class LiteriumApp extends StatelessWidget {
  const LiteriumApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ليتيريوم',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      // دعم الاتجاه من اليمين لليسار افتراضياً — نفس اتجاه الموقع الحي.
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child!,
      ),
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0D9488), // نفس لون العلامة التجارية (teal) في الموقع
        fontFamily: 'Cairo',
      ),
      home: Consumer<AuthService>(
        builder: (context, auth, _) {
          if (auth.isInitializing) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          return auth.isLoggedIn ? const HomeScreen() : const LoginScreen();
        },
      ),
    );
  }
}
