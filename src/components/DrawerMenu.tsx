import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Users,
  Scale,
  Sparkles,
  Sun,
  Moon,
  Globe,
  LogOut,
  PenTool,
  Megaphone,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  Crown,
  Zap,
  TrendingUp,
  FileText,
  BarChart3,
  Bookmark
} from 'lucide-react';
import { User, LanguageCode, UserRole } from '../types';
import { getRemainingAiUses } from '../utils/aiQuota';
import { getTranslator } from '../data/translations';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onOpenWallet: () => void;
  onOpenKyc: () => void;
  onOpenBeta20: () => void;
  onOpenPolicies: (tab?: 'privacy' | 'terms' | 'restricted') => void;
  onOpenLegal?: (section: 'privacy' | 'terms' | 'about' | 'contact') => void;
  onOpenAiAssistant: () => void;
  onOpenSubscription: () => void;
  onOpenProfile: (writerId?: string) => void;
  onSwitchRole: (role: UserRole) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  currentLang: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  followedWriters: User[];
  onSelectFollowedWriter: (writer: User) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenLogin?: () => void;
  /** شخصية التنقل المُشتقة من النشاط الفعلي (وليس الدور المُسجَّل فقط) —
   *  نفس القيمة المستخدمة في شريط التنقل السفلي، لضمان اتساق القوائم
   *  المعروضة هنا مع الواجهة الفعلية بدل تناقضهما. */
  navPersona?: UserRole;
  /** يفتح محرر مقال جديد مباشرة — نقطة دخول موحّدة للكتابة لأي حساب
   *  مسجَّل، بغضّ النظر عن الدور المسجَّل أو شخصية التنقل الحالية. */
  onStartWriting?: () => void;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenWallet,
  onOpenKyc,
  onOpenBeta20,
  onOpenPolicies,
  onOpenLegal,
  onOpenAiAssistant,
  onOpenSubscription,
  onOpenProfile,
  onSwitchRole,
  onLogout,
  theme,
  onToggleTheme,
  currentLang,
  onChangeLanguage,
  followedWriters = [],
  onSelectFollowedWriter,
  onNavigateTab,
  onOpenLogin,
  navPersona,
  onStartWriting
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const quotaStats = getRemainingAiUses(currentUser.aiQuota);
  // احتياط: إن لم يُمرَّر navPersona من الأعلى، اعتمد على الدور المُسجَّل
  // مباشرة بدل تعطّل القائمة بأكملها.
  const persona: UserRole = navPersona || currentUser.role;
  const t = getTranslator(currentLang);

  if (!isOpen) return null;

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return '👑 مالك المنصة (Admin)';
      case 'writer':
        return '✍️ كاتب ومؤلف معتمد';
      case 'advertiser':
        return '📢 معلن وشريك أعمال';
      case 'reader':
        return '📖 قارئ ومثقف';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 end-0 max-w-full flex">
        <div className="w-screen max-w-sm bg-slate-900 border-s border-brand-500/20 text-white shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-in-right">
          {/* Header */}
          <div className="p-5 border-b border-brand-500/20 bg-slate-950/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (currentUser.id === 'guest') return;
                onOpenProfile();
                onClose();
              }}
              className="flex items-center gap-3 text-start rounded-xl -m-1 p-1 hover:bg-slate-900/60 transition-colors"
              title="فتح ملفي الشخصي"
            >
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover ring-2 ring-brand-500/40"
              />
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="font-extrabold text-sm text-white">
                    {currentUser.fullName}
                  </h4>
                  {currentUser.isVerified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  )}
                </div>
                <span className="text-[11px] text-brand-400 font-bold">
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Links */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Current Role (fixed at registration — no longer switchable
                from here; that was letting any signed-in user instantly
                become 'admin' with a single tap). */}
            <div className="p-3.5 rounded-2xl bg-brand-950/40 border border-brand-500/25">
              <span className="block text-[11px] font-bold text-brand-200 mb-1">
                {currentUser.id === 'guest' ? 'أنت تتصفح حالياً:' : 'حسابك الحالي:'}
              </span>
              <div className="text-sm font-extrabold text-white">
                {currentUser.id === 'guest' ? 'زائر (بدون تسجيل دخول)' : getRoleLabel(currentUser.role)}
              </div>
            </div>

            {/* AI Assistant Quota Widget */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand-950/60 to-brand-950/60 border border-brand-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-bold text-white">المساعد الذكي (Gemini AI)</span>
                </div>
                {quotaStats.isUnlimited ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/30 text-brand-300 border border-brand-500/40">
                    باقة غير محدودة ⭐
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300">
                    {quotaStats.remaining} استخدام متبقي
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  onOpenAiAssistant();
                  onClose();
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>محادثة المساعد الذكي</span>
              </button>
            </div>

            {/* Role-Specific Direct Navigation Links */}
            <div className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-400 mb-1 px-1">
                القوائم المخصصة لدورك:
              </span>

              {persona === 'admin' && (
                <>
                  <button
                    onClick={() => {
                      onNavigateTab?.('admin_overview');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-4 h-4 text-brand-400" />
                      <span>اللوحة الإدارية والمالية المركزية</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                  </button>

                  <button
                    onClick={() => {
                      onNavigateTab?.('admin_fraud');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      <span>مركز فحص الاحتيال والأمان (SOC)</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                  </button>
                </>
              )}

              {persona === 'writer' && (
                <>
                  <button
                    onClick={() => {
                      onNavigateTab?.('writer_hub');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-4 h-4 text-brand-400" />
                      <span>استوديو الكاتب وإحصائيات القراءة</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                  </button>

                  <button
                    onClick={() => {
                      onNavigateTab?.('my_articles');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>مقالاتي ومسوداتي المنشورة</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                  </button>

                  {/* أُزيل زر المحفظة المكرر من هنا.
                      المحفظة متاحة من الشريط العلوي ومن صفحة "ملفي" فقط،
                      بدلاً من أربعة مداخل تؤدي لنفس النافذة. */}
                </>
              )}

              {persona === 'advertiser' && (
                <>
                  <button
                    onClick={() => {
                      onNavigateTab?.('campaigns');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Megaphone className="w-4 h-4 text-brand-400" />
                      <span>لوحة الحملات الإعلانية ومؤشرات CPC/CPM</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                  </button>

                  <button
                    onClick={() => {
                      onNavigateTab?.('billing');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span>شحن الرصيد والفوترة</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                  </button>
                </>
              )}

              {/* الكتابة متاحة لأي حساب مسجَّل من البداية (دون احتساب أرباح
                  حتى تحقيق شروط منشئ المحتوى) — من له أدوات الكاتب أعلاه
                  أصلاً يصل للكتابة من هناك، فلا داعي لتكرار الزر هنا. */}
              {currentUser.id !== 'guest' && persona !== 'writer' && onStartWriting && (
                <button
                  onClick={() => {
                    onStartWriting();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PenTool className="w-4 h-4 text-teal-400" />
                    <span>ابدأ كتابة مقال جديد</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                </button>
              )}

              {/* استكشاف والمحفوظات: روابط عامة لأي مستخدم (بما فيهم من ترقّى
                  فعلياً لدور كاتب/معلن) — وليست حكراً على من لم يمارس أي
                  نشاط بعد، حتى لا تختفي من قوائم الكتّاب والمعلنين. */}
              <button
                onClick={() => {
                  onNavigateTab?.('explore');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-brand-400" />
                  <span>استكشاف المقالات والكتب</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
              </button>

              {/* إنشاء إعلان: متاح لأي حساب مسجَّل غير الزائر، ما عدا من لديه
                  أصلاً زر حملات مخصص أعلاه (شخصية "معلن") تفادياً للتكرار. */}
              {currentUser.id !== 'guest' && persona !== 'advertiser' && (
                <button
                  onClick={() => {
                    onNavigateTab?.('campaigns');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Megaphone className="w-4 h-4 text-cyan-400" />
                    <span>إنشاء إعلان وترويج (قارئ ومُعلن)</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                </button>
              )}

              <button
                onClick={() => {
                  onNavigateTab?.('saved');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <span>المحفوظات وسجل القراءة</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
              </button>

              {/* General Links */}
              {currentUser.id !== 'guest' && (
                <button
                  onClick={() => {
                    onOpenWallet();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>المحفظة والأرباح</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    ${(currentUser.availableBalance ?? currentUser.walletBalance ?? 0).toFixed(2)}
                  </span>
                </button>
              )}

              {currentUser.id !== 'guest' && (
                <button
                  onClick={() => {
                    onOpenKyc();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>توثيق الهوية (KYC)</span>
                  </div>
                  {currentUser.isKycVerified ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      معتمد ✓
                    </span>
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                  )}
                </button>
              )}

              <button
                onClick={() => {
                  onOpenPolicies();
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Scale className="w-4 h-4 text-slate-400" />
                  <span>السياسات والشروط ومكافحة الاحتيال</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
              </button>

              {/* روابط الصفحات القانونية الكاملة (شرط AdSense) */}
              {onOpenLegal && (
                <div className="pt-2 mt-2 border-t border-slate-800 grid grid-cols-2 gap-1.5">
                  {([
                    { id: 'privacy' as const, label: 'سياسة الخصوصية' },
                    { id: 'terms' as const, label: 'شروط الاستخدام' },
                    { id: 'about' as const, label: 'من نحن' },
                    { id: 'contact' as const, label: 'اتصل بنا' }
                  ]).map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        onOpenLegal(l.id);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl text-[11px] font-bold text-slate-300 hover:bg-brand-900/30 hover:text-brand-300 transition-colors text-start"
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Theme & Language — real controls (previously unused props) */}
          <div className="px-4 pb-2 space-y-2">
            <button
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 bg-slate-900/60 border border-slate-800 hover:border-brand-500/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="w-4 h-4 text-brand-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
                <span>{t('theme')}: {theme === 'dark' ? t('dark') : t('light')}</span>
              </div>
              <span className="text-[10px] text-slate-400">{currentLang === 'ar' ? 'تبديل' : 'Switch'}</span>
            </button>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-200">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>{t('language')}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { code: 'ar' as LanguageCode, label: 'AR' },
                    { code: 'en' as LanguageCode, label: 'EN' },
                    { code: 'fr' as LanguageCode, label: 'FR' },
                    { code: 'es' as LanguageCode, label: 'ES' },
                    { code: 'zh' as LanguageCode, label: '中文' }
                  ]
                ).map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => onChangeLanguage(code)}
                    className={`py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      currentLang === code
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer with Logout (or Login, for guests) */}
          <div className="p-4 border-t border-brand-500/20 bg-slate-950/80">
            {currentUser.id === 'guest' ? (
              <button
                onClick={() => {
                  onClose();
                  onOpenLogin?.();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                <span>{t('login')} / {t('register')}</span>
              </button>
            ) : showLogoutConfirm ? (
              <div className="space-y-2 animate-fadeIn">
                <p className="text-xs font-bold text-amber-300 text-center">
                  {t('confirmLogout')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onLogout}
                    className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-500 transition-all"
                  >
                    {t('logout')}
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('logout')}</span>
              </button>
            )}
            <p className="text-center text-[10px] text-slate-600 font-mono mt-3 select-none">
              build v0.0.12-fix11
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
