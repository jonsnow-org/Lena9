import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/app_notification.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';

const Map<String, IconData> _kTypeIcons = {
  'like': Icons.favorite,
  'comment': Icons.chat_bubble,
  'follow': Icons.person_add,
  'earning': Icons.attach_money,
  'withdrawal': Icons.account_balance_wallet,
  'campaign': Icons.campaign,
  'system': Icons.notifications,
  'share': Icons.share,
  'reply': Icons.reply,
};

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final myUid = context.watch<AuthService>().user?.uid;
    final service = NotificationService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('الإشعارات'),
      ),
      body: myUid == null
          ? const SizedBox.shrink()
          : StreamBuilder<List<AppNotification>>(
              stream: service.watchNotifications(myUid),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final notifications = snapshot.data!;
                if (notifications.isEmpty) {
                  return const Center(child: Text('لا توجد إشعارات بعد'));
                }
                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton.icon(
                            onPressed: () => service.markAllRead(notifications),
                            icon: const Icon(Icons.done_all, size: 18),
                            label: const Text('تعليم الكل كمقروء'),
                          ),
                          TextButton.icon(
                            onPressed: () => _confirmClearAll(context, service, notifications),
                            icon: const Icon(Icons.delete_sweep, size: 18, color: Colors.red),
                            label: const Text('مسح الكل', style: TextStyle(color: Colors.red)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView.separated(
                        itemCount: notifications.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final n = notifications[index];
                          return Dismissible(
                            key: ValueKey(n.id),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              color: Colors.red,
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              child: const Icon(Icons.delete, color: Colors.white),
                            ),
                            onDismissed: (_) => service.delete(n.id),
                            child: ListTile(
                              tileColor: n.isRead ? null : Colors.teal.withValues(alpha: 0.06),
                              leading: CircleAvatar(
                                backgroundColor: Colors.teal.withOpacity(0.15),
                                child: Icon(_kTypeIcons[n.type] ?? Icons.notifications, color: Colors.teal, size: 20),
                              ),
                              title: Text(n.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text(n.message, maxLines: 2, overflow: TextOverflow.ellipsis),
                              onTap: () {
                                if (!n.isRead) service.markRead(n.id);
                              },
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
    );
  }

  void _confirmClearAll(BuildContext context, NotificationService service, List<AppNotification> notifications) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('مسح كل الإشعارات؟'),
        content: const Text('لا يمكن التراجع عن هذا الإجراء.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          TextButton(
            onPressed: () {
              service.clearAll(notifications);
              Navigator.pop(ctx);
            },
            child: const Text('مسح', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
