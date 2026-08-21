import React, { useState, useEffect } from 'react';
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
  // "submitted" هنا يعني فقط أن الطلب أُرسل وينتظر مراجعة — وليس أنه
  // تحقّق فعلياً. كان الكود سابقاً يعتبر submitted=true تعني "تحقق"
  // بالخطأ، ويمنح توثيقاً وهمياً فورياً بلا أي مراجعة حقيقية من الأدمن.
  const [submitted, setSubmitted] = useState(
    currentKyc?.status === 'verified' || currentKyc?.status === 'pending'
  );
  const [isLoading, setIsLoading] = useState(false);

  // النافذة قد تبقى مركّبة بين مرة فتح وأخرى، و"submitted" كان يُحسب مرة
  // واحدة فقط عند أول تركيب. لو رفض الأدمن الطلب لاحقاً (status يتحوّل
  // إلى 'rejected') بقي المستخدم عالقاً يرى شاشة "قيد المراجعة" للأبد
  // دون أي طريق لمعرفة الرفض أو إعادة الإرسال. الآن يُعاد حساب الحالة عند
  // كل تغيّر فعلي في currentKyc.
  useEffect(() => {
    setSubmitted(currentKyc?.status === 'verified' || currentKyc?.status === 'pending');
  }, [currentKyc?.status]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idNumber.trim()) return;

    setIsLoading(true);
    // لا محاكاة نجاح فورية هنا — الحالة الحقيقية "pending" تُحفظ فعلياً
    // في Firestore عبر onSaveKyc (App.tsx)، ولا يتحقق الحساب فعلياً إلا
    // بعد اعتماد يدوي حقيقي من الأدمن. لا يوجد رفع صورة فعلي (لا يوجد
    // Firebase Storage بالخطة المجانية)، فلا نرسل أي رابط صورة وهمي.
    onSaveKyc({
      idType,
      idNumber,
      status: 'pending',
      submittedAt: new Date().toISOString()
    });
    setIsLoading(false);
    setSubmitted(true);
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
            currentKyc?.status === 'verified' ? (
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
              // الحالة الحقيقية بعد الإرسال: "قيد المراجعة" فقط — لا يوجد
              // أي تحقق فوري تلقائي؛ هذا كان يُعرض خطأً سابقاً كـ"معتمد".
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto ring-8 ring-amber-500/5">
                  <Clock className="w-10 h-10" />
                </div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  تم إرسال طلب التوثيق — قيد المراجعة
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  استلمنا بيانات وثيقتك ({idType}: {idNumber}) وسيراجعها فريق ليتيريوم يدوياً خلال 24 إلى 48 ساعة.
                  سيصلك إشعار فور اعتماد حسابك.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm"
                >
                  حسناً، فهمت
                </button>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {currentKyc?.status === 'rejected' && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    تم رفض طلب التوثيق السابق. راجع بياناتك وأرسل طلباً جديداً بمعلومات صحيحة ودقيقة.
                  </p>
                </div>
              )}
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

              {/* رفع صور الوثائق مباشرة من هذه النافذة غير متاح حالياً (يتطلب
                  خدمة تخزين ملفات لا تتوفر في خطة المشروع المجانية) — بدل
                  عرض منطقة "انقر للرفع" لا تستجيب فعلياً لأي نقرة، نوضح
                  بصراحة المسار الحقيقي البديل. */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                <Camera className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  لا حاجة لرفع صورة الوثيقة هنا. إن احتاج فريق المراجعة لصورة الوثيقة أو صورة شخصية
                  للتأكد من مطابقتها، سيتواصل معك عبر البريد الإلكتروني المسجَّل بحسابك لإرسالها بأمان.
                </p>
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
