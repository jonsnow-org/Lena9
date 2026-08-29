import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/app_notification.dart';

/// انعكاس مباشر لدوال قسم "الإشعارات" في firestoreService.ts.
class NotificationService {
  final _db = FirebaseFirestore.instance;

  Stream<List<AppNotification>> watchNotifications(String userId) {
    return _db
        .collection('notifications')
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snap) => snap.docs.map(AppNotification.fromFirestore).toList()
          ..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0))));
  }

  Future<void> markRead(String notificationId) async {
    await _db.collection('notifications').doc(notificationId).update({'isRead': true});
  }

  Future<void> markAllRead(List<AppNotification> notifications) async {
    final unread = notifications.where((n) => !n.isRead);
    if (unread.isEmpty) return;
    final batch = _db.batch();
    for (final n in unread) {
      batch.update(_db.collection('notifications').doc(n.id), {'isRead': true});
    }
    await batch.commit();
  }

  Future<void> delete(String notificationId) async {
    await _db.collection('notifications').doc(notificationId).delete();
  }

  Future<void> clearAll(List<AppNotification> notifications) async {
    if (notifications.isEmpty) return;
    final batch = _db.batch();
    for (final n in notifications) {
      batch.delete(_db.collection('notifications').doc(n.id));
    }
    await batch.commit();
  }
}
