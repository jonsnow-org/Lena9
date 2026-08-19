import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Upload,
  CheckCircle2,
  FileCheck,
  Camera,
  AlertCircle,
  Clock,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { KycDetails } from '../types';

interface KycModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKyc?: KycDetails;
  onSaveKyc: (kyc: KycDetails) => void;
  userRole: 'writer' | 'advertiser' | 'reader';
}

export const KycModal: React.FC<KycModalProps> = ({
  isOpen,
  onClose,
  currentKyc,
  onSaveKyc,
  userRole
}) => {
  const [idType, setIdType] = useState(currentKyc?.idType || 'بطاقة الهوية الوطنية');
  const [idNumber, setIdNumber] = useState(currentKyc?.idNumber || '');
  const [submitted, setSubmitted] = useState(currentKyc?.status === 'verified');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idNumber.trim()) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
      onSaveKyc({
        idType,
        idNumber,
        selfieUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
        status: 'verified',
        submittedAt: new Date().toLocaleDateString('ar-EG')
      });
      try {
        confetti({ particleCount: 70, spread: 60 });
      } catch {}
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
              التحقق من الهوية (KYC)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                حسابك موثق ومعتمد بنجاح ✓
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                تمت مراجعة الوثيقة الرسمية ({idType}: {idNumber}) واعتماد حسابك كـ{' '}
                {userRole === 'writer' ? 'كاتب موثوق' : 'معلن معتمد'}. يمكنك الآن سحب وإيداع الأرباح بحرية كاملة.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm"
              >
                إتمام والعودة للتطبيق
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2">
                <Lock className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  تعتمد منصة ليتيريوم معايير الأمان المالي العالمية للتحقق من هوية صناع المحتوى والمعلنين لمنع الاحتيال وضمان استلام المدفوعات.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  نوع الوثيقة الرسمية
                </label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-hidden focus:border-teal-500"
                >
                  <option value="بطاقة الهوية الوطنية">بطاقة الهوية الوطنية</option>
                  <option value="جواز سفر رسمي">جواز سفر رسمي معتمد</option>
                  <option value="رخصة قيادة سارية">رخصة قيادة سارية</option>
                  <option value="سجل تجاري للشركات">سجل تجاري معتمد (للمعلنين)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  رقم الوثيقة / الهوية
                </label>
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="مثال: SA1092841..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-hidden focus:border-teal-500"
                />
              </div>

              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  صورة الوثيقة وصورة شخصية (Selfie)
                </label>
                <div className="p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:border-teal-500 transition-colors">
                  <Camera className="w-8 h-8 text-teal-600 mx-auto mb-1" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    انقر لرفع صورة الوثيقة أو التقاط سيلفي
                  </span>
                  <span className="text-[10px] text-slate-400">
                    JPG, PNG, PDF بحد أقصى 10 ميغابايت
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !idNumber.trim()}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? 'جاري التحقق والمصادقة...' : 'إرسال طلب التوثيق (KYC)'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
