import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/user_profile.dart';
import '../services/message_service.dart';
import '../services/social_service.dart';
import 'chat_screen.dart';

/// عرض ملف مستخدم آخر — يقابل UserProfileView.tsx (وضعية "زائر ملف
/// شخصي") في الموقع، مبسّط لما يحتاجه التطبيق الأصلي: الاسم/الصورة/
/// النبذة، عداد المتابِعين والمتابَعين الحي، زر متابعة/إلغاء متابعة
/// حقيقي، وزر مراسلة.
class UserProfileScreen extends StatelessWidget {
  final String userId;
  final String myUid;

  const UserProfileScreen({super.key, required this.userId, required this.myUid});

  @override
  Widget build(BuildContext context) {
    final social = SocialService();
    final isMe = userId == myUid;

    return Scaffold(
      appBar: AppBar(title: const Text('الملف الشخصي')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection('users').doc(userId).snapshots(),
        builder: (context, snap) {
          if (!snap.hasData || !snap.data!.exists) {
            return const Center(child: CircularProgressIndicator());
          }
          final profile = UserProfile.fromFirestore(snap.data!);

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Center(
                child: CircleAvatar(
                  radius: 48,
                  backgroundImage: profile.avatarUrl.isNotEmpty ? NetworkImage(profile.avatarUrl) : null,
                  child: profile.avatarUrl.isEmpty ? const Icon(Icons.person, size: 48) : null,
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      profile.fullName.isNotEmpty ? profile.fullName : '@${profile.username}',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    if (profile.isVerified) const Padding(
                      padding: EdgeInsets.only(right: 4),
                      child: Icon(Icons.verified, color: Colors.blue, size: 20),
                    ),
                  ],
                ),
              ),
              if (profile.username.isNotEmpty)
                Center(
                  child: Text('@${profile.username}', style: TextStyle(color: Colors.grey.shade600)),
                ),
              if (profile.bio.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(profile.bio, textAlign: TextAlign.center),
              ],
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _CountStat(
                    label: 'متابِعون',
                    stream: social.watchFollowersCount(userId),
                  ),
                  const SizedBox(width: 32),
                  _CountStat(
                    label: 'يتابع',
                    stream: social.watchFollowingCount(userId),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              if (!isMe)
                Row(
                  children: [
                    Expanded(
                      child: StreamBuilder<bool>(
                        stream: social.watchIsFollowing(myUid, userId),
                        builder: (context, followSnap) {
                          final isFollowing = followSnap.data ?? false;
                          return FilledButton.icon(
                            onPressed: () async {
                              if (isFollowing) {
                                await social.unfollowUser(myUid, userId);
                              } else {
                                await social.followUser(myUid, userId);
                              }
                            },
                            icon: Icon(isFollowing ? Icons.person_remove : Icons.person_add),
                            label: Text(isFollowing ? 'إلغاء المتابعة' : 'متابعة'),
                            style: isFollowing
                                ? FilledButton.styleFrom(backgroundColor: Colors.grey.shade300, foregroundColor: Colors.black87)
                                : null,
                          );
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          final convId = await MessageService().ensureConversation(myUid, userId);
                          if (!context.mounted) return;
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ChatScreen(
                                conversationId: convId,
                                myUid: myUid,
                                partnerId: userId,
                                partnerName: profile.fullName.isNotEmpty ? profile.fullName : profile.username,
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.chat_bubble_outline),
                        label: const Text('مراسلة'),
                      ),
                    ),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }
}

class _CountStat extends StatelessWidget {
  final String label;
  final Stream<int> stream;

  const _CountStat({required this.label, required this.stream});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<int>(
      stream: stream,
      builder: (context, snap) {
        final count = snap.data ?? 0;
        return Column(
          children: [
            Text('$count', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          ],
        );
      },
    );
  }
}
