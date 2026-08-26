import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:provider/provider.dart';

import 'services/admob_service.dart';
import 'services/auth_service.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // يعتمد على google-services.json (وليس على قيم مكتوبة يدوياً هنا) —
  // انظر flutter_app/README.md لخطوة الحصول عليه من نفس مشروع Firebase
  // "literium" المستخدم في الموقع الحي.
  await Firebase.initializeApp();

  await MobileAds.instance.initialize();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        Provider(create: (_) => AdMobService()..loadInterstitial()),
      ],
      child: const LiteriumApp(),
    ),
  );
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
