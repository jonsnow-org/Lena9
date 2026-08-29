import 'dart:async';

import 'package:flutter/material.dart';
import '../models/user_profile.dart';
import '../services/social_service.dart';
import 'user_profile_screen.dart';

/// بدء محادثة جديدة عبر البحث عن مستخدم — لم يكن موجوداً إطلاقاً في
/// النسخة الأصيلة سابقاً (يمكن فقط متابعة محادثات موجودة مسبقاً).
class NewConversationScreen extends StatefulWidget {
  final String myUid;

  const NewConversationScreen({super.key, required this.myUid});

  @override
  State<NewConversationScreen> createState() => _NewConversationScreenState();
}

class _NewConversationScreenState extends State<NewConversationScreen> {
  final _social = SocialService();
  final _controller = TextEditingController();
  Timer? _debounce;
  List<UserProfile> _results = [];
  bool _isSearching = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      final query = value.trim();
      if (query.isEmpty) {
        setState(() => _results = []);
        return;
      }
      setState(() => _isSearching = true);
      final results = await _social.searchUsers(query);
      if (!mounted) return;
      setState(() {
        _results = results.where((u) => u.id != widget.myUid).toList();
        _isSearching = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          onChanged: _onQueryChanged,
          decoration: const InputDecoration(
            hintText: 'ابحث بالاسم...',
            border: InputBorder.none,
          ),
        ),
      ),
      body: _isSearching
          ? const Center(child: CircularProgressIndicator())
          : _results.isEmpty
              ? Center(
                  child: Text(
                    _controller.text.trim().isEmpty ? 'ابحث عن مستخدم لبدء محادثة' : 'لا توجد نتائج',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                )
              : ListView.separated(
                  itemCount: _results.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final user = _results[index];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundImage: user.avatarUrl.isNotEmpty ? NetworkImage(user.avatarUrl) : null,
                        child: user.avatarUrl.isEmpty ? const Icon(Icons.person) : null,
                      ),
                      title: Text(user.fullName.isNotEmpty ? user.fullName : '@${user.username}'),
                      subtitle: user.username.isNotEmpty ? Text('@${user.username}') : null,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => UserProfileScreen(userId: user.id, myUid: widget.myUid),
                          ),
                        );
                      },
                    );
                  },
                ),
    );
  }
}
