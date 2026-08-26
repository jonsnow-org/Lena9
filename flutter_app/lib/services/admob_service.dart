import 'dart:io';
import 'package:google_mobile_ads/google_mobile_ads.dart';

/// ⚠️ معرّفات الاختبار الرسمية من Google أدناه — تعمل فعلياً وبأمان تام
/// أثناء التطوير، لكنها **لا تُحقّق أي عائد حقيقي**. يجب استبدالها بمعرّفات
/// حسابك الفعلي في AdMob Console قبل أي نشر حقيقي — ابحث عن "TODO: AdMob"
/// في هذا الملف وAndroidManifest.xml لكل موضع يحتاج استبدالاً.
class AdMobService {
  // TODO: AdMob — استبدل بمعرّف وحدة البانر الحقيقي من حسابك.
  static String get bannerAdUnitId {
    if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/6300978111';
    throw UnsupportedError('Android فقط في هذا الإصدار');
  }

  // TODO: AdMob — استبدل بمعرّف وحدة الإعلان البيني الحقيقي من حسابك.
  static String get interstitialAdUnitId {
    if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/1033173712';
    throw UnsupportedError('Android فقط في هذا الإصدار');
  }

  InterstitialAd? _interstitialAd;

  // يظهر الإعلان البيني كل 3 مقالات وليس عند كل فتح مقال — سياسات AdMob
  // نفسها تحذّر من تكرار الإعلانات البينية المفرط بصفته تجربة مستخدم
  // سيئة، وقد يُعاقَب الحساب. عدّل الرقم هنا إن أردت وتيرة مختلفة.
  static const int _articlesBetweenInterstitials = 3;
  int _articlesOpenedSinceLastAd = 0;

  void loadInterstitial() {
    InterstitialAd.load(
      adUnitId: interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          _interstitialAd!.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              _interstitialAd = null;
              loadInterstitial(); // يحمّل النسخة التالية مسبقاً
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              ad.dispose();
              _interstitialAd = null;
              loadInterstitial();
            },
          );
        },
        onAdFailedToLoad: (error) {
          _interstitialAd = null;
        },
      ),
    );
  }

  /// يُستدعى عند فتح مقال — يعرض الإعلان البيني فقط كل [_articlesBetweenInterstitials]
  /// مرة، وفقط إن كان محمَّلاً فعلياً بالفعل (لا ينتظر التحميل، لا يمنع
  /// المستخدم من قراءة المقال إن تأخر التحميل).
  void maybeShowInterstitialOnArticleOpen() {
    _articlesOpenedSinceLastAd++;
    if (_articlesOpenedSinceLastAd < _articlesBetweenInterstitials) return;
    if (_interstitialAd == null) return;

    _articlesOpenedSinceLastAd = 0;
    _interstitialAd!.show();
  }

  BannerAd createBannerAd({required void Function() onLoaded, required void Function() onFailed}) {
    return BannerAd(
      adUnitId: bannerAdUnitId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) => onLoaded(),
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          onFailed();
        },
      ),
    )..load();
  }
}
