import 'package:cloud_firestore/cloud_firestore.dart';

class DmMessage {
  final String id;
  final String conversationId;
  final String senderId;
  final List<String> participants;
  final String text;
  final String? mediaUrl;
  final String? mediaType; // 'image' | 'video' | 'sticker'
  final bool isRead;
  final DateTime? createdAt;

  DmMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.participants,
    required this.text,
    this.mediaUrl,
    this.mediaType,
    required this.isRead,
    required this.createdAt,
  });

  factory DmMessage.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return DmMessage(
      id: doc.id,
      conversationId: (data['conversationId'] ?? '') as String,
      senderId: (data['senderId'] ?? '') as String,
      participants: List<String>.from(data['participants'] ?? const []),
      text: (data['text'] ?? '') as String,
      mediaUrl: data['mediaUrl'] as String?,
      mediaType: data['mediaType'] as String?,
      isRead: (data['isRead'] ?? false) as bool,
      createdAt: DateTime.tryParse((data['createdAt'] ?? '') as String? ?? ''),
    );
  }
}
