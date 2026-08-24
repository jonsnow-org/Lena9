import React from 'react';
import { X, Users, CheckCircle2 } from 'lucide-react';
import { User } from '../types';

interface FollowListModalProps {
  title: string;
  users: User[];
  currentUserId: string | null;
  followedWriterIds: string[];
  onToggleFollow: (userId: string) => void;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

/** نافذة عرض قائمة "متابِعون" أو "يتابع" — قائمة حقيقية من مستندات
 *  follows الفعلية (وليست عدّادات فقط)، مع زر متابعة/إلغاء متابعة فوري
 *  لكل شخص في القائمة، والضغط على أي شخص ينقل لصفحته الشخصية. */
export const FollowListModal: React.FC<FollowListModalProps> = ({
  title,
  users,
  currentUserId,
  followedWriterIds,
  onToggleFollow,
  onSelectUser,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3 space-y-1">
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-400">لا يوجد أحد هنا بعد.</p>
            </div>
          ) : (
            users.map((u) => {
              const isFollowing = followedWriterIds.includes(u.id);
              const isSelf = u.id === currentUserId;
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectUser(u);
                      onClose();
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-start"
                  >
                    <img
                      src={u.avatarUrl}
                      alt={u.fullName}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {u.penName || u.companyName || u.fullName}
                        </span>
                        {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block">@{u.username}</span>
                    </div>
                  </button>

                  {!isSelf && currentUserId && (
                    <button
                      type="button"
                      onClick={() => onToggleFollow(u.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all active:scale-95 ${
                        isFollowing
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          : 'bg-brand-600 hover:bg-brand-700 text-white'
                      }`}
                    >
                      {isFollowing ? 'إلغاء المتابعة' : 'متابعة'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
