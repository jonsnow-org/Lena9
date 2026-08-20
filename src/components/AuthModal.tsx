import React, { useEffect, useState } from 'react';
import {
  LogIn,
  UserPlus,
  X,
  BookOpen,
  PenTool,
  Megaphone,
  ArrowRight,
  Building,
  AlertCircle,
  Loader2,
  Trash2,
  UserCog
} from 'lucide-react';
import { UserRole } from '../types';
import { registerWithEmail, loginWithEmail, getAuthErrorMessage } from '../firebase';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { getSavedAccounts, forgetAccount, SavedAccount } from '../utils/savedAccounts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Only TRIGGERS the Google sign-in flow. App.tsx's onAuthStateChanged
  // listener is what actually updates app state once Firebase confirms it.
  onGoogleSignIn: (role: UserRole) => void | Promise<void>;
  // Surfaces errors that happen after this modal already triggered a Google
  // sign-in and closed itself (e.g. popup closed by the user on desktop).
  externalError?: string | null;
  initialRole?: UserRole;
  initialMode?: 'login' | 'register';
}

const WRITER_SPECIALTY_PRESETS = [
  'الأدب والشعر',
  'الفلسفة والفكر',
  'الرواية والقصة',
  'النقد والدراسات',
  'التاريخ والحضارات',
  'التكنولوجيا والذكاء الاصطناعي',
  'علم الاجتماع'
];

const WRITER_AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
];

