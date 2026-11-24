import React from 'react';
import {
  Home,
  Compass,
  Bell,
  MessageSquare,
  Megaphone,
  User as UserIcon,
  DollarSign
} from 'lucide-react';
import { User, UserRole } from '../types';
import { getTranslator } from '../data/translations';

interface BottomNavProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  userRole: UserRole;
  currentUser: User | null;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
  onOpenProfile: () => void;
  unreadCount?: number;
  unreadMessagesCount?: number;
  adminActiveTab?: string;
  onAdminNavigate?: (tab: 'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'settings' | 'money' | 'accounting' | 'promotions') => void;
  /** دالة الترجمة الحالية — اختيارية بافتراضي عربي حتى لا يتعطل أي استدعاء
   *  سابق لهذا المكوّن لا يمرّرها بعد. */
  t?: (key: string) => string;
}

/**
 * شريط تنقّل موحّد واحد فقط لكل الحسابات غير الأدمن (زائر أو عضو مسجَّل
 * بغضّ النظر عن دوره المخزَّن قارئ/كاتب/معلن) — بدل أربعة أشرطة مختلفة
 * الأزرار والعدد كانت موجودة سابقاً حسب role، فيرى كاتب حسابَ تنقّل أقل
 * محتوى (بلا استكشاف مثلاً) من حساب آخر مسجَّل كقارئ، رغم أن الاثنين
 * يملكان نفس الصلاحيات بالضبط في النموذج الموحّد الحالي. شريط الأدمن
 * وحده يبقى مختلفاً فعلياً لأن أدواته الإدارية مختلفة جوهرياً.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  userRole,
  currentUser,
  onOpenNotifications,
  onOpenMessages,
  onOpenProfile,
  unreadCount = 0,
  unreadMessagesCount = 0,
  adminActiveTab,
  onAdminNavigate,
  t = getTranslator('ar')
}) => {
  if (userRole === 'admin') {
    return (
      <nav
        id="bottom-nav-admin"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/98 text-slate-900 border-t border-slate-200/90 shadow-xl dark:bg-slate-950/98 dark:text-white dark:border-brand-500/20 transition-colors pb-safe"
      >
        <div className="max-w-lg mx-auto px-2 h-16 flex items-center justify-around">
          {/* 1. الرئيسية */}
          <button
            id="nav-admin-feed"
            type="button"
            onClick={() => onChangeTab('feed')}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'feed'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <Home className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                activeTab === 'feed' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('home')}
            </span>
          </button>

          {/* 2. المالية والحسابات */}
          <button
            id="nav-admin-money"
            type="button"
            onClick={() => {
              onChangeTab('profile');
              onAdminNavigate?.('money');
            }}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'profile' && (adminActiveTab === 'money' || adminActiveTab === 'accounting')
                  ? 'bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-600/30 dark:text-amber-300 dark:border-amber-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                activeTab === 'profile' && (adminActiveTab === 'money' || adminActiveTab === 'accounting')
                  ? 'text-amber-700 dark:text-amber-300 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              المالية
            </span>
          </button>

          {/* 3. الإعلانات والترويج */}
          <button
            id="nav-admin-campaigns"
            type="button"
            onClick={() => {
              onChangeTab('profile');
              onAdminNavigate?.('campaigns');
            }}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'profile' && (adminActiveTab === 'campaigns' || adminActiveTab === 'promotions')
                  ? 'bg-cyan-50 text-cyan-700 border border-cyan-300 dark:bg-cyan-600/30 dark:text-cyan-300 dark:border-cyan-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <Megaphone className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                activeTab === 'profile' && (adminActiveTab === 'campaigns' || adminActiveTab === 'promotions')
                  ? 'text-cyan-700 dark:text-cyan-300 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              الإعلانات
            </span>
          </button>

          {/* 4. رسائل */}
          <button
            id="nav-admin-messages"
            type="button"
            onClick={onOpenMessages}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group relative"
          >
            <div className="p-1.5 rounded-xl transition-all relative text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200">
              <MessageSquare className="w-5 h-5" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 text-slate-500 dark:text-slate-400">
              رسائل
            </span>
          </button>

          {/* 5. ملفي ومراكز الإدارة */}
          <button
            id="nav-admin-profile"
            type="button"
            onClick={onOpenProfile}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'profile'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                activeTab === 'profile' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('profile')}
            </span>
          </button>
        </div>
      </nav>
    );
  }

  // شريط الأعضاء الموحّد: زائر أو أي عضو مسجَّل، بغضّ النظر عن دوره
  // المخزَّن — الرئيسية · استكشاف · إشعارات · رسائل · ملفي.
  return (
    <nav
      id="bottom-nav-member"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/98 text-slate-900 border-t border-slate-200/90 shadow-xl dark:bg-slate-950/98 dark:text-white dark:border-brand-500/20 transition-colors pb-safe"
    >
      <div className="max-w-lg mx-auto px-3 h-16 flex items-center justify-around">
        {/* 1. الرئيسية */}
        <button
          id="nav-member-feed"
          type="button"
          onClick={() => onChangeTab('feed')}
          className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'feed'
                ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
          </div>
          <span
            className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
              activeTab === 'feed' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t('home')}
          </span>
        </button>

        {/* 2. استكشاف */}
        <button
          id="nav-member-explore"
          type="button"
          onClick={() => onChangeTab('explore')}
          className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'explore'
                ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
            }`}
          >
            <Compass className="w-5 h-5" />
          </div>
          <span
            className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
              activeTab === 'explore' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t('explore')}
          </span>
        </button>

        {/* 3. إشعارات */}
        <button
          id="nav-member-notifications"
          type="button"
          onClick={onOpenNotifications}
          className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group relative"
        >
          <div
            className={`p-1.5 rounded-xl transition-all relative ${
              activeTab === 'notifications'
                ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
            }`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 w-4 h-4 bg-brand-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
              activeTab === 'notifications' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t('notifications')}
          </span>
        </button>

        {/* 4. رسائل — معطّل للزائر (لا حساب له لتلقي أو إرسال رسائل) */}
        <button
          id="nav-member-messages"
          type="button"
          onClick={currentUser?.id === 'guest' ? undefined : onOpenMessages}
          disabled={currentUser?.id === 'guest'}
          className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group relative disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div
            className={`p-1.5 rounded-xl transition-all relative ${
              activeTab === 'messages'
                ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            {unreadMessagesCount > 0 && currentUser?.id !== 'guest' && (
              <span className="absolute -top-1 -end-1 w-4 h-4 bg-teal-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                {unreadMessagesCount}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
              activeTab === 'messages' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {currentUser?.id === 'guest' ? 'يلزم التسجيل' : t('messages')}
          </span>
        </button>

        {/* 5. ملفي */}
        <button
          id="nav-member-profile"
          type="button"
          onClick={onOpenProfile}
          className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
            }`}
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </div>
          <span
            className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
              activeTab === 'profile' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t('profile')}
          </span>
        </button>
      </div>
    </nav>
  );
};
