import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_profile.dart';

/// انعكاس مباشر لدوال قسم "المتابعة" في firestoreService.ts — نفس معرّف
/// المستند ({followerId}_{followingId}) ونفس منطق كل عملية بالضبط.
class SocialService {
  final _db = FirebaseFirestore.instance;

  Future<void> followUser(String followerId, String followingId) async {
    if (followerId == followingId) {
      throw Exception('لا يمكنك متابعة نفسك.');
    }
    await _db.collection('follows').doc('${followerId}_$followingId').set({
      'followerId': followerId,
      'followingId': followingId,
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  Future<void> unfollowUser(String followerId, String followingId) async {
    await _db.collection('follows').doc('${followerId}_$followingId').delete();
  }

  Stream<bool> watchIsFollowing(String followerId, String followingId) {
    return _db
        .collection('follows')
        .doc('${followerId}_$followingId')
        .snapshots()
        .map((doc) => doc.exists);
  }

  /// عدد المتابِعين الحقيقي — محسوب من مجموعة follows الفعلية، وليس من
  /// حقل followersCount المخزَّن على مستند المستخدم (ذاك الحقل لا يُحدَّث
  /// من أي مسار في التطبيق ويبقى صفراً دائماً، نفس السبب الموثَّق في
  /// creatorEligibility.ts بالموقع).
  Stream<int> watchFollowersCount(String userId) {
    return _db
        .collection('follows')
        .where('followingId', isEqualTo: userId)
        .snapshots()
        .map((snap) => snap.docs.length);
  }

  Stream<int> watchFollowingCount(String userId) {
    return _db
        .collection('follows')
        .where('followerId', isEqualTo: userId)
        .snapshots()
        .map((snap) => snap.docs.length);
  }

  Future<List<UserProfile>> fetchFollowers(String userId) async {
    final followsSnap = await _db.collection('follows').where('followingId', isEqualTo: userId).get();
    return _resolveProfiles(followsSnap.docs.map((d) => d.data()['followerId'] as String).toList());
  }

  Future<List<UserProfile>> fetchFollowing(String userId) async {
    final followsSnap = await _db.collection('follows').where('followerId', isEqualTo: userId).get();
    return _resolveProfiles(followsSnap.docs.map((d) => d.data()['followingId'] as String).toList());
  }

  Future<List<UserProfile>> _resolveProfiles(List<String> userIds) async {
    if (userIds.isEmpty) return [];
    final profiles = <UserProfile>[];
    // Firestore يحدّ استعلامات whereIn بـ 30 عنصراً — نجزّئ الدفعات الكبيرة.
    for (var i = 0; i < userIds.length; i += 30) {
      final batch = userIds.sublist(i, i + 30 > userIds.length ? userIds.length : i + 30);
      final snap = await _db.collection('users').where(FieldPath.documentId, whereIn: batch).get();
      profiles.addAll(snap.docs.map(UserProfile.fromFirestore));
    }
    return profiles;
  }

  /// بحث بسيط عن مستخدمين بالاسم أو اسم المستخدم — لبدء محادثة جديدة أو
  /// استكشاف كتّاب. Firestore لا يدعم بحث نصي جزئي حقيقي، فنستخدم مطابقة
  /// بادئة (prefix match) القياسية عبر startAt/endAt، وهي نفس ما يمكن
  /// تحقيقه بلا خدمة بحث خارجية (Algolia/Typesense) لا يستخدمها المشروع.
  Future<List<UserProfile>> searchUsers(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return [];
    final snap = await _db
        .collection('users')
        .orderBy('fullName')
        .startAt([trimmed])
        .endAt(['$trimmed'])
        .limit(20)
        .get();
    return snap.docs.map(UserProfile.fromFirestore).toList();
  }
}
