import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../models/article.dart';
import '../services/article_service.dart';
import 'article_detail_screen.dart';
import 'article_editor_screen.dart';

class ArticlesScreen extends StatefulWidget {
  const ArticlesScreen({super.key});

  @override
  State<ArticlesScreen> createState() => _ArticlesScreenState();
}

class _ArticlesScreenState extends State<ArticlesScreen> {
  final _service = ArticleService();
  late Future<List<Article>> _articlesFuture;

  @override
  void initState() {
    super.initState();
    _articlesFuture = _service.fetchPublishedArticles();
  }

  Future<void> _onRefresh() async {
    final fresh = _service.fetchPublishedArticles();
    setState(() => _articlesFuture = fresh);
    await fresh;
  }

  Future<void> _openEditor() async {
    final published = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ArticleEditorScreen()),
    );
    if (published == true) _onRefresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<Article>>(
        future: _articlesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorState(onRetry: _onRefresh);
          }
          final articles = snapshot.data ?? [];
          if (articles.isEmpty) {
            return RefreshIndicator(
              onRefresh: _onRefresh,
              child: ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('لا توجد مقالات منشورة بعد')),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _onRefresh,
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: articles.length,
              itemBuilder: (context, index) => _ArticleCard(article: articles[index]),
            ),
          );
        },
      ),
      floatingActionButton: FirebaseAuth.instance.currentUser == null
          ? null
          : FloatingActionButton(
              tooltip: 'كتابة مقال',
              onPressed: _openEditor,
              child: const Icon(Icons.edit_note),
            ),
    );
  }
}

class _ArticleCard extends StatelessWidget {
  final Article article;
  const _ArticleCard({required this.article});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => ArticleDetailScreen(article: article)),
          );
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (article.featuredImage.isNotEmpty)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: CachedNetworkImage(
                  imageUrl: article.featuredImage,
                  fit: BoxFit.cover,
                  placeholder: (context, url) => Container(color: Colors.grey.shade200),
                  errorWidget: (context, url, error) => Container(color: Colors.grey.shade200),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (article.isLocked)
                        const Padding(
                          padding: EdgeInsetsDirectional.only(end: 6),
                          child: Icon(Icons.lock, size: 16, color: Colors.amber),
                        ),
                      Expanded(
                        child: Text(
                          article.title,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    article.description,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Text(article.writerName, style: Theme.of(context).textTheme.labelMedium),
                      const Spacer(),
                      Icon(Icons.remove_red_eye_outlined, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 3),
                      Text('${article.viewsCount}', style: Theme.of(context).textTheme.labelSmall),
                      const SizedBox(width: 10),
                      Icon(Icons.schedule, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 3),
                      Text('${article.readingTimeMinutes} د', style: Theme.of(context).textTheme.labelSmall),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final Future<void> Function() onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off, size: 40, color: Colors.grey),
          const SizedBox(height: 12),
          const Text('تعذّر تحميل المقالات. تحقق من اتصالك.'),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
        ],
      ),
    );
  }
}
