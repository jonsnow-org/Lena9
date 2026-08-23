import React from 'react';
import { Menu, LogIn, Bell } from 'lucide-react';
import { User, UserRole, LanguageCode } from '../types';
import { getTranslator } from '../data/translations';
import { LiveClock, LiveStatusDot } from './LiveClock';

// شريط علوي أبسط بعد نقل كل وظائفه (المساعد الذكي، تبديل اللغة، تبديل
// المظهر، المحفظة، الملف الشخصي) إلى القائمة الجانبية — حيث توجد أصلاً
// إعدادات اللغة والمظهر، بدل تكرارها في مكانين. هذا يحل ثلاث مشاكل معاً:
// عرض الشريط الزائد على الشاشات الصغيرة، وتكرار عرض شارة الدور مرتين
// داخل بطاقة الملف الشخصي على الشاشات المتوسطة، وتراكم أزرار لا حاجة
// لتكرارها بجانب القائمة الجانبية نفسها على بعد نقرة واحدة فقط.
interface TopHeaderProps {
  currentUser: User | null;
  onOpenDrawer: () => void;
  onOpenNotifications: () => void;
  onOpenWallet: () => void;
  onOpenAiAssistant: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  unreadNotifsCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language?: LanguageCode;
  onToggleLanguage?: () => void;
  onSearchClick?: () => void;
  onOpenLanding?: () => void;
  onSwitchRole?: (role: UserRole) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  onOpenDrawer,
  onOpenNotifications,
  onOpenAuth,
  onOpenLanding,
  unreadNotifsCount = 0,
  language = 'ar'
}) => {
  const isUserLoggedIn = Boolean(currentUser && currentUser.id && currentUser.id !== 'guest');
  const t = getTranslator(language as LanguageCode);

  return (
    <header
      id="top-app-bar"
      className="sticky top-0 z-40 bg-white/95 text-slate-900 border-b border-slate-200/90 dark:bg-slate-950/95 dark:text-white dark:border-brand-500/20 backdrop-blur-xl transition-colors shadow-xs"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
        {/* Start / Left: Drawer trigger & Brand logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            id="header-drawer-button"
            type="button"
            onClick={onOpenDrawer}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 active:scale-95 transition-all touch-manipulation border border-slate-200 dark:border-brand-500/20 shadow-2xs"
            title={t('menu')}
          >
            <Menu className="w-5 h-5 stroke-[2.2]" />
          </button>

          <div
            id="header-brand-logo"
            role="button"
            tabIndex={0}
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              if (onOpenLanding) {
                onOpenLanding();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (onOpenLanding) onOpenLanding();
              }
            }}
            title="الرئيسية — الصعود لأعلى الصفحة"
            aria-label="الرئيسية — الصعود لأعلى الصفحة"
            className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-600 to-brand-700 text-white flex items-center justify-center font-black text-base shadow-md shadow-brand-600/20 ring-2 ring-brand-500/30">
              L
            </div>
            <span className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white leading-none">
              LITERIUM
            </span>
          </div>
        </div>

        {/* Middle: زر الإشعارات — للأدمن تحديداً هنا (بقية الأدوار لديها
            زر إشعارات في الشريط السفلي أصلاً، فتكراره هنا لها زائد عن
            الحاجة). كان في القائمة الجانبية، وهي مكان "مخفي" يحتاج نقرتين
            للوصول إليه، فنُقل إلى الشريط العلوي مباشرةً بين الشعار والساعة. */}
        {isUserLoggedIn && currentUser?.role === 'admin' && onOpenNotifications && (
          <button
            id="header-notifications-button"
            type="button"
            onClick={onOpenNotifications}
            className="relative w-10 h-10 rounded-2xl flex items-center justify-center text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 active:scale-95 transition-all touch-manipulation border border-slate-200 dark:border-brand-500/20 shadow-2xs shrink-0"
            title="الإشعارات"
          >
            <Bell className="w-5 h-5 stroke-[2.2]" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
              </span>
            )}
          </button>
        )}

        {/* End / Right: ساعة تركيا/سوريا الحيّة + نقطة "الموقع يعمل" + تسجيل
            الدخول للزائر فقط */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <LiveClock />
          <LiveStatusDot />

          {!isUserLoggedIn && (
            <button
              id="header-auth-button"
              type="button"
              onClick={onOpenAuth}
              className="px-3 sm:px-4 py-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-600 hover:from-brand-500 hover:to-brand-500 text-white text-xs font-black shadow-md shadow-brand-600/30 flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('login')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
