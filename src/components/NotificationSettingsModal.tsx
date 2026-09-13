import React, { useEffect, useState } from 'react';
import { X, Bell, BellOff, MessageCircle, UserPlus, Reply, Megaphone, Loader2, CheckCircle2 } from 'lucide-react';
import { User } from '../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onSave: (prefs: NonNullable<User['notificationPrefs']>) => Promise<void> | void;
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, description, checked, disabled, onChange }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-start disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-brand-600 dark:text-brand-400">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{label}</div>
        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">{description}</div>
      </div>
    </div>
    <span
      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
          checked ? 'start-[18px]' : 'start-0.5'
        }`}
      />
    </span>
  </button>
);

/**
 * إعدادات إشعارات push (FCM) لكل مستخدم — mutedAll يوقف كل شيء دفعة واحدة
 * بصرف النظر عن باقي المفاتيح (يُعطَّل بقية الصفوف بصرياً حين يكون مفعَّلاً
 * ليعكس ذلك)، وكل فئة (رسائل/متابعات/ردود/ترويجية) قابلة للإيقاف منفردة.
 * undefined يُعامَل دائماً كـtrue في server/pushNotifications.ts (لم يُعطَّل
 * صراحة بعد) — لذا الحالة الافتراضية هنا قبل أي تعديل هي "الكل مفعَّل".
 */
export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSave
}) => {
  const [mutedAll, setMutedAll] = useState(currentUser.notificationPrefs?.mutedAll === true);
  const [messages, setMessages] = useState(currentUser.notificationPrefs?.messages !== false);
  const [follows, setFollows] = useState(currentUser.notificationPrefs?.follows !== false);
  const [replies, setReplies] = useState(currentUser.notificationPrefs?.replies !== false);
  const [promotional, setPromotional] = useState(currentUser.notificationPrefs?.promotional !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMutedAll(currentUser.notificationPrefs?.mutedAll === true);
    setMessages(currentUser.notificationPrefs?.messages !== false);
    setFollows(currentUser.notificationPrefs?.follows !== false);
    setReplies(currentUser.notificationPrefs?.replies !== false);
    setPromotional(currentUser.notificationPrefs?.promotional !== false);
    setSaved(false);
  }, [isOpen, currentUser.id, currentUser.notificationPrefs]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await onSave({ mutedAll, messages, follows, replies, promotional });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('تعذر حفظ إعدادات الإشعارات:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            إعدادات الإشعارات
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <ToggleRow
            icon={mutedAll ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            label="كتم كل الإشعارات"
            description="يوقف كل إشعارات push فوراً بصرف النظر عن باقي الخيارات أدناه"
            checked={mutedAll}
            onChange={setMutedAll}
          />

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <ToggleRow
            icon={<MessageCircle className="w-4 h-4" />}
            label="الرسائل"
            description="إشعار عند وصول رسالة خاصة جديدة"
            checked={messages}
            disabled={mutedAll}
            onChange={setMessages}
          />
          <ToggleRow
            icon={<UserPlus className="w-4 h-4" />}
            label="المتابعات"
            description="إشعار عند حصولك على متابع جديد"
            checked={follows}
            disabled={mutedAll}
            onChange={setFollows}
          />
          <ToggleRow
            icon={<Reply className="w-4 h-4" />}
            label="الردود"
            description="إشعار عند الرد على تعليقك في مقال أو تغريدة"
            checked={replies}
            disabled={mutedAll}
            onChange={setReplies}
          />
          <ToggleRow
            icon={<Megaphone className="w-4 h-4" />}
            label="إشعارات ترويجية"
            description="تذكيرات دورية بمحتوى جديد عند غيابك عن التطبيق"
            checked={promotional}
            disabled={mutedAll}
            onChange={setPromotional}
          />

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-extrabold text-xs active:scale-95 transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ الحفظ…</span>
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>تم الحفظ</span>
              </>
            ) : (
              <span>حفظ الإعدادات</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
