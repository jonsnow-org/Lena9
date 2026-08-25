import React, {useEffect, useState} from 'react';
import {AlertCircle, CheckCircle2, KeyRound, Loader2, X} from 'lucide-react';
import {confirmNewPassword, getAuthErrorMessage, verifyResetCode} from '../firebase';

interface ResetPasswordModalProps {
  oobCode: string;
  onClose: () => void;
  /** يُستدعى بعد نجاح تعيين كلمة المرور — لفتح نافذة تسجيل الدخول مباشرة. */
  onSuccess: () => void;
}

// تُفتَح تلقائياً عند وصول المستخدم للتطبيق عبر رابط إعادة تعيين كلمة
// المرور الذي أرسله Firebase (mode=resetPassword&oobCode=...، انظر
// getPasswordResetCodeFromUrl في firebase.ts). مستقلة عن AuthModal لأن
// سياقها مختلف تماماً: المستخدم قادم من بريده الإلكتروني، لا من داخل
// التطبيق نفسه.
export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({oobCode, onClose, onSuccess}) => {
  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    verifyResetCode(oobCode)
      .then((verifiedEmail) => {
        if (!cancelled) setEmail(verifiedEmail);
      })
      .catch((err) => {
        if (!cancelled) setLinkError(getAuthErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (newPassword.length < 6) {
      setSubmitError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSubmitError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmNewPassword(oobCode, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">تعيين كلمة مرور جديدة</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {verifying && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500 dark:text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جارٍ التحقق من الرابط...</span>
            </div>
          )}

          {!verifying && linkError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{linkError}</span>
            </div>
          )}

          {!verifying && !linkError && success && (
            <div className="text-center space-y-3 py-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                تم تعيين كلمة المرور الجديدة بنجاح.
              </p>
              <button
                type="button"
                onClick={onSuccess}
                className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs sm:text-sm transition-colors"
              >
                تسجيل الدخول الآن
              </button>
            </div>
          )}

          {!verifying && !linkError && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {email && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  إعادة تعيين كلمة المرور لحساب: <span className="font-bold text-slate-800 dark:text-slate-200">{email}</span>
                </p>
              )}

              {submitError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl text-white font-extrabold text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 bg-teal-600 hover:bg-teal-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>تعيين كلمة المرور</span>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
