import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Wallet,
  ShieldCheck,
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
  Bookmark,
  Wand2,
  Palette
} from 'lucide-react';
import { User, LanguageCode, UserRole } from '../types';
import { getRemainingAiUses } from '../utils/aiQuota';
import { getTranslator } from '../data/translations';
import { isEligibleForMonetization } from '../utils/creatorEligibility';

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
  /** هل يستوفي المستخدم شروط احتساب أرباح المحتوى؟ يحدّد أي وسم يظهر —
   *  "قارئ مسجل" افتراضياً حتى لو اختار دور الكتابة، أو "كاتب شريك ومعتمد"
   *  تلقائياً بمجرد تحقق كل الشروط — بدل وسم ثابت يعتمد فقط على الدور
   *  المُختار عند التسجيل. */
  isMonetizationEligible?: boolean;
  /** وسم الحالة الجاهز — محسوب مرة واحدة في App.tsx بنفس المصدر المستخدم
   *  في الملف الشخصي، حتى لا يظهر الحساب بلقبين مختلفين في صفحتين. إن لم
   *  يُمرَّر، يُحسب محلياً كاحتياط. */
  memberStatusLabel?: string;
  /** شخصية التنقل المُشتقة من النشاط الفعلي (وليس الدور المُسجَّل فقط) —
   *  نفس القيمة المستخدمة في شريط التنقل السفلي، لضمان اتساق القوائم
   *  المعروضة هنا مع الواجهة الفعلية بدل تناقضهما. */
  navPersona?: UserRole;
  /** يفتح محرر مقال جديد مباشرة — نقطة دخول موحّدة للكتابة لأي حساب
   *  مسجَّل، بغضّ النظر عن الدور المسجَّل أو شخصية التنقل الحالية. */
  onStartWriting?: () => void;
  /** يفتح استوديو توليد الصور بالذكاء الاصطناعي */
  onOpenImageStudio?: () => void;
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
  onStartWriting,
  onOpenImageStudio,
  isMonetizationEligible = false,
  memberStatusLabel
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const quotaStats = getRemainingAiUses(currentUser.aiQuota);
  // احتياط: إن لم يُمرَّر navPersona من الأعلى، اعتمد على الدور المُسجَّل
  // مباشرة بدل تعطّل القائمة بأكملها.
  const persona: UserRole = navPersona || currentUser.role;
  const t = getTranslator(currentLang);

  if (!isOpen) return null;

  // وسم واحد فقط يُحسب من حالة الأهلية الفعلية للربح، لا من الدور
  // المُختار عند التسجيل وحده — كاتب/قارئ جديد يبقى "قارئ مسجل" حتى يحقق
  // كل شروط الأهلية، فيتحول تلقائياً إلى "كاتب شريك ومعتمد".
  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return '👑 مالك المنصة (Admin)';
      case 'advertiser':
        return '📢 معلن وشريك أعمال';
      case 'writer':
      case 'reader':
      default:
        return isMonetizationEligible ? '✍️ كاتب شريك ومعتمد' : '📖 قارئ مسجل';
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
                  {memberStatusLabel || getRoleLabel(currentUser.role)}
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
            {/* بطاقة "أنت تتصفح حالياً" للزائر فقط — لغير المسجَّل دخوله لا
                يوجد أي وسم آخر معروض له في أي مكان بالقائمة. للمستخدم
                المسجَّل، وسم حالته معروض مرة واحدة فقط أعلى القائمة بجانب
                اسمه؛ تكراره هنا كان هو الخلل الذي طُلب إصلاحه. */}
            {currentUser.id === 'guest' && (
              <div className="p-3.5 rounded-2xl bg-brand-950/40 border border-brand-500/25">
                <span className="block text-[11px] font-bold text-brand-200 mb-1">
                  أنت تتصفح حالياً:
                </span>
                <div className="text-sm font-extrabold text-white">
                  زائر (بدون تسجيل دخول)
                </div>
              </div>
            )}

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

            {/* لوحة تحكم الأدمن: لم يعد هناك مكوّن AdminDashboard منفصل أصلاً —
                حُذف نهائياً، ونُقل محتوى تبويباته إلى قسم "أقسام الإدارة"
                داخل الملف الشخصي (UserProfileView) مباشرة، مجمَّعة حسب
                الاختصاص. الوصول الآن عبر تبويب "ملفي" في الشريط السفلي (أو
                أزرار المالية/الإعلانات/المستخدمين المختصرة بجانبه)، وشريط
                تبويبات داخلي هناك يفتح كل قسم — لا رابط اختصار مكرر هنا. */}

            {/* Role-Specific Direct Navigation Links — أُزيلت كتلتا writer
                وadvertiser بالكامل: "استوديو الكاتب" و"مقالاتي" كانتا تكرران
                تماماً زري "لوحة الكاتب"/"مقالاتي" في الشريط السفلي (نفس
                activeTab النهائي)، و"لوحة الحملات الإعلانية" كانت تكرر زر
                "حملاتي" في الشريط السفلي، و"شحن الرصيد والفوترة" كانت تكرر
                زر "المحفظة والأرباح" العام أدناه بالضبط (كلاهما onOpenWallet).
                لم يبق شيء غير مكرر يستحق قسماً خاصاً هنا لأي دور. */}
            <div className="space-y-1">
              {/* استكشاف: مخفي عن الأدمن (له مركز قيادة كامل) وعن القارئ
                  تحديداً (له زر "استكشاف" مباشر في الشريط السفلي أصلاً —
                  نفس الوجهة بالضبط، فتكراره هنا لا معنى له). يبقى ظاهراً
                  للكاتب والمعلن لأن شريطهما السفلي لا يضم زر استكشاف. */}
              {persona !== 'admin' && persona !== 'reader' && (
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
              )}

              {/* إنشاء إعلان: متاح لأي حساب مسجَّل غير الزائر وغير الأدمن، ما
                  عدا من لديه أصلاً زر حملات مخصص في الشريط السفلي (شخصية
                  "معلن") تفادياً للتكرار. */}
              {currentUser.id !== 'guest' && persona !== 'advertiser' && persona !== 'admin' && (
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

              {/* المحفوظات: مخفية عن الأدمن وعن القارئ تحديداً — صفحة "ملفي"
                  للقارئ تعرض تبويب "المقالات المحفوظة" افتراضياً من أول
                  فتحة أصلاً (نفس الوجهة تماماً التي يصل إليها زر "ملفي" في
                  الشريط السفلي)، فتكرار مدخل مستقل لها هنا زائد عن الحاجة.
                  تبقى ظاهرة للكاتب والمعلن لأن ملفهما الشخصي لا يضم تبويب
                  محفوظات مكافئاً. */}
              {persona !== 'admin' && persona !== 'reader' && (
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
              )}

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

              {/* المستخدمين وKYC — انتقل هذا المدخل إلى هنا من الشريط السفلي
                  (الذي أصبح يضم زر الرسائل بدلاً منه ليطابق بقية الأدوار)،
                  فيبقى للأدمن نفس الوصول لإدارة المستخدمين، فقط من هنا. */}
              {currentUser.id !== 'guest' && persona === 'admin' && (
                <button
                  onClick={() => {
                    onNavigateTab?.('admin_users');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-200 hover:bg-brand-900/30 hover:text-brand-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-4 h-4 text-blue-400" />
                    <span>إدارة المستخدمين</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400 rtl:rotate-0 ltr:rotate-180" />
                </button>
              )}

              {currentUser.id !== 'guest' && persona !== 'admin' && (
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

              {/* استوديو توليد الصور الذكية */}
              <button
                onClick={() => {
                  if (onOpenImageStudio) onOpenImageStudio();
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-slate-100 bg-gradient-to-r from-brand-950/60 via-slate-900 to-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-md hover:shadow-cyan-500/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white">
                    <Wand2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-start">
                    <div className="flex items-center gap-1.5">
                      <span>استوديو توليد الصور (Gemini)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-black border border-cyan-500/40">
                        AI
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal">أغلفة مقالات ولوحات فنية ذكية</p>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-cyan-400 rtl:rotate-0 ltr:rotate-180" />
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
