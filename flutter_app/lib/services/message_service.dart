import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/conversation.dart';
import '../models/dm_message.dart';

/// انعكاس مباشر لدوال قسم "المحادثات والرسائل" في firestoreService.ts —
/// نفس أسماء الحقول ونفس منطق كل عملية بالضبط، بلا أي إضافة أو حذف.
class MessageService {
  final _db = FirebaseFirestore.instance;

  String conversationIdFor(String userA, String userB) {
    final sorted = [userA, userB]..sort();
    return sorted.join('_');
  }

  Stream<List<Conversation>> watchConversations(String myUid) {
    return _db
        .collection('conversations')
        .where('participants', arrayContains: myUid)
        .snapshots()
        .map((snap) => snap.docs.map(Conversation.fromFirestore).toList()
          ..sort((a, b) => (b.lastMessageAt ?? DateTime(0)).compareTo(a.lastMessageAt ?? DateTime(0))));
  }

  Stream<List<DmMessage>> watchMessages(String conversationId) {
    return _db
        .collection('messages')
        .where('conversationId', isEqualTo: conversationId)
        .snapshots()
        .map((snap) => snap.docs.map(DmMessage.fromFirestore).toList()
          ..sort((a, b) => (a.createdAt ?? DateTime(0)).compareTo(b.createdAt ?? DateTime(0))));
  }

  Future<String> ensureConversation(String currentUserId, String otherUserId) async {
    if (currentUserId == otherUserId) {
      throw Exception('لا يمكنك مراسلة نفسك.');
    }
    final convId = conversationIdFor(currentUserId, otherUserId);
    final ref = _db.collection('conversations').doc(convId);
    final snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        'participants': [currentUserId, otherUserId],
        'lastMessage': '',
        'lastMessageAt': DateTime.now().toIso8601String(),
        'createdAt': DateTime.now().toIso8601String(),
      });
    }
    return convId;
  }

  Future<void> sendMessage({
    required String conversationId,
    required String senderId,
    required List<String> participants,
    required String text,
    String? mediaUrl,
    String? mediaType,
  }) async {
    final recipientId = participants.firstWhere((p) => p != senderId, orElse: () => '');

    await _db.collection('messages').add({
      'conversationId': conversationId,
      'senderId': senderId,
      'participants': participants,
      'text': text,
      if (mediaUrl != null) 'mediaUrl': mediaUrl,
      if (mediaType != null) 'mediaType': mediaType,
      'isRead': false,
      'createdAt': DateTime.now().toIso8601String(),
    });

    await _db.collection('conversations').doc(conversationId).set({
      'participants': participants,
      'lastMessage': mediaType == 'sticker' ? '📎 ملصق' : (mediaType != null ? '📎 وسائط' : text.substring(0, text.length > 120 ? 120 : text.length)),
      'lastMessageAt': DateTime.now().toIso8601String(),
      if (recipientId.isNotEmpty) 'hiddenFor': FieldValue.arrayRemove([recipientId]),
      'typing': {senderId: null},
    }, SetOptions(merge: true));
  }

  Future<void> setTypingState(String conversationId, String userId, bool isTyping) async {
    try {
      await _db.collection('conversations').doc(conversationId).set({
        'typing': {userId: isTyping ? DateTime.now().toIso8601String() : null},
      }, SetOptions(merge: true));
    } catch (_) {
      // مؤشر الكتابة غير حرج — نفس تسامح الموقع مع فشله بصمت.
    }
  }

  Future<void> markMessagesRead(List<String> messageIds) async {
    if (messageIds.isEmpty) return;
    final batch = _db.batch();
    for (final id in messageIds) {
      batch.update(_db.collection('messages').doc(id), {'isRead': true});
    }
    await batch.commit();
  }

  Future<void> hideConversationForMe(String conversationId, String myUserId) async {
    await _db.collection('conversations').doc(conversationId).set({
      'hiddenFor': FieldValue.arrayUnion([myUserId]),
    }, SetOptions(merge: true));
  }

  Future<void> toggleBlockUser(String currentUserId, String targetUserId, bool block) async {
    await _db.collection('users').doc(currentUserId).update({
      'blockedUserIds': block ? FieldValue.arrayUnion([targetUserId]) : FieldValue.arrayRemove([targetUserId]),
    });
  }

  Future<void> toggleMuteUser(String currentUserId, String targetUserId, bool mute) async {
    await _db.collection('users').doc(currentUserId).update({
      'mutedUserIds': mute ? FieldValue.arrayUnion([targetUserId]) : FieldValue.arrayRemove([targetUserId]),
    });
  }

  Future<void> deleteMessage(String messageId) async {
    await _db.collection('messages').doc(messageId).delete();
  }

  Future<void> submitUserReport({
    required String reporterId,
    required String reportedUserId,
    String? conversationId,
    required String reason,
    String? details,
  }) async {
    await _db.collection('reports').add({
      'reporterId': reporterId,
      'reportedUserId': reportedUserId,
      if (conversationId != null) 'conversationId': conversationId,
      'reason': reason,
      if (details != null) 'details': details,
      'status': 'pending',
      'createdAt': DateTime.now().toIso8601String(),
    });
  }
}
