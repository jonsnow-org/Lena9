import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/article.dart';

/// يقرأ من مجموعة Firestore "articles" مباشرة — نفس البيانات الحية التي
/// يعرضها الموقع بالضبط، بلا أي endpoint وسيط. يُطبَّق فلتر status صراحة
/// هنا كي لا تظهر مقالات مسودة/قيد المراجعة لعموم مستخدمي التطبيق.
class ArticleService {
  final _db = FirebaseFirestore.instance;

  Future<List<Article>> fetchPublishedArticles({int limit = 30}) async {
    final snapshot = await _db
        .collection('articles')
        .where('status', isEqualTo: 'published')
        .limit(limit)
        .get();

    final articles = snapshot.docs.map(Article.fromFirestore).toList();
    // نفس ترتيب الأحدث أولاً المستخدم في الموقع.
    articles.sort((a, b) {
      final da = a.publishedAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final db_ = b.publishedAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return db_.compareTo(da);
    });
    return articles;
  }
}
