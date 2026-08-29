import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/tweet.dart';
import '../services/auth_service.dart';
import '../services/tweet_service.dart';
import 'tweet_detail_screen.dart';

/// انعكاس مباشر لـ TweetFeed.tsx/TweetCard.tsx — خلاصة تغريدات حية (280
/// حرفاً كحد أقصى، إعجاب/تعليق/مشاركة حقيقية عبر Firestore، بلا أي حالة
/// محلية تختفي بين الأجهزة).
class TweetsScreen extends StatelessWidget {
  const TweetsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.watch<AuthService>().user?.uid;
    final service = TweetService();

    return Scaffold(
      body: StreamBuilder<List<Tweet>>(
        stream: service.watchTweets(),
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final tweets = snap.data!;
          if (tweets.isEmpty) {
            return const Center(child: Text('لا توجد تغريدات بعد — كن أول من يغرّد'));
          }
          return StreamBuilder<Set<String>>(
            stream: uid == null ? Stream<Set<String>>.value(const {}) : service.watchMyLikedTweetIds(uid),
            builder: (context, likedSnap) {
              final liked = likedSnap.data ?? <String>{};
              return ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: tweets.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) => _TweetTile(
                  tweet: tweets[i],
                  isLiked: liked.contains(tweets[i].id),
                  uid: uid,
                  service: service,
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: uid == null
          ? null
          : FloatingActionButton(
              tooltip: 'تغريدة جديدة',
              onPressed: () => _showComposeSheet(context, uid, service),
              child: const Icon(Icons.edit),
            ),
    );
  }

  void _showComposeSheet(BuildContext context, String uid, TweetService service) {
    final controller = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: controller,
              maxLength: 280,
              maxLines: 4,
              autofocus: true,
              decoration: const InputDecoration(hintText: 'بم تفكر؟', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  final content = controller.text.trim();
                  if (content.isEmpty) return;
                  final userDoc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
                  final data = userDoc.data() ?? {};
                  await service.postTweet(
                    authorId: uid,
                    authorName: (data['fullName'] ?? '') as String,
                    authorUsername: (data['username'] ?? '') as String,
                    authorAvatar: (data['avatarUrl'] ?? '') as String,
                    content: content,
                  );
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                child: const Text('نشر'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TweetTile extends StatelessWidget {
  final Tweet tweet;
  final bool isLiked;
  final String? uid;
  final TweetService service;

  const _TweetTile({required this.tweet, required this.isLiked, required this.uid, required this.service});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TweetDetailScreen(tweet: tweet)),
      ),
      leading: CircleAvatar(
        backgroundImage: tweet.authorAvatar.isNotEmpty ? NetworkImage(tweet.authorAvatar) : null,
        child: tweet.authorAvatar.isEmpty ? const Icon(Icons.person) : null,
      ),
      title: Text(tweet.authorName.isNotEmpty ? tweet.authorName : '@${tweet.authorUsername}',
          style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tweet.content),
          const SizedBox(height: 6),
          Row(
            children: [
              InkWell(
                onTap: uid == null ? null : () => service.toggleLike(tweetId: tweet.id, uid: uid!, isLiking: !isLiked),
                child: Row(
                  children: [
                    Icon(isLiked ? Icons.favorite : Icons.favorite_border,
                        size: 16, color: isLiked ? Colors.red : Colors.grey),
                    const SizedBox(width: 4),
                    Text('${tweet.likesCount}', style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(width: 20),
              Icon(Icons.mode_comment_outlined, size: 16, color: Colors.grey.shade600),
              const SizedBox(width: 4),
              Text('${tweet.commentsCount}', style: const TextStyle(fontSize: 12)),
              const SizedBox(width: 20),
              InkWell(
                onTap: () => TweetService().incrementShare(tweet.id),
                child: Row(
                  children: [
                    Icon(Icons.share_outlined, size: 16, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text('${tweet.sharesCount}', style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
              const Spacer(),
              if (uid != null && uid == tweet.authorId)
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18),
                  onPressed: () => service.deleteTweet(tweet.id),
                ),
            ],
          ),
        ],
      ),
      isThreeLine: true,
    );
  }
}
