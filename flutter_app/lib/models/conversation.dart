import 'package:cloud_firestore/cloud_firestore.dart';

/// انعكاس مباشر لبنية مستند conversations/{id} في الموقع — لا تُبنى هنا
/// أي حقول جديدة، فقط نفس ما يكتبه firestoreService.ts بالضبط.
class Conversation {
  final String id;
  final List<String> participants;
  final String lastMessage;
  final DateTime? lastMessageAt;
  final Map<String, dynamic> typing;
  final List<String> hiddenFor;

  Conversation({
    required this.id,
    required this.participants,
    required this.lastMessage,
    required this.lastMessageAt,
    required this.typing,
    required this.hiddenFor,
  });

  factory Conversation.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Conversation(
      id: doc.id,
      participants: List<String>.from(data['participants'] ?? const []),
      lastMessage: (data['lastMessage'] ?? '') as String,
      lastMessageAt: DateTime.tryParse((data['lastMessageAt'] ?? '') as String? ?? ''),
      typing: Map<String, dynamic>.from(data['typing'] ?? const {}),
      hiddenFor: List<String>.from(data['hiddenFor'] ?? const []),
    );
  }

  String partnerId(String myUid) => participants.firstWhere((p) => p != myUid, orElse: () => '');

  /// الطرف الآخر يكتب الآن فعلياً؟ (نفس شرط الموقع: طابع زمني أحدث من ٤ ثوانٍ)
  bool isPartnerTyping(String myUid) {
    final partner = partnerId(myUid);
    final raw = typing[partner];
    if (raw is! String) return false;
    final at = DateTime.tryParse(raw);
    if (at == null) return false;
    return DateTime.now().difference(at).inSeconds < 4;
  }
}
