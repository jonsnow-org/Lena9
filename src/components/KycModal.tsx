import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  X,
  Upload,
  CheckCircle2,
  Camera,
  AlertCircle,
  Clock,
  Lock
} from 'lucide-react';
import { KycDetails } from '../types';
import { submitKycDocument } from '../services/kycApi';

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
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!selected) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!selected.type.startsWith('image/')) {
      setError('يجب أن تكون الوثيقة صورة (JPG أو PNG).');
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      setError('حجم الصورة يتجاوز 8 ميغابايت.');
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idNumber.trim() || !file) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await submitKycDocument({ idType, idNumber, file });
      onSaveKyc({
        idType,
        idNumber,
        status: result.status,
        submittedAt: new Date().toISOString()
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال طلب التوثيق. حاول مجدداً.');
    } finally {
      setIsLoading(false);
    }
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
            aria-label="إغلاق"
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
              // أي تحقق فوري تلقائي إلا حين تكون الثقة الآلية مرتفعة جداً؛
              // هذا كان يُعرض خطأً سابقاً كـ"معتمد" دوماً.
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto ring-8 ring-amber-500/5">
                  <Clock className="w-10 h-10" />
                </div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  تم إرسال طلب التوثيق — قيد المراجعة
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  استلمنا وثيقتك ({idType}: {idNumber}) وسيراجعها فريق ليتيريوم يدوياً خلال 24 إلى 48 ساعة.
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
                    تم رفض طلب التوثيق السابق. راجع بياناتك وأرسل طلباً جديداً بمعلومات ووثيقة صحيحة وواضحة.
                  </p>
                </div>
              )}
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}
              <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2">
                <Lock className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  صورة وثيقتك تُرفع مباشرة إلى خوادمنا الداخلية بشكل آمن ومشفَّر، ولا يمكن لأي طرف — بما فيك أنت
                  بعد اعتمادها — عرضها مرة أخرى. تُستخدم فقط لمطابقة اسمها مع اسم حسابك آلياً، وتحسباً لأي
                  أمور قانونية مستقبلية.
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

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  صورة واضحة للوثيقة (يظهر فيها اسمك كاملاً)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {previewUrl ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-2xl overflow-hidden border-2 border-teal-500 relative group"
                  >
                    <img src={previewUrl} alt="معاينة الوثيقة" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                      تغيير الصورة
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-xs font-bold">انقر لاختيار صورة الوثيقة</span>
                    <span className="text-[10px] flex items-center gap-1">
                      <Upload className="w-3 h-3" /> JPG أو PNG، حتى 8 ميغابايت
                    </span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !idNumber.trim() || !file}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? 'جاري رفع الوثيقة والتحقق...' : 'إرسال طلب التوثيق (KYC)'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
