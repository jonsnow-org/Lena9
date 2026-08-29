import 'package:cloud_firestore/cloud_firestore.dart';

/// انعكاس مباشر لواجهة Tweet في src/types.ts — مستند واحد لكل تغريدة في
/// مجموعة tweets، بنفس الحقول تماماً.
class Tweet {
  final String id;
  final String authorId;
  final String authorName;
  final String authorUsername;
  final String authorAvatar;
  final String content;
  final int likesCount;
  final int commentsCount;
  final int sharesCount;
  final String createdAt;

  const Tweet({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.authorUsername,
    required this.authorAvatar,
    required this.content,
    required this.likesCount,
    required this.commentsCount,
    required this.sharesCount,
    required this.createdAt,
  });

  factory Tweet.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Tweet(
      id: doc.id,
      authorId: (data['authorId'] ?? '') as String,
      authorName: (data['authorName'] ?? '') as String,
      authorUsername: (data['authorUsername'] ?? '') as String,
      authorAvatar: (data['authorAvatar'] ?? '') as String,
      content: (data['content'] ?? '') as String,
      likesCount: ((data['likesCount'] ?? 0) as num).toInt(),
      commentsCount: ((data['commentsCount'] ?? 0) as num).toInt(),
      sharesCount: ((data['sharesCount'] ?? 0) as num).toInt(),
      createdAt: (data['createdAt'] ?? '') as String,
    );
  }
}

/// انعكاس مباشر لواجهة TweetComment في src/types.ts — بلا حقل replies
/// هنا عمداً (لا ردود متداخلة على تعليقات التغريدات في هذه النسخة، فقط
/// تعليقات مباشرة، تماماً كما هي الميزة الأهم فعلياً في الموقع).
class TweetComment {
  final String id;
  final String tweetId;
  final String userId;
  final String userName;
  final String userAvatar;
  final String content;
  final String createdAt;

  const TweetComment({
    required this.id,
    required this.tweetId,
    required this.userId,
    required this.userName,
    required this.userAvatar,
    required this.content,
    required this.createdAt,
  });

  factory TweetComment.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return TweetComment(
      id: doc.id,
      tweetId: (data['tweetId'] ?? '') as String,
      userId: (data['userId'] ?? '') as String,
      userName: (data['userName'] ?? '') as String,
      userAvatar: (data['userAvatar'] ?? '') as String,
      content: (data['content'] ?? '') as String,
      createdAt: (data['createdAt'] ?? '') as String,
    );
  }
}
