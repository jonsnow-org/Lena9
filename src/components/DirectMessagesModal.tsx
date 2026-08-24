import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  X,
  Send,
  ArrowRight,
  Trash2,
  MoreVertical,
  Ban,
  BellOff,
  Bell,
  Flag,
  Image as ImageIcon,
  Video as VideoIcon,
  Smile,
  Loader2,
  AlertCircle,
  UserCircle2,
  LogOut
} from 'lucide-react';
import { AdCampaign, Conversation, DirectMessage, MessageReport, User } from '../types';
import { uploadAdMedia } from '../services/mediaApi';
import { timeAgoAr } from '../utils/dateFormat';
import { CHAT_STICKERS, ChatStickerFace, findStickerMeta } from './ChatStickers';
import { VideoPlayer } from './VideoPlayer';
import { AdSlot } from './AdSlot';

const STANDARD_EMOJIS = [
  '😀', '😂', '🥰', '😍', '😘', '😉', '😊', '🙂', '😎', '🤩',
  '😢', '😭', '😡', '😱', '🤔', '😴', '🙄', '😅', '🥳', '🤗',
  '👍', '👎', '🙏', '👏', '💪', '🤝', '✌️', '👌', '🤙', '✋',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯',
  '🔥', '✨', '🎉', '🎊', '⭐', '🌹', '☕', '📚', '✍️', '💬'
];

const REPORT_REASONS: { id: MessageReport['reason']; label: string }[] = [
  { id: 'abusive', label: 'محتوى مسيء' },
  { id: 'harassment', label: 'مضايقة أو إزعاج' },
  { id: 'spam', label: 'رسائل مزعجة/دعائية' },
  { id: 'other', label: 'سبب آخر' }
];

function stubUserFromConversation(c: Conversation): User {
  return {
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
  };
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 300;

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('تعذر قراءة معلومات الفيديو.'));
    };
    video.src = URL.createObjectURL(file);
  });
}

interface DirectMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  /** كل مستخدمي المنصة — لاشتقاق حضور الطرف الآخر (متصل/آخر ظهور) وحالة
   *  حظره الحيّة، بدل الاكتفاء ببيانات المحادثة الثابتة. */
  users: User[];
  conversations: Conversation[];
  messages: DirectMessage[];
  onSendMessage: (
    recipientId: string,
    content: string,
    media?: { url?: string; type: 'image' | 'video' | 'sticker' }
  ) => void;
  onDeleteMessage?: (messageId: string) => void;
  /** حذف نهائي (أدمن فقط، يطابق قواعد الأمان) — بخلاف onHideConversation. */
  onDeleteConversation?: (conversationId: string, partnerId: string) => void;
  /** إغلاق المحادثة من قائمتي فقط — متاح لأي مستخدم، تعود تلقائياً عند وصول رسالة جديدة. */
  onHideConversation?: (conversationId: string) => void;
  onToggleBlock?: (targetId: string, block: boolean) => void;
  onToggleMute?: (targetId: string, mute: boolean) => void;
  onReportUser?: (targetId: string, conversationId: string | undefined, reason: MessageReport['reason'], details: string) => void;
  onSetTyping?: (conversationId: string, isTyping: boolean) => void;
  activeChatPartner?: User | null;
  onOpenConversation?: (partnerId: string) => void;
  onOpenProfile?: (userId: string) => void;
  /** لعرض شريط إعلاني صغير أعلى قائمة المحادثات فقط (وليس داخل أي محادثة مفتوحة) */
  campaigns?: AdCampaign[];
}

