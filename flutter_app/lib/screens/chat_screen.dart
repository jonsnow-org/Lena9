import 'dart:async';
import 'package:flutter/material.dart';
import '../models/dm_message.dart';
import '../services/message_service.dart';

class ChatScreen extends StatefulWidget {
  final String conversationId;
  final String myUid;
  final String partnerId;
  final String partnerName;

  const ChatScreen({
    super.key,
    required this.conversationId,
    required this.myUid,
    required this.partnerId,
    required this.partnerName,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _service = MessageService();
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _typingDebounce;

  @override
  void dispose() {
    _typingDebounce?.cancel();
    _service.setTypingState(widget.conversationId, widget.myUid, false);
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onTextChanged(String _) {
    _service.setTypingState(widget.conversationId, widget.myUid, true);
    _typingDebounce?.cancel();
    _typingDebounce = Timer(const Duration(seconds: 3), () {
      _service.setTypingState(widget.conversationId, widget.myUid, false);
    });
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    _textController.clear();
    _typingDebounce?.cancel();
    await _service.setTypingState(widget.conversationId, widget.myUid, false);
    await _service.sendMessage(
      conversationId: widget.conversationId,
      senderId: widget.myUid,
      participants: [widget.myUid, widget.partnerId],
      text: text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.partnerName)),
      body: Column(
        children: [
          Expanded(
            child: StreamBuilder<List<DmMessage>>(
              stream: _service.watchMessages(widget.conversationId),
              builder: (context, snapshot) {
                final messages = snapshot.data ?? [];

                // وسم رسائل الطرف الآخر غير المقروءة كمقروءة عند فتح المحادثة.
                final unreadFromPartner = messages
                    .where((m) => m.senderId == widget.partnerId && !m.isRead)
                    .map((m) => m.id)
                    .toList();
                if (unreadFromPartner.isNotEmpty) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    _service.markMessagesRead(unreadFromPartner);
                  });
                }

                if (messages.isEmpty) {
                  return const Center(child: Text('ابدأ المحادثة الآن'));
                }

                return ListView.builder(
                  controller: _scrollController,
                  reverse: true,
                  padding: const EdgeInsets.all(12),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final msg = messages[messages.length - 1 - index];
                    final isMine = msg.senderId == widget.myUid;
                    return Align(
                      alignment: isMine ? Alignment.centerLeft : Alignment.centerRight,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 3),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                        decoration: BoxDecoration(
                          color: isMine ? Colors.teal : Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          msg.text,
                          style: TextStyle(color: isMine ? Colors.white : Colors.black87),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      onChanged: _onTextChanged,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'اكتب رسالة...',
                        border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(24))),
                        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send),
                    color: Colors.teal,
                    onPressed: _send,
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
