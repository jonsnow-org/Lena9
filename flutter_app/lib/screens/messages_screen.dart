import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/conversation.dart';
import '../services/auth_service.dart';
import '../services/message_service.dart';
import 'chat_screen.dart';
import 'user_profile_screen.dart';

class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final myUid = context.watch<AuthService>().user?.uid;
    if (myUid == null) return const SizedBox.shrink();
    final service = MessageService();

    return StreamBuilder<List<Conversation>>(
      stream: service.watchConversations(myUid),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final conversations = snapshot.data!.where((c) => !c.hiddenFor.contains(myUid)).toList();
        if (conversations.isEmpty) {
          return const Center(child: Text('لا توجد محادثات بعد'));
        }
        return ListView.separated(
          itemCount: conversations.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, index) => _ConversationTile(
            conversation: conversations[index],
            myUid: myUid,
            service: service,
          ),
        );
      },
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final Conversation conversation;
  final String myUid;
  final MessageService service;

  const _ConversationTile({required this.conversation, required this.myUid, required this.service});

  @override
  Widget build(BuildContext context) {
    final partnerId = conversation.partnerId(myUid);
    if (partnerId.isEmpty) return const SizedBox.shrink();

    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      future: FirebaseFirestore.instance.collection('users').doc(partnerId).get(),
      builder: (context, userSnap) {
        final partnerData = userSnap.data?.data() ?? {};
        final name = (partnerData['fullName'] ?? partnerData['penName'] ?? '...') as String;
        final avatar = (partnerData['avatarUrl'] ?? '') as String;
        final isTyping = conversation.isPartnerTyping(myUid);

        return ListTile(
          leading: GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => UserProfileScreen(userId: partnerId, myUid: myUid)),
              );
            },
            child: CircleAvatar(
              backgroundImage: avatar.isNotEmpty ? NetworkImage(avatar) : null,
              child: avatar.isEmpty ? const Icon(Icons.person) : null,
            ),
          ),
          title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text(
            isTyping ? 'يكتب الآن...' : conversation.lastMessage,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: isTyping ? const TextStyle(color: Colors.teal, fontWeight: FontWeight.bold) : null,
          ),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ChatScreen(
                  conversationId: conversation.id,
                  myUid: myUid,
                  partnerId: partnerId,
                  partnerName: name,
                ),
              ),
            );
          },
          onLongPress: () => _showActions(context, partnerId, name),
        );
      },
    );
  }

  void _showActions(BuildContext context, String partnerId, String partnerName) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.close),
              title: const Text('إغلاق المحادثة'),
              onTap: () {
                service.hideConversationForMe(conversation.id, myUid);
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.volume_off),
              title: const Text('كتم'),
              onTap: () {
                service.toggleMuteUser(myUid, partnerId, true);
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.block, color: Colors.red),
              title: const Text('حظر', style: TextStyle(color: Colors.red)),
              onTap: () {
                service.toggleBlockUser(myUid, partnerId, true);
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined, color: Colors.red),
              title: const Text('إبلاغ', style: TextStyle(color: Colors.red)),
              onTap: () {
                service.submitUserReport(
                  reporterId: myUid,
                  reportedUserId: partnerId,
                  conversationId: conversation.id,
                  reason: 'other',
                );
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('تم إرسال البلاغ للمراجعة')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
