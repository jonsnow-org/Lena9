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
  UserCog,
  Info,
  CheckCircle2
} from 'lucide-react';
import { UserRole } from '../types';
import { registerWithEmail, loginWithEmail, resetPassword, getAuthErrorMessage } from '../firebase';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { CREATOR_ELIGIBILITY_THRESHOLDS } from '../utils/creatorEligibility';
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
  // شاشة تسجيل دخول إلزامية (تطبيق أندرويد الأصيل عند أول فتح بلا جلسة
  // محفوظة): لا مجال لإغلاقها والعودة لأي محتوى خلفها — فقط تسجيل الدخول
  // أو إنشاء حساب يُخرج المستخدم منها. إخفاء زر الإغلاق (X) وحده كافٍ هنا
  // لأن الخلفية أصلاً لا تحتوي أي معالج نقر لإغلاق النافذة.
  mandatory?: boolean;
}

const WRITER_SPECIALTY_PRESETS = [
  'الأدب والشعر',
  'الفلسفة والفكر',
  'الرواية والقصة',
  'النقد والدراسات',
  'التاريخ والحضارات',
  'التكنولوجيا والذكاء الاصطناعي',
  'علم الاجتماع',
  'طب وصحة',
  'سياسي',
  'تعليمي',
  'مكياج وموضة',
  'جمال',
  'رياضة',
  'طبخ وأكلات',
  'سفر وسياحة',
  'اقتصاد وأعمال',
  'تربية وأسرة'
];

const WRITER_AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
];

