import React, { useState } from 'react';
import {
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Info
} from 'lucide-react';
import { User } from '../types';
import { createDepositRequest, createPayoutRequest } from '../services/firestoreService';
import { MIN_PAYOUT_USD, MIN_DEPOSIT_USD } from '../constants/payoutRules';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

interface MoneyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'deposit' | 'payout';
  currentUser: User;
  /** طلبات المستخدم السابقة لعرض حالتها */
  requests?: any[];
}

const MIN_PAYOUT = MIN_PAYOUT_USD;
const MIN_DEPOSIT = MIN_DEPOSIT_USD;

const DEPOSIT_METHODS = [
  { id: 'bank_wire', label: 'تحويل بنكي (IBAN)' },
  { id: 'usdt_crypto', label: 'عملة رقمية (USDT)' },
  { id: 'paypal', label: 'باي بال (PayPal)' },
  { id: 'payoneer', label: 'بايونير (Payoneer)' }
];

const PAYOUT_METHODS = [
  { id: 'usdt_crypto', label: 'عملة رقمية (USDT TRC20/BEP20)' },
  { id: 'bank_wire', label: 'تحويل بنكي محلي/دولي (IBAN)' },
  { id: 'paypal', label: 'حساب باي بال (PayPal)' },
  { id: 'payoneer', label: 'حساب بايونير (Payoneer)' }
];

export const MoneyRequestModal: React.FC<MoneyRequestModalProps> = ({
  isOpen,
  onClose,
  mode,
  currentUser,
  requests = []
}) => {
  const isDeposit = mode === 'deposit';
  const methods = isDeposit ? DEPOSIT_METHODS : PAYOUT_METHODS;

  const [amount, setAmount] = useState(isDeposit ? MIN_DEPOSIT : MIN_PAYOUT);
  const [method, setMethod] = useState(methods[0].id);
  const [reference, setReference] = useState('');
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const handleClose = () => {
    setIsDone(false);
    setError(null);
    onClose();
  };
  useEscapeToClose(handleClose, isOpen);

  if (!isOpen) return null;

  const availableBalance = (currentUser as any).availableBalance ?? 0;
  const pendingEarnings = (currentUser as any).pendingEarnings ?? 0;
  const walletBalance = (currentUser as any).walletBalance ?? 0;

  const minAmount = isDeposit ? MIN_DEPOSIT : MIN_PAYOUT;
  const canSubmit =
    amount >= minAmount && (isDeposit || amount <= availableBalance) && !isSubmitting;

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isDeposit) {
        await createDepositRequest({
          userId: currentUser.id,
          amount,
          method,
          reference: reference || undefined
        });
      } else {
        await createPayoutRequest({
          userId: currentUser.id,
          amount,
          method,
          destination: destination || undefined
        });
      }
      setIsDone(true);
    } catch (err: any) {
      console.error('Money request failed:', err);
      if (err?.code === 'permission-denied') {
        setError('لا تملك صلاحية إرسال هذا الطلب. تأكد من تسجيل دخولك ثم حاول مجدداً.');
      } else {
        setError('تعذر إرسال الطلب. تحقق من اتصالك ثم حاول مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const myRequests = requests.filter((r) => r.userId === currentUser.id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-android-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                isDeposit
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
              }`}
            >
              {isDeposit ? (
                <ArrowDownToLine className="w-4 h-4" />
              ) : (
                <ArrowUpFromLine className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {isDeposit ? 'شحن المحفظة' : 'سحب الأرباح'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isDeposit ? 'إيداع رصيد لتمويل حملاتك الإعلانية' : 'طلب تحويل أرباحك المتاحة'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="إغلاق"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                {isDeposit
                  ? 'سيُضاف الرصيد إلى محفظتك بعد تأكيد وصول المبلغ من إدارة المنصة.'
                  : 'سيُحوَّل المبلغ بعد مراجعة الطلب واعتماده من إدارة المنصة.'}
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
              {/* ملخص الأرصدة */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                {isDeposit ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">رصيد المحفظة الحالي</span>
                    <span className="font-black text-slate-900 dark:text-white font-mono">
                      ${walletBalance.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        الأرباح المتاحة للسحب
                      </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        ${availableBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        أرباح مجمّدة (30 يوماً)
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                        ${pendingEarnings.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* المبلغ */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  المبلغ بالدولار (الحد الأدنى ${minAmount}):
                </label>
                <input
                  type="number"
                  min={minAmount}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-hidden focus:border-brand-500"
                />
                {!isDeposit && amount > availableBalance && (
                  <p className="text-[11px] text-rose-500 font-bold">
                    المبلغ يتجاوز رصيدك المتاح للسحب.
                  </p>
                )}
              </div>

              {/* الطريقة */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isDeposit ? 'طريقة التحويل:' : 'طريقة الاستلام:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={`p-2.5 rounded-2xl border text-xs font-bold transition-all ${
                        method === m.id
                          ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* المرجع أو الوجهة */}
              {isDeposit ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    رقم العملية أو مرجع التحويل:
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="أدخل رقم العملية بعد إتمام التحويل"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-hidden focus:border-brand-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    بيانات الاستلام:
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="رقم الحساب أو عنوان المحفظة"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-hidden focus:border-brand-500"
                  />
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  تتم مراجعة طلبات الإيداع والسحب يدوياً من إدارة المنصة خلال 24 إلى 48 ساعة.
                  {isDeposit
                    ? ' لن يُضاف الرصيد قبل تأكيد وصول المبلغ فعلياً.'
                    : ' تبقى الأرباح مجمّدة 30 يوماً من تاريخ تسجيلها قبل أن تصبح قابلة للسحب.'}
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-extrabold text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50 ${
                  isDeposit
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ الإرسال…</span>
                  </>
                ) : (
                  <span>{isDeposit ? 'إرسال طلب الإيداع' : 'إرسال طلب السحب'}</span>
                )}
              </button>

              {/* طلبات سابقة */}
              {myRequests.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    طلباتك السابقة:
                  </div>
                  {myRequests.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs"
                    >
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        ${(r.amount || 0).toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : r.status === 'approved' || r.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {r.status === 'pending'
                          ? 'بانتظار المراجعة'
                          : r.status === 'approved'
                          ? 'معتمد'
                          : r.status === 'paid'
                          ? 'تم الدفع'
                          : 'مرفوض'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
