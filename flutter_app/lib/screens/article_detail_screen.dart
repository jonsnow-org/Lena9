import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:provider/provider.dart';
import '../models/article.dart';
import '../services/admob_service.dart';
import '../services/article_service.dart';
import '../services/auth_service.dart';

class ArticleDetailScreen extends StatefulWidget {
  final Article article;
  const ArticleDetailScreen({super.key, required this.article});

  @override
  State<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends State<ArticleDetailScreen> {
  BannerAd? _bannerAd;
  bool _bannerLoaded = false;
  final _articleService = ArticleService();
  bool _isUnlocked = false;
  bool _isUnlocking = false;
  String? _unlockError;

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

  Future<void> _unlock() async {
    final idToken = await context.read<AuthService>().getIdToken();
    if (idToken == null) return;
    setState(() {
      _isUnlocking = true;
      _unlockError = null;
    });
    final result = await _articleService.unlockArticle(idToken: idToken, articleId: widget.article.id);
    if (!mounted) return;
    setState(() {
      _isUnlocking = false;
      if (result.success) {
        _isUnlocked = true;
      } else {
        _unlockError = result.message ?? 'تعذّر فتح المقال.';
      }
    });
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
                  if (article.isLocked && !_isUnlocked)
                    Card(
                      color: Colors.amber.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.lock, color: Colors.amber),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text('مقال مقفول — السعر \$${article.lockedPrice?.toStringAsFixed(2) ?? '2.99'}'),
                                ),
                              ],
                            ),
                            if (_unlockError != null) ...[
                              const SizedBox(height: 8),
                              Text(_unlockError!, style: const TextStyle(color: Colors.red)),
                            ],
                            const SizedBox(height: 10),
                            FilledButton(
                              onPressed: _isUnlocking ? null : _unlock,
                              child: _isUnlocking
                                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Text('فتح المقال من رصيد المحفظة'),
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