// الدور الموحد للتسجيل: كاتب ومؤلف (يتيح الكتابة، القراءة، والإعلان فور التسجيل)
const UNIFIED_REGISTER_ROLE_INFO = {
  label: 'كاتب ومؤلف',
  subLabel: `نشر مقالات وجني أرباح ${REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}-${REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% مع القراءة الحرة وإطلاق الإعلانات`,
  icon: <PenTool className="w-5 h-5 text-teal-600 dark:text-teal-400" />
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn,
  externalError,
  initialRole = 'writer',
  initialMode = 'login',
  mandatory = false
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [role, setRole] = useState<UserRole>('writer');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Common Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Profile / Writer Fields
  const [penName, setPenName] = useState('');
  const [writerBio, setWriterBio] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(['الأدب والشعر']);
  const [selectedAvatar, setSelectedAvatar] = useState(WRITER_AVATAR_PRESETS[0]);

  // الحسابات المحفوظة على هذا الجهاز + هل يعرض المستخدم نموذج حساب جديد فارغ
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [useNewAccountForm, setUseNewAccountForm] = useState(false);

  // نسيت كلمة المرور: عرض مصغّر داخل نفس النافذة بدل نافذة منفصلة —
  // يرسل رابط إعادة تعيين حقيقي عبر Firebase (نفس آلية تحقق البريد
  // المستخدمة أصلاً بالتطبيق)، وليس كوداً يُكتب يدوياً.
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    setRole('writer');
    if (initialMode) setMode(initialMode);
    setAuthError(null);
    setIsLoading(false);
    setIsForgotPassword(false);
    setResetSubmitting(false);
    setResetSent(false);
    setResetError(null);

    // إفراغ الحقول في كل مرة تُفتح فيها النافذة.
    if (isOpen) {
      setEmail('');
      setPassword('');
      setFullName('');
      setPenName('');
      setWriterBio('');

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
        const finalName = penName || fullName || 'كاتب ليتيريوم';

        await registerWithEmail(email, password, 'writer', {
          fullName: finalName,
          penName: penName || finalName,
          specialties: selectedSpecialties,
          avatarUrl: selectedAvatar,
          bio: writerBio || 'مؤلف وباحث شغوف بالكتابة ونشر الوعي الثقافي والأدبي.'
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setResetError('أدخل بريدك الإلكتروني أولاً.');
      return;
    }
    setResetError(null);
    setResetSubmitting(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setResetError(getAuthErrorMessage(err));
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header with Mode Switcher */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {mode === 'login' ? 'تسجيل الدخول إلى ليتيريوم' : 'إنشاء حساب جديد'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {mode === 'login' ? 'مرحباً بعودتك إلى فضاء الأدب والفكر' : 'انضم ككاتب ومؤلف واستمتع بكافة مميزات المنصة'}
              </p>
            </div>
          </div>
          {!mandatory && (
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {(authError || externalError) && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError || externalError}</span>
            </div>
          )}

          {/* اختيار حساب محفوظ على هذا الجهاز، أو الدخول بحساب مختلف */}
          {mode === 'login' && savedAccounts.length > 0 && !useNewAccountForm && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setEmail('');
                  setPassword('');
                  setAuthError(null);
                  setUseNewAccountForm(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
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
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 bg-slate-50/60 dark:bg-slate-800/40 transition-colors"
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
                        <div className="w-9 h-9 rounded-full bg-teal-600/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-sm shrink-0">
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
              className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
            >
              → العودة إلى الحسابات المحفوظة
            </button>
          )}

          {/* Unified Role Badge for Registration — خيار موحد يحافظ على نص كاتب ومؤلف */}
          {mode === 'register' && (
            <div className="p-3.5 rounded-2xl border border-teal-500/60 bg-teal-500/10 ring-2 ring-teal-500/20 text-start flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <PenTool className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm text-teal-900 dark:text-teal-200">
                  <span>{UNIFIED_REGISTER_ROLE_INFO.label}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-600/20 text-teal-700 dark:text-teal-300 font-bold">
                    شامل القراءة والنشر والإعلان
                  </span>
                </div>
                <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80 font-normal leading-relaxed mt-0.5">
                  {UNIFIED_REGISTER_ROLE_INFO.subLabel}
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          {!(mode === 'login' && savedAccounts.length > 0 && !useNewAccountForm) && (
          <form onSubmit={isForgotPassword ? handleForgotPasswordSubmit : handleSubmit} className="space-y-4">
            {isForgotPassword && (
              <div className="p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40 text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed">
                أدخل بريدك الإلكتروني المسجَّل، وسنرسل لك رابط إعادة تعيين كلمة المرور.
              </div>
            )}

            {resetSent ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>تم إرسال رابط إعادة التعيين إلى {email}. افتح بريدك واتبع الرابط.</span>
              </div>
            ) : (
            <>
            {resetError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {mode === 'register' && !isForgotPassword && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
                  <PenTool className="w-4 h-4 text-teal-600" />
                  <span>بيانات الكاتب والملف الأدبي:</span>
                </div>

                {/* شروط تحقيق الربح والانضمام لبرنامج شركاء المحتوى */}
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/50 border border-teal-200/60 dark:border-teal-900/40 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-teal-800 dark:text-teal-300">
                    <Info className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>شروط الانضمام لبرنامج شركاء المحتوى (احتساب الأرباح)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    الكتابة والقراءة والنشر متاحة فوراً لأي حساب مسجل دون قيد. لكن احتساب أرباح الإعلانات ومبيعات المقالات المقفلة يبدأ فقط بعد تحقيق كل الشروط التالية معاً:
                  </p>
                  <ul className="space-y-1.5">
                    {[
                      `${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_FOLLOWERS} متابع على الأقل`,
                      `${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_VALID_VIEWS.toLocaleString('ar-EG')} مشاهدة موثوقة على الأقل لمقالاتك المنشورة`,
                      `${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_ACCOUNT_AGE_DAYS} يوماً على الأقل على عمر الحساب`,
                      `${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_PUBLISHED_ARTICLES} مقالات منشورة على الأقل`,
                      'توثيق الهوية (KYC) — شرط إلزامي لسحب الأرباح'
                    ].map((cond) => (
                      <li key={cond} className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{cond}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t border-teal-200/50 dark:border-teal-900/30 space-y-1 text-[11px]">
                    <p className="font-bold text-slate-800 dark:text-slate-200">حصة الكاتب من الأرباح بعد تحقيق الأهلية:</p>
                    <p className="text-slate-600 dark:text-slate-400">• إعلانات داخل المقالات: <span className="font-bold text-teal-600 dark:text-teal-400">{REVENUE_SHARES.IN_ARTICLE_ADS.LABEL}</span></p>
                    <p className="text-slate-600 dark:text-slate-400">• إعلانات الملف الشخصي: <span className="font-bold text-teal-600 dark:text-teal-400">{REVENUE_SHARES.WRITER_PROFILE_ADS.LABEL}</span></p>
                    <p className="text-slate-600 dark:text-slate-400">• مبيعات المقالات المقفلة: <span className="font-bold text-teal-600 dark:text-teal-400">{REVENUE_SHARES.LOCKED_ARTICLES.LABEL}</span></p>
                  </div>
                </div>

                {/* توضيح بخصوص الإعلانات والترويج */}
                <div className="p-3 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/40 flex items-start gap-2.5 text-cyan-900 dark:text-cyan-200">
                  <Megaphone className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-extrabold">للراغبين بالإعلان والترويج: </span>
                    <span>الترويج والإعلان متاح لجميع الحسابات المسجلة ولا يتطلب أي اشتراك خاص، بل يحتاج فقط لفتح حساب في المنصة وإيداع الرصيد في محفظتك لإطلاق حملاتك فوراً.</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم الكامل / الاسم الأدبي *
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
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">التخصصات والاهتمامات (اختر واحد أو أكثر):</label>
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
                  <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    يمكن تغييرها لاحقاً من إعدادات الملف الشخصي.
                  </p>
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
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500"
                required
              />
            </div>

            {!isForgotPassword && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500"
                required
              />
              {mode === 'register' && (
                <p className="mt-1 text-[10px] text-slate-400">6 أحرف على الأقل</p>
              )}
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setResetError(null);
                    setIsForgotPassword(true);
                  }}
                  className="mt-1.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              )}
            </div>
            )}

            <button
              type="submit"
              disabled={isForgotPassword ? resetSubmitting : isLoading}
              className="w-full py-3.5 rounded-2xl text-white font-extrabold text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 bg-teal-600 hover:bg-teal-700 shadow-teal-500/20"
            >
              {(isForgotPassword ? resetSubmitting : isLoading) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isForgotPassword ? (
                <span>إرسال رابط إعادة التعيين</span>
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? 'تسجيل الدخول'
                      : 'إنشاء الحساب والبدء (كاتب ومؤلف)'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            </>
            )}

            {isForgotPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetSent(false);
                  setResetError(null);
                }}
                className="w-full text-center text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
              >
                → العودة لتسجيل الدخول
              </button>
            )}
          </form>
          )}

          {/* Mode Switch Footer */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <span>
                ليس لديك حساب بعد؟{' '}
                <button type="button" onClick={() => setMode('register')} className="font-bold text-teal-600 dark:text-teal-400 hover:underline">
                  إنشاء حساب جديد
                </button>
              </span>
            ) : (
              <span>
                لديك حساب بالفعل؟{' '}
                <button type="button" onClick={() => setMode('login')} className="font-bold text-teal-600 dark:text-teal-400 hover:underline">
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
