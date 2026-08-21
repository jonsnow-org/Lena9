import React from 'react';
import {
  Home,
  Compass,
  Bell,
  MessageSquare,
  PenTool,
  PlusCircle,
  Megaphone,
  User as UserIcon,
  TrendingUp,
  FileText,
  LayoutDashboard
} from 'lucide-react';
import { User, UserRole } from '../types';
import { getTranslator } from '../data/translations';

interface BottomNavProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  userRole: UserRole;
  currentUser: User | null;
  onOpenWriteAction?: () => void;
  onOpenCreateCampaign?: () => void;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
  onOpenProfile: () => void;
  unreadCount?: number;
  unreadMessagesCount?: number;
  adminActiveTab?: string;
  onAdminNavigate?: (tab: 'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'settings') => void;
  writerActiveTab?: string;
  onWriterNavigate?: (tab: 'articles' | 'stats_earnings') => void;
  /** دالة الترجمة الحالية — اختيارية بافتراضي عربي حتى لا يتعطل أي استدعاء
   *  سابق لهذا المكوّن لا يمرّرها بعد. */
  t?: (key: string) => string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  userRole,
  currentUser,
  onOpenWriteAction,
  onOpenCreateCampaign,
  onOpenNotifications,
  onOpenMessages,
  onOpenProfile,
  unreadCount = 0,
  unreadMessagesCount = 0,
  adminActiveTab,
  onAdminNavigate,
  t = getTranslator('ar')
}) => {
  // 1. READER ROLE: الرئيسية · استكشاف · إشعارات · رسائل · ملفي
  if (userRole === 'reader' || !currentUser) {
    return (
      <nav
        id="bottom-nav-reader"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 text-slate-900 border-t border-slate-200/90 shadow-xl dark:bg-slate-950/95 dark:text-white dark:border-brand-500/20 backdrop-blur-xl transition-colors pb-safe"
      >
        <div className="max-w-lg mx-auto px-3 h-16 flex items-center justify-around">
          {/* 1. الرئيسية */}
          <button
            id="nav-reader-feed"
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
            id="nav-reader-explore"
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
            id="nav-reader-notifications"
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

          {/* 4. رسائل */}
          <button
            id="nav-reader-messages"
            type="button"
            onClick={onOpenMessages}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group relative"
          >
            <div
              className={`p-1.5 rounded-xl transition-all relative ${
                activeTab === 'messages'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMessagesCount > 0 && (
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
              {t('messages')}
            </span>
          </button>

          {/* 5. ملفي */}
          <button
            id="nav-reader-profile"
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

  // 2. ADVERTISER ROLE: الرئيسية · حملاتي · إنشاء حملة · رسائل · ملفي
  if (userRole === 'advertiser') {
    return (
      <nav
        id="bottom-nav-advertiser"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 text-slate-900 border-t border-slate-200/90 shadow-xl dark:bg-slate-950/95 dark:text-white dark:border-brand-500/20 backdrop-blur-xl transition-colors pb-safe"
      >
        <div className="max-w-lg mx-auto px-2 h-16 flex items-center justify-around">
          {/* 1. الرئيسية */}
          <button
            id="nav-adv-feed"
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

          {/* 2. حملاتي */}
          <button
            id="nav-adv-campaigns"
            type="button"
            onClick={() => onChangeTab('campaigns')}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'campaigns'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <Megaphone className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                activeTab === 'campaigns' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('myCampaigns')}
            </span>
          </button>

          {/* 3. Central FAB: إنشاء حملة */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-6">
            <button
              id="nav-adv-fab"
              type="button"
              onClick={onOpenCreateCampaign}
              className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-cyan-600 via-brand-600 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-cyan-600/40 active:scale-90 hover:scale-105 transition-all border-2 border-white dark:border-slate-900"
              title={t('newCampaign')}
            >
              <PlusCircle className="w-6 h-6 stroke-[2.2]" />
            </button>
            <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-300 mt-1">{t('newCampaign')}</span>
          </div>

          {/* 4. رسائل */}
          <button
            id="nav-adv-messages"
            type="button"
            onClick={onOpenMessages}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group relative"
          >
            <div
              className={`p-1.5 rounded-xl transition-all relative ${
                activeTab === 'messages'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMessagesCount > 0 && (
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
              {t('messages')}
            </span>
          </button>

          {/* 5. إشعارات */}
          <button
            id="nav-adv-notifications"
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

          {/* 6. ملفي */}
          <button
            id="nav-adv-profile"
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

  // 3. WRITER ROLE: الرئيسية · مقالاتي · كتابة · لوحة الكاتب · ملفي
  if (userRole === 'writer') {
    return (
      <nav
        id="bottom-nav-writer"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 text-slate-900 border-t border-slate-200/90 shadow-xl dark:bg-slate-950/95 dark:text-white dark:border-brand-500/20 backdrop-blur-xl transition-colors pb-safe"
      >
        <div className="max-w-lg mx-auto px-2 h-16 flex items-center justify-around">
          {/* 1. الرئيسية */}
          <button
            id="nav-writer-feed"
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

          {/* 2. مقالاتي */}
          <button
            id="nav-writer-articles"
            type="button"
            onClick={() => onChangeTab('articles')}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'articles'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                activeTab === 'articles' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('myArticles')}
            </span>
          </button>

          {/* 3. Central FAB: كتابة */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-6">
            <button
              id="nav-writer-fab"
              type="button"
              onClick={onOpenWriteAction}
              className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-600 to-brand-700 text-white flex items-center justify-center shadow-lg shadow-brand-600/40 active:scale-90 hover:scale-105 transition-all border-2 border-white dark:border-slate-900"
              title={t('createArticle')}
            >
              <PenTool className="w-6 h-6 stroke-[2.2]" />
            </button>
            <span className="text-[10px] font-black text-brand-600 dark:text-brand-300 mt-1">{t('write')}</span>
          </div>

          {/* 4. لوحة الكاتب */}
          <button
            id="nav-writer-dashboard"
            type="button"
            onClick={() => onChangeTab('dashboard')}
            className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                activeTab === 'dashboard' ? 'text-brand-700 dark:text-brand-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('writerPanel')}
            </span>
          </button>

          {/* 5. إشعارات */}
          <button
            id="nav-writer-notifications"
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

          {/* 6. ملفي */}
          <button
            id="nav-writer-profile"
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

  // 4. ADMIN ROLE: الرئيسية · لوحة الإدارة (مدخل وحيد لكل تبويبات الإدارة) · رسائل · إشعارات · ملفي
  return (
    <nav
      id="bottom-nav-admin"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 text-slate-900 border-t border-slate-200/90 shadow-xl dark:bg-slate-950/95 dark:text-white dark:border-brand-500/20 backdrop-blur-xl transition-colors pb-safe"
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

        {/* 2. لوحة الإدارة */}
        <button
          id="nav-admin-overview"
          type="button"
          onClick={() => {
            onChangeTab('admin');
            onAdminNavigate?.('overview');
          }}
          className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'admin' && (adminActiveTab === 'overview' || !adminActiveTab)
                ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span
            className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
              activeTab === 'admin' && (adminActiveTab === 'overview' || !adminActiveTab)
                ? 'text-brand-700 dark:text-brand-300 font-extrabold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t('adminPanel')}
          </span>
        </button>

        {/* أزرار "المستخدمون" و"الحملات" أُزيلا من هنا عمداً — كانا يكرران
            تماماً تبويبي "المستخدمون" و"الحملات" الموجودين أصلاً داخل شريط
            تبويبات لوحة الإدارة نفسها (AdminDashboard)، فيصبح "لوحة الإدارة"
            المدخل الوحيد لكل تبويبات الإدارة، ومن داخلها يختار الأدمن أي
            تبويب يريد من شريطها الخاص — مدخل واحد فقط لكل وجهة، بلا تكرار. */}

        {/* 3. رسائل — كانت غائبة تماماً عن حساب الأدمن رغم توفرها لكل بقية
            الأدوار، فلا توجد أي وسيلة للأدمن لإرسال أو استقبال رسالة مباشرة. */}
        <button
          id="nav-admin-messages"
          type="button"
          onClick={onOpenMessages}
          className="flex-1 flex flex-col items-center justify-center py-1 touch-manipulation group relative"
        >
          <div
            className={`p-1.5 rounded-xl transition-all relative ${
              activeTab === 'messages'
                ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/40 scale-105'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            {unreadMessagesCount > 0 && (
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
            {t('messages')}
          </span>
        </button>

        {/* 4. إشعارات */}
        <button
          id="nav-admin-notifications"
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

        {/* 5. ملفي */}
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
};
