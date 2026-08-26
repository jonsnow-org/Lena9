import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:provider/provider.dart';
import '../models/article.dart';
import '../services/admob_service.dart';

class ArticleDetailScreen extends StatefulWidget {
  final Article article;
  const ArticleDetailScreen({super.key, required this.article});

  @override
  State<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends State<ArticleDetailScreen> {
  BannerAd? _bannerAd;
  bool _bannerLoaded = false;

  @override
  void initState() {
    super.initState();

    // إعلان بيني كل ٣ مقالات (وليس كل مقال) — انظر التعليق في AdMobService.
    final adMob = context.read<AdMobService>();
    adMob.maybeShowInterstitialOnArticleOpen();

    _bannerAd = adMob.createBannerAd(
      onLoaded: () => setState(() => _bannerLoaded = true),
      onFailed: () => setState(() => _bannerLoaded = false),
    );
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final article = widget.article;
    return Scaffold(
      appBar: AppBar(title: Text(article.writerName)),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    article.title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 16),
                  if (article.isLocked)
                    Card(
                      color: Colors.amber.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            const Icon(Icons.lock, color: Colors.amber),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'مقال مقفول — السعر \$${article.lockedPrice?.toStringAsFixed(2) ?? '-'}.\n'
                                'فتح المقالات المقفولة عبر التطبيق قيد الإعداد (المرحلة القادمة) — '
                                'يمكنك فتحه الآن من الموقع.',
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    Html(data: article.content.isNotEmpty ? article.content : article.description),
                ],
              ),
            ),
          ),
          if (_bannerLoaded && _bannerAd != null)
            SizedBox(
              width: _bannerAd!.size.width.toDouble(),
              height: _bannerAd!.size.height.toDouble(),
              child: AdWidget(ad: _bannerAd!),
            ),
        ],
      ),
    );
  }
}
