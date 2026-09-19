import React, { useState } from 'react';
import { DollarSign, AlertTriangle, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { User } from '../../types';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

export type AdjustableBalanceField = 'walletBalance' | 'availableBalance' | 'pendingEarnings' | 'lifetimeEarnings';

export const BALANCE_FIELD_LABELS: Record<AdjustableBalanceField, { label: string; desc: string }> = {
  walletBalance: {
    label: 'رصيد المحفظة (الإنفاق)',
    desc: 'الرصيد المتاح للمستخدم لإنشاء حملات أو شراء مقالات أو اشتراكات.'
  },
  availableBalance: {
    label: 'متاح للسحب المالي',
    desc: 'أرباح الكاتب التي تجاوزت فترة التجميد وأصبحت قابلة لطلب السحب الفعلي.'
  },
  pendingEarnings: {
    label: 'أرباح مجمّدة (30 يوماً)',
    desc: 'أرباح قيد المراجعة وفترة الضمان قبل تحريرها للسحب.'
  },
  lifetimeEarnings: {
    label: 'إجمالي الأرباح التراكمية',
    desc: 'إحصائية تراكمية لإجمالي ما حققه الكاتب منذ انضمامه.'
  }
};

const LARGE_ADJUSTMENT_CONFIRM_THRESHOLD = 500;

interface BalanceAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onAdjustBalance?: (
    userId: string,
    field: AdjustableBalanceField,
    amount: number,
    reason: string
  ) => void;
}

export const BalanceAdjustModal: React.FC<BalanceAdjustModalProps> = ({
  isOpen,
  onClose,
  user,
  onAdjustBalance
}) => {
  const [field, setField] = useState<AdjustableBalanceField>('walletBalance');
  const [direction, setDirection] = useState<'add' | 'deduct'>('add');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  useEscapeToClose(onClose, isOpen);

  if (!isOpen || !user) return null;

  const currentVal = Number((user as any)[field] ?? 0);
  const parsedVal = Number(amountInput);
  const isValidAmount = amountInput.trim() !== '' && !Number.isNaN(parsedVal) && parsedVal > 0;
  const deltaAmount = direction === 'add' ? parsedVal : -parsedVal;
  const projectedBalance = Number((currentVal + deltaAmount).toFixed(2));
  const isLarge = parsedVal >= LARGE_ADJUSTMENT_CONFIRM_THRESHOLD;
  const canSubmit = isValidAmount && reason.trim().length >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !onAdjustBalance) return;

    if (isLarge && !confirming) {
      setConfirming(true);
      return;
    }

    onAdjustBalance(user.id, field, deltaAmount, reason.trim());
    setSuccessFlash(true);
    setTimeout(() => {
      setSuccessFlash(false);
      setAmountInput('');
      setReason('');
      setConfirming(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">تعديل رصيد المستخدم يدوياً</h3>
              <p className="text-xs text-slate-400">
                تسجيل حركة مالية رسمية في سجل التدقيق المالي للمنصة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-brand-500/20"
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-white truncate">{user.fullName}</div>
            <div className="text-xs text-slate-400 font-mono truncate">
              @{user.username} • {user.email}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-300 border border-brand-500/20">
            {user.role}
          </span>
        </div>

        {successFlash ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="font-bold text-white text-sm">تم تعديل الرصيد وتوثيق الحركة بنجاح</h4>
            <p className="text-xs text-emerald-300">تم التحديث في قاعدة البيانات وسجل التدقيق.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اختر الحساب المستهدف:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(BALANCE_FIELD_LABELS) as AdjustableBalanceField[]).map((fKey) => {
                  const val = Number((user as any)[fKey] ?? 0);
                  const isSelected = field === fKey;
                  return (
                    <button
                      type="button"
                      key={fKey}
                      onClick={() => {
                        setField(fKey);
                        setConfirming(false);
                      }}
                      className={`p-3 rounded-2xl border text-start transition-all ${
                        isSelected
                          ? 'bg-brand-950/40 border-brand-500 ring-2 ring-brand-500/20'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-200">
                        {BALANCE_FIELD_LABELS[fKey].label}
                      </div>
                      <div className="text-xs font-black text-emerald-400 font-mono mt-1">
                        الرصيد الحالي: ${val.toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direction: Add vs Deduct */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                نوع العملية:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDirection('add');
                    setConfirming(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    direction === 'add'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  + إضافة رصيد (شحن / مكافأة)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirection('deduct');
                    setConfirming(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    direction === 'deduct'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  - خصم رصيد (تسوية / تصحيح)
                </button>
              </div>
            </div>

            {/* Amount and Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  المبلغ بالدولار ($):
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-500 font-mono text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setConfirming(false);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-7 pl-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الرصيد بعد التنفيذ:
                </label>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold flex items-center justify-between">
                  <span className="text-slate-400">النتيجة:</span>
                  <span
                    className={
                      projectedBalance < 0
                        ? 'text-rose-400'
                        : projectedBalance > currentVal
                        ? 'text-emerald-400'
                        : 'text-white'
                    }
                  >
                    ${isValidAmount ? projectedBalance.toFixed(2) : currentVal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                سبب التعديل (إلزامي للتوثيق والتدقيق):
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setConfirming(false);
                }}
                rows={2}
                placeholder="مثال: تأكيد إيداع يدوي عبر ويسترن يونيون، مكافأة كاتب متميز، خصم حملة إعلانية..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            {/* Warning for large adjustment */}
            {isLarge && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-bold">مبلغ كبير (${parsedVal.toFixed(2)})</div>
                  <div className="text-[11px] text-amber-200/80 mt-0.5">
                    يتطلب هذا المبلغ تأكيداً ثنائياً لضمان عدم حدوث خطأ كتابي في الرصيد.
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  confirming
                    ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                    : 'bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{confirming ? 'تأكيد التعديل النهائي' : 'تطبيق التعديل'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
