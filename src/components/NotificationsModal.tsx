import React from 'react';
import {
  Bell,
  X,
  DollarSign,
  Heart,
  MessageSquare,
  Sparkles,
  UserPlus,
  Check,
  Trash2,
  Megaphone,
  Reply
} from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onMarkOneAsRead: (id: string) => void;
  onDeleteOne: (id: string) => void;
  onClearAll: () => void;
}

/** وقت نسبي مختصر (منذ...) بدل عرض التاريخ الخام ISO كما هو. */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `منذ ${diffHours} س`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `منذ ${diffDays} يوم`;
  return date.toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' });
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onMarkOneAsRead,
  onDeleteOne,
  onClearAll
}) => {
  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'earning':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'withdrawal':
        return <DollarSign className="w-4 h-4 text-amber-500" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-teal-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-cyan-500" />;
      case 'reply':
        return <Reply className="w-4 h-4 text-cyan-500" />;
      case 'like':
        return <Heart className="w-4 h-4 text-rose-500" />;
      case 'campaign':
        return <Megaphone className="w-4 h-4 text-blue-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-md max-h-[85vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              الإشعارات والتنبيهات
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              لا توجد إشعارات جديدة حالياً
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => !notif.isRead && onMarkOneAsRead(notif.id)}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-colors group ${
                  notif.isRead
                    ? 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800'
                    : 'bg-teal-50/70 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 cursor-pointer'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 shadow-2xs flex items-center justify-center shrink-0">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatRelativeTime(notif.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteOne(notif.id);
                  }}
                  title="حذف الإشعار"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تحديد الكل كمقروء</span>
            </button>
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-rose-500 dark:text-rose-400 font-bold hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح الكل</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
