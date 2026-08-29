import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/tweet.dart';

/// انعكاس مباشر لقسم التغريدات في src/services/firestoreService.ts —
/// نفس المجموعات الثلاث بالضبط (tweets, tweetLikes, tweetComments) وبنفس
/// معرّفات المستندات المركّبة (tweetId_userId) لضمان توافق كامل مع بيانات
/// الموقع الحية.
class TweetService {
  final _db = FirebaseFirestore.instance;

  Stream<List<Tweet>> watchTweets() {
    return _db.collection('tweets').snapshots().map((snap) {
      final list = snap.docs.map(Tweet.fromFirestore).toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  /// أي تغريدات أعجب بها المستخدم الحالي — مجموعة معرّفات فقط، لتلوين
  /// زر القلب حياً دون قراءة مستند لكل تغريدة على حدة.
  Stream<Set<String>> watchMyLikedTweetIds(String uid) {
    return _db
        .collection('tweetLikes')
        .where('userId', isEqualTo: uid)
        .snapshots()
        .map((snap) => snap.docs.map((d) => (d.data()['tweetId'] ?? '') as String).toSet());
  }

  Future<void> postTweet({required String authorId, required String authorName, required String authorUsername, required String authorAvatar, required String content}) {
    final id = _db.collection('tweets').doc().id;
    return _db.collection('tweets').doc(id).set({
      'authorId': authorId,
      'authorName': authorName,
      'authorUsername': authorUsername,
      'authorAvatar': authorAvatar,
      'content': content,
      'likesCount': 0,
      'commentsCount': 0,
      'sharesCount': 0,
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteTweet(String tweetId) {
    return _db.collection('tweets').doc(tweetId).delete();
  }

  Future<void> incrementShare(String tweetId) {
    return _db.collection('tweets').doc(tweetId).update({'sharesCount': FieldValue.increment(1)});
  }

  Future<void> toggleLike({required String tweetId, required String uid, required bool isLiking}) async {
    final likeRef = _db.collection('tweetLikes').doc('${tweetId}_$uid');
    final tweetRef = _db.collection('tweets').doc(tweetId);
    if (isLiking) {
      await likeRef.set({'tweetId': tweetId, 'userId': uid, 'createdAt': DateTime.now().toIso8601String()});
      await tweetRef.update({'likesCount': FieldValue.increment(1)});
    } else {
      await likeRef.delete();
      await tweetRef.update({'likesCount': FieldValue.increment(-1)});
    }
  }

  Stream<List<TweetComment>> watchComments(String tweetId) {
    return _db
        .collection('tweetComments')
        .where('tweetId', isEqualTo: tweetId)
        .snapshots()
        .map((snap) {
      final list = snap.docs.map(TweetComment.fromFirestore).toList();
      list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      return list;
    });
  }

  Future<void> addComment({required String tweetId, required String userId, required String userName, required String userAvatar, required String content}) async {
    final id = _db.collection('tweetComments').doc().id;
    await _db.collection('tweetComments').doc(id).set({
      'tweetId': tweetId,
      'userId': userId,
      'userName': userName,
      'userAvatar': userAvatar,
      'content': content,
      'likesCount': 0,
      'createdAt': DateTime.now().toIso8601String(),
    });
    await _db.collection('tweets').doc(tweetId).update({'commentsCount': FieldValue.increment(1)});
  }
}
