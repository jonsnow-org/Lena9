import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'config.dart';

Future<void> main() async {
  // نفس معالج العطل المبكر من النسخة السابقة — يلتقط أعطال الإقلاع قبل
  // main() نفسه (عبر ContentProvider الخاص بـ Firebase) ويعرضها كنص قابل
  // للنسخ بدل اختفاء التطبيق صامتاً، لأن المستخدم لا يملك حاسوباً/ADB.
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    String? startupError;
    try {
      await Firebase.initializeApp();
      FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
      PlatformDispatcher.instance.onError = (error, stack) {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
        return true;
      };
    } catch (e, st) {
      startupError = '$e\n\n$st';
    }

    if (startupError != null) {
      runApp(_StartupErrorApp(message: startupError));
      return;
    }

    runApp(const LiteriumApp());
  }, (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    runApp(_StartupErrorApp(message: '$error\n\n$stack'));
  });
}

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
                Expanded(child: SingleChildScrollView(child: SelectableText(message))),
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
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0D9488),
        scaffoldBackgroundColor: Colors.white,
      ),
      home: const WebShellScreen(),
    );
  }
}

/// شاشة واحدة فقط: WebView يعرض الموقع الحي literium.ai.studio كما هو
/// تماماً — بلا أي شاشات Dart موازية، لأن أي إعادة بناء منفصلة للواجهة
/// (كما كانت النسخة السابقة من هذا الملف) تنحرف حتماً عن الموقع الحقيقي
/// في المحتوى والترتيب والشكل، وهذا بالضبط ما رفضه المستخدم.
class WebShellScreen extends StatefulWidget {
  const WebShellScreen({super.key});

  @override
  State<WebShellScreen> createState() => _WebShellScreenState();
}

class _WebShellScreenState extends State<WebShellScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _controller = _buildController();
  }

  WebViewController _buildController() {
    // ⚠️ بلا هذا التحديد الصريح يستخدم WebView على أندرويد وضع "Virtual
    // Display" الافتراضي — يرسم المحتوى كصورة/texture ثابتة أثناء السحب
    // ولا يحدّثها إلا بعد توقف اللمس تماماً، وهذا بالضبط سبب "التكسر" الذي
    // يظهر أثناء السحب للأعلى ثم يُصلَح فجأة عند التوقف. "Hybrid
    // Composition" يُركِّب WebView كطبقة Android حقيقية (hardware layer)
    // بدل صورة مُلتقَطة، فيُحدَّث بصرياً بشكل مستمر أثناء السحب — يُفترض أن
    // يُحسِّن أيضاً الثقل العام في التنقل، لا فقط مشكلة السحب.
    late final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is AndroidWebViewPlatform) {
      params = AndroidWebViewControllerCreationParams(
        displayWithHybridComposition: true,
      );
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }
    final controller = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      // ⚠️ عامل المستخدم الافتراضي لأي WebView على أندرويد يحتوي علامة
      // "; wv)" التي تكشف لخوادم Google (تسجيل الدخول بحساب Google، وهو
      // طريقة الدخول الوحيدة في هذا التطبيق) أنها داخل WebView مُضمَّن، فترفض
      // عرض صفحة تسجيل الدخول برسالة "This browser or app may not be
      // secure" — استبدال عامل المستخدم بسلسلة Chrome عادية (بلا "; wv)")
      // هو الحل العملي المعتاد لهذه المشكلة تحديداً في تطبيقات WebView.
      ..setUserAgent(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/125.0.0.0 Mobile Safari/537.36',
      )
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() {
            _loading = true;
            _loadError = null;
          }),
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (error) {
            // أخطاء الموارد الفرعية (صورة/سكربت فشل تحميله) شائعة ولا تعني
            // فشل الصفحة نفسها — لا تُظهر شاشة خطأ إلا لفشل التنقل الرئيسي.
            if (error.isForMainFrame ?? true) {
              setState(() {
                _loading = false;
                _loadError = error.description;
              });
            }
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.navigate;
            // روابط غير http/https (tel:, mailto:, whatsapp:, intent: ...)
            // تُفتح بالتطبيق المناسب خارج الـWebView بدل محاولة تحميلها
            // داخله (ستفشل صامتة لو تُركت للـWebView).
            if (uri.scheme != 'http' && uri.scheme != 'https') {
              launchUrl(uri, mode: LaunchMode.externalApplication);
              return NavigationDecision.prevent;
            }
            // كل تنقل http/https (يشمل صفحات تسجيل دخول Google وإعادة
            // التوجيه منها) يبقى داخل نفس الـWebView — ضروري لإتمام تدفق
            // OAuth نفسه ضمن نفس الجلسة/الكوكيز.
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(kApiBaseUrl));

    // اختيار ملف حقيقي من الجهاز عند لمس <input type="file"> في الموقع
    // (صورة مقال/رسالة، صورة الملف الشخصي، وثيقة KYC) — بلا هذا الربط لا
    // يفتح أي منتقي ملفات إطلاقاً على أندرويد عند لمس هذه الحقول.
    if (controller.platform is AndroidWebViewController) {
      final android = controller.platform as AndroidWebViewController;
      android.setOnShowFileSelector(_onShowFileSelector);
    }

    return controller;
  }

  Future<List<String>> _onShowFileSelector(FileSelectorParams params) async {
    try {
      // ⚠️ file_picker 11.0.0+ استبدل FilePicker.platform.pickFiles(...)
      // (كانت طريقة الاستدعاء الوحيدة قبلها) بدوال static مباشرة على الصنف
      // نفسه، وغيّر أيضاً نوع الإرجاع من FilePickerResult (بخاصية .files)
      // إلى List<PlatformFile>? مباشرة — خطآ بناء حقيقيان متتاليان أظهرا هذا.
      final files = await FilePicker.pickFiles(
        type: FileType.any,
        allowMultiple: false,
      );
      if (files == null || files.isEmpty) return [];
      final path = files.single.path;
      if (path == null) return [];
      return [Uri.file(path).toString()];
    } catch (_) {
      return [];
    }
  }

  Future<bool> _handleBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) async {
        if (didPop) return;
        final shouldPop = await _handleBack();
        if (shouldPop && context.mounted) {
          if (Platform.isAndroid) {
            SystemNavigator.pop();
          }
        }
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              if (_loadError == null) WebViewWidget(controller: _controller),
              if (_loadError != null)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
                        const SizedBox(height: 12),
                        const Text(
                          'تعذّر الاتصال بالموقع — تحقق من اتصال الإنترنت',
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: () {
                            setState(() => _loadError = null);
                            _controller.loadRequest(Uri.parse(kApiBaseUrl));
                          },
                          child: const Text('إعادة المحاولة'),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_loading && _loadError == null)
                const Center(child: CircularProgressIndicator()),
            ],
          ),
        ),
      ),
    );
  }
}
