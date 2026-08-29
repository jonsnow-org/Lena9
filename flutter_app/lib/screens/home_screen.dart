import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/app_notification.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';
import 'admin_screen.dart';
import 'articles_screen.dart';
import 'wallet_screen.dart';
import 'messages_screen.dart';
import 'new_conversation_screen.dart';
import 'notifications_screen.dart';
import 'tweets_screen.dart';

/// القشرة الرئيسية بعد تسجيل الدخول — شريط تنقّل سفلي بثلاث وجهات، يطابق
/// أقسام الموقع الأساسية (مقالات / محفظة / رسائل).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  static const _screens = [
    ArticlesScreen(),
    TweetsScreen(),
    WalletScreen(),
    MessagesScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final myUid = context.watch<AuthService>().user?.uid;

    return Scaffold(
      appBar: AppBar(
        title: const Text('ليتيريوم'),
        actions: [
          if (myUid != null)
            StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance.collection('users').doc(myUid).snapshots(),
              builder: (context, snap) {
                final isAdmin = (snap.data?.data()?['role']) == 'admin';
                if (!isAdmin) return const SizedBox.shrink();
                return IconButton(
                  tooltip: 'لوحة الأدمن',
                  icon: const Icon(Icons.admin_panel_settings_outlined),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const AdminScreen()),
                  ),
                );
              },
            ),
          if (myUid != null)
            StreamBuilder<List<AppNotification>>(
              stream: NotificationService().watchNotifications(myUid),
              builder: (context, snap) {
                final unreadCount = (snap.data ?? const []).where((n) => !n.isRead).length;
                return IconButton(
                  tooltip: 'الإشعارات',
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                    );
                  },
                  icon: Badge(
                    isLabelVisible: unreadCount > 0,
                    label: Text('$unreadCount'),
                    child: const Icon(Icons.notifications_outlined),
                  ),
                );
              },
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'تسجيل الخروج',
            onPressed: () => context.read<AuthService>().signOut(),
          ),
        ],
      ),
      body: IndexedStack(index: _currentIndex, children: _screens),
      floatingActionButton: (_currentIndex == 3 && myUid != null)
          ? FloatingActionButton(
              tooltip: 'محادثة جديدة',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => NewConversationScreen(myUid: myUid)),
                );
              },
              child: const Icon(Icons.add_comment),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.article_outlined), selectedIcon: Icon(Icons.article), label: 'مقالات'),
          NavigationDestination(icon: Icon(Icons.tag_outlined), selectedIcon: Icon(Icons.tag), label: 'تغريدات'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet), label: 'المحفظة'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'الرسائل'),
        ],
      ),
    );
  }
}
