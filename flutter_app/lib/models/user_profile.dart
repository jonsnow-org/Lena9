import 'package:cloud_firestore/cloud_firestore.dart';

/// انعكاس جزئي لمستند users/{id} — فقط الحقول المستخدمة فعلياً هنا (عرض
/// ملف شخصي، نتائج بحث، بطاقة متابع). لا حاجة لكل حقول User الكاملة في
/// types.ts طالما لا تُعرض أو تُعدَّل من هذه الشاشات.
class UserProfile {
  final String id;
  final String fullName;
  final String username;
  final String avatarUrl;
  final String bio;
  final bool isVerified;
  final bool isKycVerified;
  final bool isBanned;

  UserProfile({
    required this.id,
    required this.fullName,
    required this.username,
    required this.avatarUrl,
    required this.bio,
    required this.isVerified,
    required this.isKycVerified,
    required this.isBanned,
  });

  factory UserProfile.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return UserProfile(
      id: doc.id,
      fullName: (data['fullName'] ?? '') as String,
      username: (data['username'] ?? '') as String,
      avatarUrl: (data['avatarUrl'] ?? '') as String,
      bio: (data['bio'] ?? '') as String,
      isVerified: (data['isVerified'] ?? false) as bool,
      isKycVerified: (data['isKycVerified'] ?? false) as bool,
      isBanned: (data['isBanned'] ?? false) as bool,
    );
  }
}
