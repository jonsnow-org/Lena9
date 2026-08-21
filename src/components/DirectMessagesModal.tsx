import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  User as UserIcon,
  CheckCheck,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Conversation, DirectMessage, User } from '../types';

interface DirectMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  conversations: Conversation[];
  messages: DirectMessage[];
  onSendMessage: (recipientId: string, content: string) => void;
  activeChatPartner?: User | null;
  /** يُستدعى عند فتح محادثة (من القائمة أو من activeChatPartner) — نقطة
   *  واحدة لتعليم رسائل هذه المحادثة كمقروءة بدل ترك عدّاد الرسائل غير
   *  المقروءة عالقاً على قيمته السابقة. */
  onOpenConversation?: (partnerId: string) => void;
}

export const DirectMessagesModal: React.FC<DirectMessagesModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  conversations,
  messages,
  onSendMessage,
  activeChatPartner,
  onOpenConversation
}) => {
  const [selectedPartner, setSelectedPartner] = useState<User | null>(activeChatPartner || null);
  const [text, setText] = useState('');

  // النافذة تبقى مركّبة دون إعادة تحميل بين مرات الفتح، لذا فتح محادثة
  // جديدة من ملف كاتب آخر (activeChatPartner يتغيّر) يجب أن يحدّث المحادثة
  // المعروضة فوراً، بدل بقاء آخر محادثة مفتوحة سابقاً على الشاشة.
  useEffect(() => {
    if (isOpen && activeChatPartner) {
      setSelectedPartner(activeChatPartner);
      onOpenConversation?.(activeChatPartner.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeChatPartner]);

  const unreadCountByPartnerId = React.useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m) => {
      if (!m.isRead && m.recipientId === currentUser.id) {
        counts[m.senderId] = (counts[m.senderId] || 0) + 1;
      }
    });
    return counts;
  }, [messages, currentUser.id]);

  if (!isOpen) return null;

  const currentChatMessages = selectedPartner
    ? messages.filter(
        (m) =>
          (m.senderId === currentUser.id && m.recipientId === selectedPartner.id) ||
          (m.senderId === selectedPartner.id && m.recipientId === currentUser.id)
      )
    : [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedPartner) return;
    onSendMessage(selectedPartner.id, text);
    setText('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-2xl h-[85vh] max-h-[680px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            {selectedPartner && (
              <button
                onClick={() => setSelectedPartner(null)}
                className="sm:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {selectedPartner ? selectedPartner.fullName : 'الرسائل والمحادثات'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedPartner ? `@${selectedPartner.username}` : 'تواصل مباشر بين القراء والكتاب'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation list (hidden on small screen if chat active) */}
          <div
            className={`w-full sm:w-72 border-e border-slate-200 dark:border-slate-800 overflow-y-auto ${
              selectedPartner ? 'hidden sm:block' : 'block'
            }`}
          >
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                لا توجد محادثات سابقة حالياً
              </div>
            ) : (
              conversations.map((c) => {
                const unread = unreadCountByPartnerId[c.partnerId] || 0;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedPartner({
                        id: c.partnerId,
                        fullName: c.partnerName,
                        username: c.partnerName.replace(/\s+/g, '_').toLowerCase(),
                        avatarUrl: c.partnerAvatar,
                        role: c.partnerRole,
                        email: '',
                        followersCount: 0,
                        followingCount: 0,
                        articlesCount: 0,
                        totalViews: 0,
                        totalEarnings: 0,
                        monthlyEarnings: 0
                      });
                      onOpenConversation?.(c.partnerId);
                    }}
                    className={`flex items-center gap-3 p-3.5 border-b border-slate-100 dark:border-slate-800/60 cursor-pointer transition-colors ${
                      selectedPartner?.id === c.partnerId
                        ? 'bg-teal-50 dark:bg-teal-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <img
                      src={c.partnerAvatar}
                      alt={c.partnerName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs truncate ${unread > 0 ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-900 dark:text-white'}`}>
                          {c.partnerName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">{c.lastMessageTime}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] truncate ${unread > 0 ? 'text-slate-700 dark:text-slate-200 font-bold' : 'text-slate-500'}`}>
                          {c.lastMessage}
                        </p>
                        {unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Chat Panel */}
          <div
            className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 ${
              !selectedPartner ? 'hidden sm:flex items-center justify-center' : 'flex'
            }`}
          >
            {selectedPartner ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {currentChatMessages.map((msg) => {
                    const isMe = msg.senderId === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isMe
                              ? 'bg-teal-600 text-white rounded-te-none'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-ts-none shadow-2xs'
                          }`}
                        >
                          <p>{msg.content}</p>
                          <span
                            className={`block text-[9px] mt-1 text-end ${
                              isMe ? 'text-teal-200' : 'text-slate-400'
                            }`}
                          >
                            {msg.createdAt}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleSend}
                  className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2"
                >
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <span>إرسال</span>
                    <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </form>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                اختر محادثة من القائمة لبدء التراسل
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
