import React from 'react';
import {
  Menu,
  Sparkles,
  Wallet,
  Sun,
  Moon,
  LogIn,
  Globe
} from 'lucide-react';
import { User, UserRole, LanguageCode } from '../types';

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
  onOpenWallet,
  onOpenAiAssistant,
  onOpenAuth,
  onOpenProfile,
  unreadNotifsCount,
  theme,
  onToggleTheme,
  language = 'ar',
  onToggleLanguage
}) => {
  const isUserLoggedIn = Boolean(currentUser && currentUser.id && currentUser.id !== 'guest');

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return { label: 'مالك المنصة 👑', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'writer':
        return { label: 'كاتب ومؤلف ✍️', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'advertiser':
        return { label: 'معلن معتمد 📢', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'reader':
        return { label: 'قارئ ومُعلن 📖', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    }
  };

  return (
    <header
      id="top-app-bar"
      className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-purple-500/20 transition-colors shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Start / Left: Drawer trigger & Brand logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="header-drawer-button"
            type="button"
            onClick={onOpenDrawer}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-200 hover:bg-slate-900 active:scale-95 transition-all touch-manipulation border border-purple-500/20"
            title="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5 stroke-[2.2]" />
          </button>

          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer select-none active:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white flex items-center justify-center font-black text-base shadow-lg shadow-purple-600/30 ring-2 ring-purple-500/30">
              L
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-lg tracking-tight text-white leading-none">
                  LITERIUM
                </span>
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              </div>
              <span className="text-[9px] sm:text-[10px] text-purple-400 font-extrabold leading-tight hidden xs:inline">
                منصة الفكر والأدب والإعلانات
              </span>
            </div>
          </div>
        </div>

        {/* End / Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Smart AI Assistant Quick Pill */}
          <button
            id="header-ai-assistant"
            type="button"
            onClick={onOpenAiAssistant}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-black active:scale-95 transition-all shadow-sm"
            title="المساعد الذكي (Gemini AI)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 animate-spin-slow" />
            <span className="hidden sm:inline">مساعد AI</span>
          </button>

          {/* Language Switcher
              ⚠️ مُخفى مؤقتاً: ملف الترجمة موجود لكن معظم نصوص الواجهة
              مكتوبة مباشرة بالعربية داخل المكوّنات، فتبديل اللغة كان يغيّر
              اتجاه الصفحة فقط دون ترجمة فعلية — وهو ما يربك المستخدم.
              يُعاد تفعيله بعد ربط كل النصوص بملف translations.ts */}
          {false && onToggleLanguage && (
            <button
              id="header-language-toggle"
              type="button"
              onClick={onToggleLanguage}
              className="px-2.5 py-1.5 rounded-2xl flex items-center gap-1 text-slate-300 hover:bg-slate-900 active:scale-95 transition-all border border-purple-500/20 text-xs font-bold"
              title="تغيير اللغة"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span className="uppercase">{language}</span>
            </button>
          )}

          {/* Theme Switcher */}
          <button
            id="header-theme-toggle"
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-2xl flex items-center justify-center text-slate-300 hover:bg-slate-900 active:scale-95 transition-all border border-purple-500/20"
            title="تبديل المظهر"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            ) : (
              <Moon className="w-4 h-4 text-purple-300" />
            )}
          </button>

          {isUserLoggedIn && currentUser ? (
            <>
              {/* Wallet / Balance Quick Pill for all accounts */}
              <button
                id="header-wallet-chip"
                type="button"
                onClick={onOpenWallet}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-black active:scale-95 transition-all shadow-sm"
                title="المحفظة والرصيد"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="tabular-nums font-mono">${(currentUser.totalEarnings || 0).toFixed(2)}</span>
              </button>

              {/* زر الجرس أُزيل من هنا — الإشعارات الآن موحّدة فقط داخل
                  الشريط السفلي لكل الأدوار، تفادياً لازدواجية "زر بالأعلى
                  وزر بالأسفل" التي كانت تربك المستخدم سابقاً. */}

              {/* User Profile Chip (Avatar + Name + Role Badge) */}
              <button
                id="header-profile-avatar"
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2 p-1 px-2 rounded-2xl hover:bg-slate-900 border border-purple-500/20 active:scale-95 transition-all"
                title="الملف الشخصي"
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-xl object-cover ring-1 ring-purple-500/40"
                />
                <div className="hidden md:flex flex-col items-start text-right">
                  <span className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[9px] text-purple-300 font-semibold leading-tight">
                    {getRoleBadge(currentUser.role).label}
                  </span>
                </div>
                <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getRoleBadge(currentUser.role).color}`}>
                  {getRoleBadge(currentUser.role).label}
                </span>
              </button>
            </>
          ) : (
            <button
              id="header-auth-button"
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
