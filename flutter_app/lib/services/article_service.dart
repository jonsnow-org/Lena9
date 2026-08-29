import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/article.dart';

class UnlockResult {
  final bool success;
  final bool alreadyUnlocked;
  final String? error;
  final String? message;

  UnlockResult({required this.success, required this.alreadyUnlocked, this.error, this.message});
}

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

  /// يستدعي /api/articles/unlock الموجود أصلاً في server.ts — نفس منطق
  /// الخصم وحساب أهلية الكاتب بالضبط، بلا أي تكرار له هنا.
  Future<UnlockResult> unlockArticle({required String idToken, required String articleId}) async {
    try {
      final res = await http.post(
        Uri.parse('$kApiBaseUrl/api/articles/unlock'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: jsonEncode({'articleId': articleId}),
      );
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) {
        return UnlockResult(success: false, alreadyUnlocked: false, error: data['error'] as String?, message: data['message'] as String?);
      }
      return UnlockResult(success: true, alreadyUnlocked: (data['alreadyUnlocked'] ?? false) as bool);
    } catch (_) {
      return UnlockResult(success: false, alreadyUnlocked: false, message: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
    }
  }

  /// انعكاس مباشر لـ saveArticleToFirestore (مسار المقال الجديد فقط) في
  /// firestoreService.ts — كتابة مباشرة على Firestore، بنفس القيم
  /// الافتراضية للعدّادات (كلها صفر، تماماً كما تشترط firestore.rules
  /// على allow create). status إما 'draft' أو 'published' فقط، كما في
  /// محرر الموقع تماماً (لا حالة 'pending' من هذا المسار).
  Future<String> publishArticle({
    required String writerId,
    required String writerName,
    required String writerUsername,
    required String writerAvatar,
    required String title,
    required String description,
    required String content,
    required String featuredImage,
    required String category,
    required List<String> tags,
    required bool isLocked,
    double? lockedPrice,
    required String status, // 'draft' | 'published'
  }) async {
    final now = DateTime.now().toIso8601String();
    final slug = title
            .trim()
            .toLowerCase()
            .replaceAll(RegExp(r'\s+'), '-')
            .replaceAll(RegExp(r'[^؀-ۿa-z0-9\-]'), '') +
        '-${DateTime.now().millisecondsSinceEpoch}';
    final wordCount = content.trim().isEmpty ? 0 : content.trim().split(RegExp(r'\s+')).length;
    final readingTime = wordCount == 0 ? 1 : (wordCount / 180).ceil().clamp(1, 999);

    final docRef = _db.collection('articles').doc();
    await docRef.set({
      'writerId': writerId,
      'writerName': writerName,
      'writerUsername': writerUsername,
      'writerAvatar': writerAvatar,
      'writerIsVerified': false,
      'title': title,
      'slug': slug,
      'description': description,
      'content': content,
      'featuredImage': featuredImage,
      'category': category,
      'isLocked': isLocked,
      'lockedPrice': isLocked ? (lockedPrice ?? 3.0) : null,
      'readingTimeMinutes': readingTime,
      'status': status,
      'viewsCount': 0,
      'likesCount': 0,
      'sharesCount': 0,
      'commentsCount': 0,
      'purchasesCount': 0,
      'rating': 0,
      'ratingsCount': 0,
      'revenueFromAds': 0,
      'revenueFromSales': 0,
      'totalRevenue': 0,
      'publishedAt': status == 'draft' ? '' : now,
      'tags': tags,
      'id': docRef.id,
      'createdAt': now,
      'updatedAt': now,
    });
    return docRef.id;
  }
}
