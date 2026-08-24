import React, { useEffect, useMemo, useState } from 'react';
import { Eye, MessageSquare, ShieldAlert, X, Flag } from 'lucide-react';
import { User } from '../../types';
import {
  subscribeToAllConversationsForAdmin,
  subscribeToConversationMessagesForAdmin
} from '../../services/firestoreService';
import { timeAgoAr } from '../../utils/dateFormat';
import { VideoPlayer } from '../VideoPlayer';

interface AdminChatsTabProps {
  users: User[];
}

interface RawConversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
}

interface RawMessage {
  id: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'sticker';
  createdAt?: string;
}

function userLabel(users: User[], id: string): { name: string; avatar: string } {
  const u = users.find((usr) => usr.id === id);
  return {
    name: u?.penName || u?.companyName || u?.fullName || 'مستخدم محذوف',
    avatar: u?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
  };
}

/**
 * لوحة إشراف الأدمن على المحادثات — لغرض واحد فقط: التأكد من جودة المنصة
 * والتحقق من بلاغات الإساءة الفعلية. الدخول لقراءة محادثة هنا لا يكتب أي
 * شيء إطلاقاً (لا isRead ولا typing)، فلا يشعر أي من الطرفين بدخول الأدمن —
 * قواعد الأمان تسمح بهذا أصلاً لأن isAdmin() يتجاوز شرط participants على
 * كل مستند conversations/messages، دون أي حاجة لتغييرها.
 */
export const AdminChatsTab: React.FC<AdminChatsTabProps> = ({ users }) => {
  const [conversations, setConversations] = useState<RawConversation[]>([]);
  const [openConversation, setOpenConversation] = useState<RawConversation | null>(null);
  const [openMessages, setOpenMessages] = useState<RawMessage[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = subscribeToAllConversationsForAdmin((list) => setConversations(list as RawConversation[]));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!openConversation) {
      setOpenMessages([]);
      return;
    }
    const unsub = subscribeToConversationMessagesForAdmin(openConversation.id, (list) =>
      setOpenMessages(list as RawMessage[])
    );
    return () => unsub();
  }, [openConversation]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      const [a, b] = c.participants || [];
      const nameA = userLabel(users, a).name.toLowerCase();
      const nameB = userLabel(users, b).name.toLowerCase();
      return nameA.includes(q) || nameB.includes(q);
    });
  }, [conversations, users, search]);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            مراقبة المحادثات — جودة المنصة
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            جدول بكل المحادثات الجارية بين المستخدمين حالياً. القراءة هنا صامتة تماماً ولا تُخطر أياً من الطرفين —
            استخدمها فقط للتحقق من بلاغات إساءة حقيقية أو مراقبة جودة المحتوى.
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم مستخدم..."
          className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-hidden focus:border-amber-500 w-full md:w-64"
        />
      </div>

      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">لا توجد محادثات مطابقة حالياً</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="p-3 text-start font-bold">الطرف الأول</th>
                  <th className="p-3 text-start font-bold">الطرف الثاني</th>
                  <th className="p-3 text-start font-bold">آخر رسالة</th>
                  <th className="p-3 text-start font-bold">التوقيت</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const [aId, bId] = c.participants || [];
                  const a = userLabel(users, aId);
                  const b = userLabel(users, bId);
                  return (
                    <tr key={c.id} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img src={a.avatar} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-slate-200 font-bold">{a.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img src={b.avatar} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-slate-200 font-bold">{b.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-400 max-w-[220px] truncate">{c.lastMessage || '—'}</td>
                      <td className="p-3 text-slate-500 whitespace-nowrap">{timeAgoAr(c.lastMessageAt)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => setOpenConversation(c)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold hover:bg-amber-500/20 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          قراءة صامتة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openConversation && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setOpenConversation(null)}
        >
          <div
            className="w-full max-w-lg h-[75vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-amber-500/10">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Flag className="w-4 h-4" />
                وضع الإشراف — أنت تقرأ هذه المحادثة دون علم الطرفين
              </div>
              <button onClick={() => setOpenConversation(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {openMessages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 pt-8 flex flex-col items-center gap-2">
                  <MessageSquare className="w-6 h-6" />
                  لا توجد رسائل بعد في هذه المحادثة
                </div>
              ) : (
                openMessages.map((m) => {
                  const sender = userLabel(users, m.senderId);
                  return (
                    <div key={m.id} className="flex items-start gap-2">
                      <img src={sender.avatar} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-bold text-slate-300">{sender.name}</span>
                          <span className="text-[9px] text-slate-500">{timeAgoAr(m.createdAt)}</span>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs inline-block max-w-full break-words">
                          {m.mediaType === 'image' && m.mediaUrl && (
                            <img src={m.mediaUrl} alt="" className="rounded-lg max-h-48 mb-1" />
                          )}
                          {m.mediaType === 'video' && m.mediaUrl && (
                            <VideoPlayer src={m.mediaUrl} className="rounded-lg max-h-48 mb-1" />
                          )}
                          {m.mediaType === 'sticker' ? <span className="text-slate-400">[ملصق]</span> : m.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