// NOTE: 'admin' is intentionally NOT a selectable role here. Admin accounts
// must never be self-registered through a public form — they should be
// granted manually in Firestore (or via a separate internal tool) by an
// existing admin. This was previously a critical security hole.
const SELECTABLE_ROLES: { role: UserRole; label: string; subLabel: string; icon: React.ReactNode; accent: string }[] = [
  { role: 'reader', label: 'قارئ ومُعلن', subLabel: 'قراءة حرة + إنشاء إعلانات وترويج', icon: <BookOpen className="w-4 h-4" />, accent: 'purple' },
  { role: 'writer', label: 'كاتب ومؤلف', subLabel: `نشر مقالات وجني أرباح ${REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}-${REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%`, icon: <PenTool className="w-4 h-4" />, accent: 'teal' }
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn,
  externalError,
  initialRole = 'reader',
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [role, setRole] = useState<UserRole>(initialRole === 'admin' ? 'reader' : initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Common Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Role-Specific: Writer Fields
  const [penName, setPenName] = useState('');
  const [writerBio, setWriterBio] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(['الأدب والشعر']);
  const [selectedAvatar, setSelectedAvatar] = useState(WRITER_AVATAR_PRESETS[0]);

  // Role-Specific: Advertiser Fields
  const [companyName, setCompanyName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('حلول رقمية وبرمجيات');
  const [companyWebsite, setCompanyWebsite] = useState('');

  // الحسابات المحفوظة على هذا الجهاز + هل يعرض المستخدم نموذج حساب جديد فارغ
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [useNewAccountForm, setUseNewAccountForm] = useState(false);

  useEffect(() => {
    if (initialRole) setRole(initialRole === 'admin' ? 'reader' : initialRole);
    if (initialMode) setMode(initialMode);
    setAuthError(null);
    setIsLoading(false);

    // إفراغ الحقول في كل مرة تُفتح فيها النافذة.
    // بدون هذا، تبقى بيانات آخر محاولة دخول عالقة في الحقول لأن المكوّن
    // لا يُفكّ تركيبه عند الإغلاق — وهو سبب عدم وجود "حقول فارغة" للدخول
    // بحساب مختلف.
    if (isOpen) {
      setEmail('');
      setPassword('');
      setFullName('');
      setPenName('');
      setWriterBio('');
      setCompanyName('');
      setCompanyWebsite('');

      const accounts = getSavedAccounts();
      setSavedAccounts(accounts);
      // إن لم يوجد أي حساب محفوظ، اعرض النموذج الفارغ مباشرة
      setUseNewAccountForm(accounts.length === 0);
    }
  }, [initialRole, initialMode, isOpen]);

  if (!isOpen) return null;

  const toggleSpecialty = (spec: string) => {
    if (selectedSpecialties.includes(spec)) {
      if (selectedSpecialties.length > 1) {
        setSelectedSpecialties(selectedSpecialties.filter((s) => s !== spec));
      }
    } else {
      setSelectedSpecialties([...selectedSpecialties, spec]);
    }
  };

  // Google sign-in removed (see note above the old button location).

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email || !password) {
      setAuthError('البريد الإلكتروني وكلمة المرور مطلوبان.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const user = await loginWithEmail(email, password);
        if (!user) {
          setAuthError('تعذر العثور على بيانات حسابك. حاول مرة أخرى أو تواصل مع الدعم.');
          setIsLoading(false);
          return;
        }
      } else {
        const finalName =
          role === 'writer'
            ? penName || fullName || 'كاتب ليتيريوم'
            : role === 'advertiser'
            ? companyName || fullName || 'مؤسسة معلنة'
            : fullName || email.split('@')[0];

        await registerWithEmail(email, password, role, {
          fullName: finalName,
          penName: role === 'writer' ? penName || finalName : undefined,
          companyName: role === 'advertiser' ? companyName || finalName : undefined,
          companyIndustry: role === 'advertiser' ? companyIndustry : undefined,
          companyWebsite: role === 'advertiser' ? companyWebsite : undefined,
          specialties: role === 'writer' ? selectedSpecialties : undefined,
          avatarUrl: role === 'writer' ? selectedAvatar : undefined,
          bio:
            role === 'writer'
              ? writerBio || 'مؤلف وباحث شغوف بالكتابة ونشر الوعي الثقافي والأدبي.'
              : role === 'advertiser'
              ? 'شركة رائدة في تقديم الحلول والخدمات الرقمية للمجتمع.'
              : 'عضو نشط في مجتمع ليتيريوم للقراءة والثقافة.'
        });
      }
      // Success: the onAuthStateChanged listener in App.tsx takes it from here
      // (creates/loads the profile, navigates, closes this modal via isAuthOpen).
      onClose();
    } catch (err: any) {
      console.error('Email auth failed:', err);
      setAuthError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const accentClasses: Record<string, { border: string; bg: string; text: string; ring: string }> = {
    purple: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', ring: 'ring-purple-500/20' },
    teal: { border: 'border-teal-500', bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', ring: 'ring-teal-500/20' },
    cyan: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', ring: 'ring-cyan-500/20' }
  };

  const submitButtonColor =
    role === 'writer' ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20' :
    role === 'advertiser' ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/20' :
    'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header with Mode Switcher */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {mode === 'login' ? 'تسجيل الدخول إلى ليتيريوم' : 'إنشاء حساب جديد'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {mode === 'login' ? 'مرحباً بعودتك إلى فضاء الأدب والفكر' : 'اختر دورك للاستفادة من مميزات المنصة'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {(authError || externalError) && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError || externalError}</span>
            </div>
          )}

          {/* Google Sign-In removed: this deployment runs under an AI Studio
              preview domain that doesn't reliably complete the OAuth
              handshake with Firebase's authDomain on mobile browsers
              (third-party storage restrictions). Email/password is the only
              supported sign-in method to avoid silent failures. */}

          {/* اختيار حساب محفوظ على هذا الجهاز، أو الدخول بحساب مختلف.
              لا تُحفظ كلمات المرور إطلاقاً — البطاقة تعبّئ البريد فقط. */}
          {mode === 'login' && savedAccounts.length > 0 && !useNewAccountForm && (
            <div className="space-y-2.5">
              {/* زر واضح وثابت أعلى القائمة للدخول بحساب مختلف تماماً — حتى لا
                  يشعر المستخدم أنه "عالق" مع الحسابات المعروضة فقط. */}
              <button
                type="button"
                onClick={() => {
                  setEmail('');
                  setPassword('');
                  setAuthError(null);
                  setUseNewAccountForm(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
              >
                <UserCog className="w-4 h-4" />
                <span>تسجيل الدخول بحساب آخر أو إنشاء حساب جديد</span>
              </button>

              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                أو اختر من الحسابات المحفوظة على هذا الجهاز:
              </label>

              <div className="space-y-2">
                {savedAccounts.map((acc) => (
                  <div
                    key={acc.uid}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 bg-slate-50/60 dark:bg-slate-800/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(acc.email);
                        setPassword('');
                        setUseNewAccountForm(true);
                      }}
                      className="flex items-center gap-3 flex-1 text-start min-w-0"
                    >
                      {acc.avatarUrl ? (
                        <img
                          src={acc.avatarUrl}
                          alt={acc.fullName}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-purple-600/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-sm shrink-0">
                          {(acc.fullName || acc.email)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {acc.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {acc.email}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      title="إزالة هذا الحساب من القائمة"
                      onClick={() => setSavedAccounts(forgetAccount(acc.uid))}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                لا تُحفظ كلمات المرور على الجهاز — تُطلب في كل مرة.
              </p>
            </div>
          )}

          {/* رابط الرجوع لقائمة الحسابات المحفوظة */}
          {mode === 'login' && savedAccounts.length > 0 && useNewAccountForm && (
            <button
              type="button"
              onClick={() => {
                setEmail('');
                setPassword('');
                setAuthError(null);
                setUseNewAccountForm(false);
              }}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              → العودة إلى الحسابات المحفوظة
            </button>
          )}

          {/* Role Tabs for Registration */}
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                اختر دورك في المنصة:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {SELECTABLE_ROLES.map(({ role: r, label, subLabel, icon, accent }) => {
                  const active = role === r;
                  const cls = accentClasses[accent];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 text-start ${
                        active
                          ? `${cls.border} ${cls.bg} ${cls.text} font-extrabold ring-2 ${cls.ring}`
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-xs">
                        {icon}
                        <span>{label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight">
                        {subLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Email/Password Form — يُخفى عند عرض قائمة الحسابات المحفوظة */}
          {!(mode === 'login' && savedAccounts.length > 0 && !useNewAccountForm) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && role === 'reader' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم الكامل / اسم العرض
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: سارة العتيبي"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-purple-500"
                  required
                />
              </div>
            )}

            {mode === 'register' && role === 'writer' && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
                  <PenTool className="w-4 h-4 text-teal-600" />
                  <span>بيانات الكاتب والملف الأدبي:</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم الأدبي / اسم القلم *
                  </label>
                  <input
                    type="text"
                    value={penName}
                    onChange={(e) => setPenName(e.target.value)}
                    placeholder="مثال: د. طارق المنصور"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">نبذة تعريفية قصيرة</label>
                  <textarea
                    value={writerBio}
                    onChange={(e) => setWriterBio(e.target.value)}
                    rows={2}
                    placeholder="نبذة عن مسيرتك الأدبية واهتماماتك الكتابية"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-teal-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">التخصصات (اختر واحد أو أكثر):</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WRITER_SPECIALTY_PRESETS.map((spec) => (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => toggleSpecialty(spec)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                          selectedSpecialties.includes(spec)
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">صورة الملف الأدبي:</label>
                  <div className="flex gap-2">
                    {WRITER_AVATAR_PRESETS.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setSelectedAvatar(url)}
                        className={`rounded-full overflow-hidden border-2 transition-all ${
                          selectedAvatar === url ? 'border-teal-500 ring-2 ring-teal-500/30' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="" className="w-10 h-10 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode === 'register' && role === 'advertiser' && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-800 dark:text-cyan-300">
                  <Building className="w-4 h-4 text-cyan-600" />
                  <span>بيانات الشركة:</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الشركة / العلامة التجارية *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="مثال: شركة أفق السحابية"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">مجال العمل</label>
                    <input
                      type="text"
                      value={companyIndustry}
                      onChange={(e) => setCompanyIndustry(e.target.value)}
                      placeholder="مثال: تعليم، كتب، برمجيات"
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">رابط الموقع</label>
                    <input
                      type="url"
                      value={companyWebsite}
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      placeholder="https://company.com"
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-purple-500"
                required
              />
              {mode === 'register' && (
                <p className="mt-1 text-[10px] text-slate-400">6 أحرف على الأقل</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-2xl text-white font-extrabold text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${submitButtonColor}`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? 'تسجيل الدخول'
                      : `إنشاء الحساب والبدء كـ (${role === 'writer' ? 'كاتب' : 'قارئ ومُعلن'})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          )}

          {/* Mode Switch Footer */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <span>
                ليس لديك حساب بعد؟{' '}
                <button type="button" onClick={() => setMode('register')} className="font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  إنشاء حساب جديد
                </button>
              </span>
            ) : (
              <span>
                لديك حساب بالفعل؟{' '}
                <button type="button" onClick={() => setMode('login')} className="font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  تسجيل الدخول
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
