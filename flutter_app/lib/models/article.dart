import 'package:cloud_firestore/cloud_firestore.dart';

/// انعكاس لنفس بنية Article في types.ts بالموقع — يقرأ من نفس مجموعة
/// Firestore (articles) مباشرة، بلا أي REST API وسيط.
class Article {
  final String id;
  final String title;
  final String description;
  final String content; // نص عادي (plain text) — لا يوجد محرر HTML/Markdown في الموقع نفسه
  final String featuredImage;
  final String writerName;
  final String writerAvatar;
  final bool isLocked;
  final double? lockedPrice;
  final int readingTimeMinutes;
  final int viewsCount;
  final int likesCount;
  final DateTime? publishedAt;

  Article({
    required this.id,
    required this.title,
    required this.description,
    required this.content,
    required this.featuredImage,
    required this.writerName,
    required this.writerAvatar,
    required this.isLocked,
    this.lockedPrice,
    required this.readingTimeMinutes,
    required this.viewsCount,
    required this.likesCount,
    this.publishedAt,
  });

  factory Article.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    DateTime? published;
    final rawDate = data['publishedAt'];
    if (rawDate is String) {
      published = DateTime.tryParse(rawDate);
    } else if (rawDate is Timestamp) {
      published = rawDate.toDate();
    }

    return Article(
      id: doc.id,
      title: (data['title'] ?? '') as String,
      description: (data['description'] ?? '') as String,
      content: (data['content'] ?? '') as String,
      featuredImage: (data['featuredImage'] ?? '') as String,
      writerName: (data['writerName'] ?? '') as String,
      writerAvatar: (data['writerAvatar'] ?? '') as String,
      isLocked: (data['isLocked'] ?? false) as bool,
      lockedPrice: (data['lockedPrice'] as num?)?.toDouble(),
      readingTimeMinutes: (data['readingTimeMinutes'] as num?)?.toInt() ?? 0,
      viewsCount: (data['viewsCount'] as num?)?.toInt() ?? 0,
      likesCount: (data['likesCount'] as num?)?.toInt() ?? 0,
      publishedAt: published,
    );
  }
}