export const DirectMessagesModal: React.FC<DirectMessagesModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  conversations,
  messages,
  onSendMessage,
  onDeleteMessage,
  onDeleteConversation,
  onHideConversation,
  onToggleBlock,
  onToggleMute,
  onReportUser,
  onSetTyping,
  activeChatPartner,
  onOpenConversation,
  onOpenProfile,
  campaigns = []
}) => {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(activeChatPartner?.id || null);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'standard' | 'stickers'>('standard');
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<MessageReport['reason']>('abusive');
  const [reportDetails, setReportDetails] = useState('');
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [, forceTick] = useState(0);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const lastTypingWriteRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // إعادة رسم كل ثانية — لازمة لتحديث "يكتب الآن"/"متصل الآن" اللذين
  // يعتمدان على فارق زمني حي، وليس فقط على وصول بيانات جديدة من Firestore.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // النافذة تبقى مركّبة دون إعادة تحميل بين مرات الفتح، لذا فتح محادثة
  // جديدة من ملف كاتب آخر (activeChatPartner يتغيّر) يجب أن يحدّث المحادثة
  // المعروضة فوراً، بدل بقاء آخر محادثة مفتوحة سابقاً على الشاشة.
  useEffect(() => {
    if (isOpen && activeChatPartner) {
      setSelectedPartnerId(activeChatPartner.id);
      onOpenConversation?.(activeChatPartner.id);
      setShowMenu(false);
      setShowEmoji(false);
      setShowReport(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeChatPartner]);

  const unreadCountByPartnerId = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m) => {
      if (!m.isRead && m.recipientId === currentUser.id) {
        counts[m.senderId] = (counts[m.senderId] || 0) + 1;
      }
    });
    return counts;
  }, [messages, currentUser.id]);

  // تعليم رسائل المحادثة المفتوحة كمقروءة كلما كان فيها أي شيء غير مقروء —
  // وليس فقط لحظة الانتقال إليها. onOpenConversation وحده (عند الفتح
  // الأول) كان يفوّت رسائل جديدة تصل لاحقاً أثناء بقاء نفس المحادثة مفتوحة
  // بالفعل (أو عند إعادة فتح النافذة على نفس المحادثة السابقة)، فتبقى
  // شارة "غير مقروء" عالقة رغم أن المستخدم يشاهد الرسائل فعلياً.
  useEffect(() => {
    if (!isOpen || !selectedPartnerId) return;
    if ((unreadCountByPartnerId[selectedPartnerId] || 0) > 0) {
      onOpenConversation?.(selectedPartnerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedPartnerId, unreadCountByPartnerId]);

  const visibleConversations = useMemo(
    () => conversations.filter((c) => !c.isHiddenForMe),
    [conversations]
  );

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.partnerId === selectedPartnerId) || null,
    [conversations, selectedPartnerId]
  );

  const selectedPartner: User | null = useMemo(() => {
    if (!selectedPartnerId) return null;
    return (
      users.find((u) => u.id === selectedPartnerId) ||
      (activeChatPartner?.id === selectedPartnerId ? activeChatPartner : null) ||
      (selectedConversation ? stubUserFromConversation(selectedConversation) : null)
    );
  }, [selectedPartnerId, users, activeChatPartner, selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, selectedPartnerId]);

  if (!isOpen) return null;

  const currentChatMessages = selectedPartnerId
    ? messages.filter(
        (m) =>
          (m.senderId === currentUser.id && m.recipientId === selectedPartnerId) ||
          (m.senderId === selectedPartnerId && m.recipientId === currentUser.id)
      )
    : [];

  const isBlockedByMe = Boolean(selectedPartnerId && currentUser.blockedUserIds?.includes(selectedPartnerId));
  const isBlockedByThem = Boolean(selectedPartner?.blockedUserIds?.includes(currentUser.id));
  const isMutedByMe = Boolean(selectedPartnerId && currentUser.mutedUserIds?.includes(selectedPartnerId));
  const canChat = !isBlockedByMe && !isBlockedByThem;

  const partnerTypingAt = selectedConversation?.partnerTypingAt;
  const isPartnerTyping = Boolean(partnerTypingAt && Date.now() - new Date(partnerTypingAt).getTime() < 4000);

  const presence = selectedPartner?.presence;
  const isPartnerOnline = Boolean(
    presence?.state === 'online' &&
      presence.lastHeartbeatAt &&
      Date.now() - new Date(presence.lastHeartbeatAt).getTime() < 60000
  );
  const lastSeenLabel = presence?.lastSeenAt ? `آخر ظهور ${timeAgoAr(presence.lastSeenAt)}` : 'غير متصل';

  const openConversation = (c: Conversation) => {
    setSelectedPartnerId(c.partnerId);
    setShowMenu(false);
    setShowEmoji(false);
    setShowReport(false);
    onOpenConversation?.(c.partnerId);
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (!selectedConversation || !onSetTyping) return;
    const now = Date.now();
    if (now - lastTypingWriteRef.current > 2000) {
      lastTypingWriteRef.current = now;
      onSetTyping(selectedConversation.id, true);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedPartnerId || !canChat) return;
    onSendMessage(selectedPartnerId, text);
    setText('');
  };

  const sendSticker = (stickerId: string) => {
    if (!selectedPartnerId || !canChat) return;
    onSendMessage(selectedPartnerId, stickerId, { type: 'sticker' });
    setShowEmoji(false);
  };

  const insertEmoji = (emoji: string) => {
    setText((t) => t + emoji);
  };

  const handleFileSelected = async (file: File, kind: 'image' | 'video') => {
    if (!selectedPartnerId || !canChat) return;
    setUploadError('');
    if (kind === 'image') {
      if (!file.type.startsWith('image/')) {
        setUploadError('يرجى اختيار ملف صورة صالح.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError('حجم الصورة يتجاوز 8 ميغابايت.');
        return;
      }
    } else {
      if (!file.type.startsWith('video/')) {
        setUploadError('يرجى اختيار ملف فيديو صالح.');
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setUploadError('حجم الفيديو يتجاوز 50 ميغابايت.');
        return;
      }
      try {
        const duration = await readVideoDuration(file);
        if (duration > MAX_VIDEO_SECONDS) {
          setUploadError('مدة الفيديو تتجاوز 5 دقائق. اختر مقطعاً أقصر.');
          return;
        }
      } catch {
        // لا نمنع الرفع لو تعذر قياس المدة محلياً — الخادم يتحقق فعلياً بعد الرفع
      }
    }

    setUploading(kind);
    try {
      const result = await uploadAdMedia(file, 'message');
      onSendMessage(selectedPartnerId, '', { url: result.url, type: kind });
    } catch (err: any) {
      setUploadError(err?.message || 'تعذر رفع الملف.');
    } finally {
      setUploading(null);
    }
  };

  const handleBlockToggle = () => {
    if (!selectedPartnerId) return;
    if (!isBlockedByMe && !window.confirm(`هل تريد حظر ${selectedPartner?.fullName || 'هذا المستخدم'}؟ لن يستطيع مراسلتك بعد الآن.`)) {
      return;
    }
    onToggleBlock?.(selectedPartnerId, !isBlockedByMe);
    setShowMenu(false);
  };

  const handleMuteToggle = () => {
    if (!selectedPartnerId) return;
    onToggleMute?.(selectedPartnerId, !isMutedByMe);
    setShowMenu(false);
  };

  const handleHideConversation = () => {
    if (!selectedConversation) return;
    onHideConversation?.(selectedConversation.id);
    setSelectedPartnerId(null);
    setShowMenu(false);
  };

  const handleOpenProfile = () => {
    if (!selectedPartnerId) return;
    setShowMenu(false);
    onOpenProfile?.(selectedPartnerId);
    onClose();
  };

  const handleSubmitReport = () => {
    if (!selectedPartnerId) return;
    onReportUser?.(selectedPartnerId, selectedConversation?.id, reportReason, reportDetails.trim());
    setShowReport(false);
    setReportDetails('');
    setReportReason('abusive');
    alert('تم إرسال بلاغك، سيراجعه فريق الإشراف قريباً.');
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl h-[85vh] max-h-[680px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedPartner && (
              <button
                onClick={() => {
                  setSelectedPartnerId(null);
                  setShowMenu(false);
                  setShowEmoji(false);
                }}
                className="sm:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
                title="رجوع لقائمة المحادثات"
              >
                <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </button>
            )}

            {selectedPartner ? (
              <button onClick={handleOpenProfile} className="flex items-center gap-2.5 min-w-0 text-start">
                <div className="relative shrink-0">
                  <img
                    src={selectedPartner.avatarUrl}
                    alt={selectedPartner.fullName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-xl object-cover"
                  />
                  <span
                    className={`absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                      isPartnerOnline ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                    {selectedPartner.fullName}
                  </h3>
                  <p className="text-[10px] text-slate-400 truncate">
                    {isPartnerTyping ? (
                      <span className="text-teal-600 dark:text-teal-400 font-bold">يكتب الآن...</span>
                    ) : isPartnerOnline ? (
                      'متصل الآن'
                    ) : (
                      lastSeenLabel
                    )}
                  </p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">الرسائل والمحادثات</h3>
                  <p className="text-[11px] text-slate-400 truncate">تواصل مباشر بين القراء والكتاب</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedPartner && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((s) => !s)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="خيارات المحادثة"
                >
                  <MoreVertical className="w-4.5 h-4.5" />
                </button>
                {showMenu && (
                  <div className="absolute end-0 top-full mt-1.5 w-52 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden z-10 text-xs">
                    <button
                      onClick={handleOpenProfile}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-bold"
                    >
                      <UserCircle2 className="w-3.5 h-3.5" />
                      عرض الملف الشخصي
                    </button>
                    <button
                      onClick={handleMuteToggle}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-bold"
                    >
                      {isMutedByMe ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      {isMutedByMe ? 'إلغاء الكتم' : 'كتم الإشعارات'}
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowReport(true);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-amber-600 font-bold"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      إبلاغ عن إساءة
                    </button>
                    <button
                      onClick={handleBlockToggle}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 font-bold"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {isBlockedByMe ? 'إلغاء الحظر' : 'حظر المستخدم'}
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700" />
                    <button
                      onClick={handleHideConversation}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-500 font-bold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      حذف المحادثة
                    </button>
                  </div>
                )}
              </div>
            )}
            {selectedPartner && currentUser.role === 'admin' && onDeleteConversation && (
              <button
                onClick={() => {
                  if (!selectedConversation) return;
                  const confirmed = window.confirm(
                    `سيتم حذف محادثتك مع ${selectedPartner.fullName} بكل رسائلها نهائياً. هل تريد المتابعة؟`
                  );
                  if (!confirmed) return;
                  onDeleteConversation(selectedConversation.id, selectedPartner.id);
                  setSelectedPartnerId(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="حذف نهائي (صلاحية أدمن)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Conversation list */}
          <div
            className={`w-full sm:w-72 border-e border-slate-200 dark:border-slate-800 overflow-y-auto ${
              selectedPartner ? 'hidden sm:block' : 'block'
            }`}
          >
            {/* شريط إعلاني صغير أعلى قائمة المحادثات فقط — لا يظهر إطلاقاً
                داخل أي محادثة مفتوحة حتى لا يزعج تدفّق الرسائل نفسه. */}
            <div className="px-3 pt-3">
              <AdSlot slotId="messages_list" campaigns={campaigns} viewerId={currentUser.id} />
            </div>

            {visibleConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">لا توجد محادثات سابقة حالياً</div>
            ) : (
              visibleConversations.map((c) => {
                const unread = unreadCountByPartnerId[c.partnerId] || 0;
                const muted = currentUser.mutedUserIds?.includes(c.partnerId);
                return (
                  <div
                    key={c.id}
                    onClick={() => openConversation(c)}
                    className={`flex items-center gap-3 p-3.5 border-b border-slate-100 dark:border-slate-800/60 cursor-pointer transition-colors ${
                      selectedPartnerId === c.partnerId
                        ? 'bg-teal-50 dark:bg-teal-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    } ${muted ? 'opacity-60' : ''}`}
                  >
                    <img
                      src={c.partnerAvatar}
                      alt={c.partnerName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className={`text-xs truncate flex items-center gap-1 ${
                            unread > 0 && !muted ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-900 dark:text-white'
                          }`}
                        >
                          {c.partnerName}
                          {muted && <BellOff className="w-3 h-3 text-slate-400 shrink-0" />}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">{timeAgoAr(c.lastMessageTime)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] truncate ${unread > 0 && !muted ? 'text-slate-700 dark:text-slate-200 font-bold' : 'text-slate-500'}`}>
                          {c.lastMessage || 'ابدأ المحادثة الآن'}
                        </p>
                        {unread > 0 && !muted && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!window.confirm(`حذف المحادثة مع ${c.partnerName} من قائمتك؟ يمكنك استقبال رسائل جديدة منه لاحقاً بلا مشكلة.`)) return;
                        onHideConversation?.(c.id);
                      }}
                      className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="حذف المحادثة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Chat Panel
              min-w-0 إلزامي هنا: هذه اللوحة عنصر flex أفقي داخل "Body Split"،
              وبدونها يفرض محتوى الفقاعات (نص طويل + أختام وقت) على الحاوية
              أن تتمدد بعرضها الطبيعي (min-width: auto الافتراضي)، فتتجاوز
              عرض الشاشة الفعلي على الجوال وتنكشف فقاعات الرسائل جزئياً خلف
              حافة الشاشة أفقياً بدل الانضغاط ضمن العرض المتاح. */}
          <div
            className={`flex-1 min-w-0 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 ${
              !selectedPartner ? 'hidden sm:flex items-center justify-center' : 'flex'
            }`}
          >
            {selectedPartner ? (
              <>
                <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-3">
                  {currentChatMessages.map((msg) => {
                    const isMe = msg.senderId === currentUser.id;
                    const canDelete = Boolean(onDeleteMessage) && (isMe || currentUser.role === 'admin');
                    const sticker = msg.mediaType === 'sticker' ? findStickerMeta(msg.content) : undefined;

                    return (
                      <div key={msg.id} className={`flex items-center gap-1.5 group min-w-0 ${isMe ? 'justify-start' : 'justify-end'}`}>
                        {isMe && canDelete && (
                          <button
                            onClick={() => {
                              if (window.confirm('حذف هذه الرسالة نهائياً؟')) onDeleteMessage!(msg.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-opacity"
                            title="حذف الرسالة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {sticker ? (
                          <div className="max-w-[45%]">
                            <ChatStickerFace meta={sticker} className="w-20 h-20" />
                            <span className={`block text-[9px] mt-0.5 text-slate-400 ${isMe ? 'text-start' : 'text-end'}`}>
                              {timeAgoAr(msg.createdAt)}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`max-w-[75%] min-w-0 px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words ${
                              isMe
                                ? 'bg-teal-600 text-white rounded-te-none'
                                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-ts-none shadow-2xs'
                            }`}
                          >
                            {msg.mediaType === 'image' && msg.mediaUrl && (
                              <img
                                src={msg.mediaUrl}
                                alt=""
                                className="rounded-xl max-w-full max-h-64 object-cover mb-1.5 cursor-pointer"
                                onClick={() => window.open(msg.mediaUrl, '_blank')}
                              />
                            )}
                            {msg.mediaType === 'video' && msg.mediaUrl && (
                              <VideoPlayer src={msg.mediaUrl} className="rounded-xl max-w-full max-h-64 mb-1.5" />
                            )}
                            {msg.content && <p className="break-words">{msg.content}</p>}
                            <span className={`block text-[9px] mt-1 text-end ${isMe ? 'text-teal-200' : 'text-slate-400'}`}>
                              {timeAgoAr(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        {!isMe && canDelete && (
                          <button
                            onClick={() => {
                              if (window.confirm('حذف هذه الرسالة نهائياً؟')) onDeleteMessage!(msg.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-opacity"
                            title="حذف الرسالة (صلاحية أدمن)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {isPartnerTyping && (
                    <div className="flex justify-end">
                      <div className="px-4 py-2.5 rounded-2xl rounded-ts-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {!canChat ? (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
                    <p className="text-xs font-bold text-rose-500 mb-2">
                      {isBlockedByMe ? 'لقد حظرت هذا المستخدم — لا يمكنكما التراسل.' : 'لا يمكنك مراسلة هذا المستخدم حالياً.'}
                    </p>
                    {isBlockedByMe && (
                      <button
                        onClick={handleBlockToggle}
                        className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs"
                      >
                        إلغاء الحظر
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
                    {uploadError && (
                      <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-rose-500 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {showEmoji && (
                      <div className="absolute bottom-full inset-x-0 mb-1 mx-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                        <div className="flex items-center border-b border-slate-100 dark:border-slate-700">
                          <button
                            onClick={() => setEmojiTab('standard')}
                            className={`flex-1 py-2 text-[11px] font-bold ${
                              emojiTab === 'standard' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'
                            }`}
                          >
                            الشائعة
                          </button>
                          <button
                            onClick={() => setEmojiTab('stickers')}
                            className={`flex-1 py-2 text-[11px] font-bold ${
                              emojiTab === 'stickers' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'
                            }`}
                          >
                            ملصقات ليتيريوم
                          </button>
                        </div>
                        <div className="max-h-52 overflow-y-auto p-2.5">
                          {emojiTab === 'standard' ? (
                            <div className="grid grid-cols-8 gap-1.5">
                              {STANDARD_EMOJIS.map((e) => (
                                <button
                                  key={e}
                                  onClick={() => insertEmoji(e)}
                                  className="text-lg p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 gap-2">
                              {CHAT_STICKERS.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => sendSticker(s.id)}
                                  title={s.label}
                                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex flex-col items-center gap-0.5"
                                >
                                  <ChatStickerFace meta={s} className="w-11 h-11" />
                                  <span className="text-[9px] text-slate-400">{s.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSend} className="p-3 flex items-center gap-1.5">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelected(file, 'image');
                          e.target.value = '';
                        }}
                      />
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelected(file, 'video');
                          e.target.value = '';
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => setShowEmoji((s) => !s)}
                        className={`p-2 rounded-xl shrink-0 ${showEmoji ? 'bg-teal-50 text-teal-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        title="سمايلات وملصقات"
                      >
                        <Smile className="w-4.5 h-4.5" />
                      </button>
                      <button
                        type="button"
                        disabled={uploading !== null}
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 rounded-xl shrink-0 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        title="إرسال صورة"
                      >
                        {uploading === 'image' ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <ImageIcon className="w-4.5 h-4.5" />}
                      </button>
                      <button
                        type="button"
                        disabled={uploading !== null}
                        onClick={() => videoInputRef.current?.click()}
                        className="p-2 rounded-xl shrink-0 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        title="إرسال فيديو قصير (حتى 5 دقائق)"
                      >
                        {uploading === 'video' ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <VideoIcon className="w-4.5 h-4.5" />}
                      </button>

                      <input
                        type="text"
                        value={text}
                        onChange={(e) => handleTextChange(e.target.value)}
                        onFocus={() => setShowEmoji(false)}
                        placeholder="اكتب رسالتك..."
                        className="flex-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500 min-w-0"
                      />
                      <button
                        type="submit"
                        disabled={!text.trim()}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shrink-0"
                      >
                        <span className="hidden sm:inline">إرسال</span>
                        <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">اختر محادثة من القائمة لبدء التراسل</div>
            )}
          </div>

          {/* Report submodal */}
          {showReport && selectedPartner && (
            <div
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-20"
              onClick={() => setShowReport(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Flag className="w-4 h-4 text-amber-500" />
                  إبلاغ عن {selectedPartner.fullName}
                </h4>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        checked={reportReason === r.id}
                        onChange={() => setReportReason(r.id)}
                        className="accent-teal-600"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="تفاصيل إضافية (اختياري)..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-teal-500 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowReport(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                  >
                    إرسال البلاغ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
