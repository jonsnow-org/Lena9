import React, { useState } from 'react';
import { X, Rocket, Clock, MousePointerClick, AlertCircle, Loader2, CheckCircle2, Wallet } from 'lucide-react';
import { Article, User, PromotionPricingModel } from '../types';
import { requestArticlePromotion } from '../services/firestoreService';

interface PromoteArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
  currentUser: User;
}

/**
 * جدول أسعار الترويج الداخلي.
 * الكاتب يدفع من رصيد أرباحه داخل المنصة (وليس دفعاً خارجياً).
 * ⚠️ لا يتم أي خصم هنا — قواعد أمان Firestore تمنع تعديل الأرصدة من
 * المتصفح. الخصم يتم يدوياً من لوحة الإدارة عند اعتماد الطلب.
 */
const DURATION_OPTIONS: { hours: number; label: string; fixedCost: number }[] = [
  { hours: 24, label: '24 ساعة', fixedCost: 5 },
  { hours: 48, label: '48 ساعة', fixedCost: 9 },
  { hours: 72, label: '72 ساعة', fixedCost: 12 },
  { hours: 168, label: 'أسبوع كامل', fixedCost: 25 }
];

// تسعير النقرة الواحدة في نموذج CPC
const CPC_RATE = 0.15;
const CPC_MIN_BUDGET = 5;

export const PromoteArticleModal: React.FC<PromoteArticleModalProps> = ({
  isOpen,
  onClose,
  article,
  currentUser
}) => {
  const [durationHours, setDurationHours] = useState(48);
  const [pricingModel, setPricingModel] = useState<PromotionPricingModel>('fixed');
  const [cpcBudget, setCpcBudget] = useState(CPC_MIN_BUDGET);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen || !article) return null;

  const selectedDuration = DURATION_OPTIONS.find((d) => d.hours === durationHours) || DURATION_OPTIONS[1];
  const cost = pricingModel === 'fixed' ? selectedDuration.fixedCost : cpcBudget;

  // الرصيد المتاح للكاتب — يُقرأ من بيانات المستخدم الفعلية.
  // إن لم يكن هناك رصيد، يُعرض صفر ولا يُخترع أي رقم.
  const availableBalance = (currentUser as any).walletBalance ?? 0;
  const hasEnoughBalance = availableBalance >= cost;

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await requestArticlePromotion({
        articleId: article.id,
        articleTitle: article.title,
        writerId: currentUser.id,
        writerName: currentUser.fullName,
        durationHours,
        pricingModel,
        cost
      });
      setIsDone(true);
    } catch (err: any) {
      console.error('Promotion request failed:', err);
      const code = err?.code || '';
      if (code === 'permission-denied') {
        setError('لا تملك صلاحية إرسال هذا الطلب. تأكد من أنك مسجّل الدخول كصاحب المقال.');
      } else {
        setError('تعذر إرسال طلب الترويج. تحقق من اتصالك ثم حاول مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsDone(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-android-in">
        {/* الرأس */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">ترويج المقال</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                اعرض مقالك في مكان بارز بالصفحة الرئيسية
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="إغلاق"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {isDone ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-slate-900 dark:text-white">تم إرسال طلبك</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                طلب الترويج الآن بانتظار مراجعة إدارة المنصة. ستظهر حالته في صفحة مقالاتك،
                ولن يُخصم أي مبلغ قبل الاعتماد.
              </p>
              <button
                onClick={handleClose}
                className="mt-2 px-6 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <>
              {/* المقال المستهدف */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 mb-1">المقال المُروَّج</div>
                <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">
                  {article.title}
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* نموذج التسعير */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  نموذج التسعير:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPricingModel('fixed')}
                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                      pricingModel === 'fixed'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span className="font-black text-xs">مبلغ ثابت لمدة</span>
                    <span className="text-[10px] font-normal opacity-80">ظهور مضمون طوال المدة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingModel('cpc')}
                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                      pricingModel === 'cpc'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <MousePointerClick className="w-4 h-4" />
                    <span className="font-black text-xs">حسب النقرات</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {CPC_RATE.toFixed(2)}$ لكل نقرة صالحة
                    </span>
                  </button>
                </div>
              </div>

              {/* المدة أو الميزانية */}
              {pricingModel === 'fixed' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مدة الترويج:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.hours}
                        type="button"
                        onClick={() => setDurationHours(opt.hours)}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          durationHours === opt.hours
                            ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-2 ring-brand-500/20'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="font-black text-xs">{opt.label}</div>
                        <div className="text-[11px] font-bold mt-0.5">{opt.fixedCost.toFixed(2)}$</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    ميزانية النقرات (بالدولار):
                  </label>
                  <input
                    type="number"
                    min={CPC_MIN_BUDGET}
                    step={1}
                    value={cpcBudget}
                    onChange={(e) => setCpcBudget(Math.max(CPC_MIN_BUDGET, Number(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-hidden focus:border-brand-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تكفي لحوالي {Math.floor(cpcBudget / CPC_RATE)} نقرة صالحة.
                    النقرات المرفوضة كاحتيال لا تُحتسب ولا تُخصم منك.
                  </p>
                </div>
              )}

              {/* الرصيد والتكلفة */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Wallet className="w-3.5 h-3.5" />
                    رصيدك المتاح
                  </span>
                  <span className="font-black text-slate-900 dark:text-white font-mono">
                    ${availableBalance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">تكلفة الترويج</span>
                  <span className="font-black text-amber-600 dark:text-amber-400 font-mono">
                    ${cost.toFixed(2)}
                  </span>
                </div>
              </div>

              {!hasEnoughBalance && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    رصيدك الحالي أقل من تكلفة الترويج. يمكنك إرسال الطلب الآن، وسيراجعه فريق
                    المنصة ولن يُعتمد قبل توفر الرصيد.
                  </span>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                تتم مراجعة طلبات الترويج يدوياً من إدارة المنصة خلال 24 إلى 48 ساعة.
                لا يُخصم أي مبلغ من رصيدك قبل اعتماد الطلب.
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ الإرسال…</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span>إرسال طلب الترويج</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
