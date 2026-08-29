import 'package:cloud_firestore/cloud_firestore.dart';

/// انعكاس مباشر لواجهة AppNotification في types.ts — نفس الحقول بالضبط.
class AppNotification {
  final String id;
  final String userId;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime? createdAt;
  final String? articleId;
  final String? actorId;

  AppNotification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
    this.articleId,
    this.actorId,
  });

  factory AppNotification.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AppNotification(
      id: doc.id,
      userId: (data['userId'] ?? '') as String,
      type: (data['type'] ?? 'system') as String,
      title: (data['title'] ?? '') as String,
      message: (data['message'] ?? '') as String,
      isRead: (data['isRead'] ?? false) as bool,
      createdAt: DateTime.tryParse((data['createdAt'] ?? '') as String? ?? ''),
      articleId: data['articleId'] as String?,
      actorId: data['actorId'] as String?,
    );
  }
}
