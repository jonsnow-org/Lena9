import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/tweet.dart';
import '../services/auth_service.dart';
import '../services/tweet_service.dart';

/// عرض تغريدة واحدة مع تعليقاتها — انعكاس مباشر لقسم التعليقات في
/// TweetCard.tsx (بلا ردود متداخلة على التعليقات في هذه النسخة).
class TweetDetailScreen extends StatefulWidget {
  final Tweet tweet;

  const TweetDetailScreen({super.key, required this.tweet});

  @override
  State<TweetDetailScreen> createState() => _TweetDetailScreenState();
}

class _TweetDetailScreenState extends State<TweetDetailScreen> {
  final _service = TweetService();
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submitComment(String uid) async {
    final content = _controller.text.trim();
    if (content.isEmpty) return;
    final userDoc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
    final data = userDoc.data() ?? {};
    await _service.addComment(
      tweetId: widget.tweet.id,
      userId: uid,
      userName: (data['fullName'] ?? '') as String,
      userAvatar: (data['avatarUrl'] ?? '') as String,
      content: content,
    );
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    final uid = context.watch<AuthService>().user?.uid;

    return Scaffold(
      appBar: AppBar(title: const Text('التغريدة')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  backgroundImage: widget.tweet.authorAvatar.isNotEmpty ? NetworkImage(widget.tweet.authorAvatar) : null,
                  child: widget.tweet.authorAvatar.isEmpty ? const Icon(Icons.person) : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.tweet.authorName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(widget.tweet.content),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: StreamBuilder<List<TweetComment>>(
              stream: _service.watchComments(widget.tweet.id),
              builder: (context, snap) {
                if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                final comments = snap.data!;
                if (comments.isEmpty) {
                  return const Center(child: Text('لا توجد تعليقات بعد'));
                }
                return ListView.builder(
                  itemCount: comments.length,
                  itemBuilder: (context, i) {
                    final c = comments[i];
                    return ListTile(
                      leading: CircleAvatar(
                        radius: 16,
                        backgroundImage: c.userAvatar.isNotEmpty ? NetworkImage(c.userAvatar) : null,
                        child: c.userAvatar.isEmpty ? const Icon(Icons.person, size: 16) : null,
                      ),
                      title: Text(c.userName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      subtitle: Text(c.content),
                    );
                  },
                );
              },
            ),
          ),
          if (uid != null)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        decoration: const InputDecoration(hintText: 'أضف تعليقاً...', border: OutlineInputBorder(), isDense: true),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.send),
                      onPressed: () => _submitComment(uid),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
