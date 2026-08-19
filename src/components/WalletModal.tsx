import React, { useState } from 'react';
import {
  Wallet,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  ShieldCheck,
  Zap,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Transaction, PaymentMethod } from '../types';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  pendingBalance: number;
  transactions: Transaction[];
  onDeposit: (amount: number, method: PaymentMethod, ref: string) => void;
  onWithdraw: (amount: number, method: PaymentMethod, accountDetail: string) => void;
  userRole: 'reader' | 'writer' | 'advertiser' | 'admin';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  balance,
  pendingBalance,
  transactions,
  onDeposit,
  onWithdraw,
  userRole
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'history'>('overview');
  
  // Deposit state
  const [depositAmount, setDepositAmount] = useState<number>(50);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('stripe_card');
  const [depositSuccess, setDepositSuccess] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState<number>(Math.min(balance, 50));
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethod>('usdt_crypto');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  if (!isOpen) return null;

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;

    const fakeRef = `DEP-${Math.floor(100000 + Math.random() * 900000)}`;
    onDeposit(Number(depositAmount), depositMethod, fakeRef);
    setDepositSuccess(true);
    try {
      confetti({ particleCount: 60, spread: 60 });
    } catch {}
    setTimeout(() => {
      setDepositSuccess(false);
      setActiveTab('overview');
    }, 1800);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');

    if (withdrawAmount < 10) {
      setWithdrawError('الحد الأدنى لطلب السحب هو 10 دولارات.');
      return;
    }

    if (withdrawAmount > balance) {
      setWithdrawError('المبلغ المطلوب يتجاوز رصيدك المتاح حالياً.');
      return;
    }

    if (!withdrawAccount.trim()) {
      setWithdrawError('يرجى كتابة عنوان المحفظة أو الحساب البنكي.');
      return;
    }

    onWithdraw(Number(withdrawAmount), withdrawMethod, withdrawAccount);
    setWithdrawSuccess(true);
    try {
      confetti({ particleCount: 60, spread: 60 });
    } catch {}
    setTimeout(() => {
      setWithdrawSuccess(false);
      setActiveTab('overview');
      setWithdrawAccount('');
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-2xl max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                محفظة ليتيريوم المالية
              </h3>
              <p className="text-xs text-slate-500">
                إدارة الأرباح، الإيداعات، والسحب الفوري بأمان
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/40 dark:bg-slate-900/40">
          {[
            { id: 'overview' as const, label: 'نظرة عامة' },
            { id: 'deposit' as const, label: 'إيداع رصيد +' },
            { id: 'withdraw' as const, label: 'سحب الأرباح ↑' },
            { id: 'history' as const, label: 'سجل العمليات' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Balance Big Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-teal-800/40">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-teal-200">
                    الرصيد المتاح للسحب والاستخدام
                  </span>
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>

                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-3xl sm:text-4xl font-black">{balance.toFixed(2)}</span>
                  <span className="text-lg font-bold text-teal-300">USD</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-teal-800/60 text-xs">
                  <div>
                    <span className="text-teal-300 block mb-0.5">الرصيد المعلق</span>
                    <span className="font-bold text-sm text-amber-300">{pendingBalance.toFixed(2)}$</span>
                  </div>
                  <div>
                    <span className="text-teal-300 block mb-0.5">الحد الأدنى للسحب</span>
                    <span className="font-bold text-sm text-emerald-300">10.00$</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('deposit')}
                  className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all flex items-center justify-center gap-2 text-teal-800 dark:text-teal-300 font-extrabold text-sm"
                >
                  <ArrowDownLeft className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <span>إيداع رصيد للمحفظة</span>
                </button>

                <button
                  onClick={() => setActiveTab('withdraw')}
                  className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-2 font-extrabold text-sm"
                >
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  <span>طلب سحب الأرباح</span>
                </button>
              </div>

              {/* Revenue Sharing Legend */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>قواعد توزيع وتقاسم العوائد المالية:</span>
                </h4>
                <ul className="space-y-1.5 text-[11px] leading-relaxed">
                  <li>• <strong>إعلانات داخل مقالات الكاتب:</strong> {REVENUE_SHARES.IN_ARTICLE_ADS.LABEL}.</li>
                  <li>• <strong>إعلانات صفحة الكاتب الشخصية:</strong> {REVENUE_SHARES.WRITER_PROFILE_ADS.LABEL}.</li>
                  <li>• <strong>المقالات المقفولة الحصرية:</strong> {REVENUE_SHARES.LOCKED_ARTICLES.LABEL}.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Deposit Tab */}
          {activeTab === 'deposit' && (
            <form onSubmit={handleDepositSubmit} className="space-y-5">
              {depositSuccess ? (
                <div className="p-8 text-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-black text-lg text-emerald-900 dark:text-emerald-200">
                    تم إيداع الرصيد بنجاح!
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    تمت إضافة {depositAmount}$ إلى رصيدك المتاح فوراً.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      اختر وسيلة الإيداع:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'stripe_card' as PaymentMethod, label: 'بطاقة ائتمان / مدى', desc: 'Stripe أو Visa/Mastercard' },
                        { id: 'paypal' as PaymentMethod, label: 'باي بال PayPal', desc: 'دفع فوري وآمن' },
                        { id: 'usdt_crypto' as PaymentMethod, label: 'USDT Tether', desc: 'شبكة TRC20 / BEP20' },
                        { id: 'bank_wire' as PaymentMethod, label: 'تحويل بنكي IBAN', desc: 'خلال 24-48 ساعة' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setDepositMethod(m.id)}
                          className={`p-3 rounded-2xl border text-start transition-all ${
                            depositMethod === m.id
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="block text-xs font-bold">{m.label}</span>
                          <span className="block text-[10px] text-slate-400">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      حدد المبلغ المراد إيداعه ($):
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[20, 50, 100, 250, 500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositAmount(amt)}
                          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                            depositAmount === amt
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {amt}$
                        </button>
                      ))}
                    </div>

                    <input
                      type="number"
                      min="5"
                      max="10000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md transition-all hover:scale-[1.01]"
                  >
                    تأكيد إيداع {depositAmount}$
                  </button>
                </>
              )}
            </form>
          )}

          {/* Withdraw Tab */}
          {activeTab === 'withdraw' && (
            <form onSubmit={handleWithdrawSubmit} className="space-y-5">
              {withdrawSuccess ? (
                <div className="p-8 text-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-black text-lg text-emerald-900 dark:text-emerald-200">
                    تم إرسال طلب السحب بنجاح!
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    سيتم تحويل مبلغ {withdrawAmount}$ إلى حسابك في غضون دقائق إلى 24 ساعة.
                  </p>
                </div>
              ) : (
                <>
                  {withdrawError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{withdrawError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      طريقة استلام الأرباح:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'usdt_crypto' as PaymentMethod, label: 'USDT TRC20 / BEP20', desc: 'تحويل محفظة رقمية فوري' },
                        { id: 'bank_wire' as PaymentMethod, label: 'تحويل بنكي IBAN', desc: 'حسابك البنكي المحلي' },
                        { id: 'paypal' as PaymentMethod, label: 'حساب PayPal', desc: 'تحويل إلى البريد الإلكتروني' },
                        { id: 'payoneer' as PaymentMethod, label: 'حساب Payoneer', desc: 'حساب بايونير العالمي' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setWithdrawMethod(m.id)}
                          className={`p-3 rounded-2xl border text-start transition-all ${
                            withdrawMethod === m.id
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="block text-xs font-bold">{m.label}</span>
                          <span className="block text-[10px] text-slate-400">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      مبلغ السحب (المتاح: {balance.toFixed(2)}$):
                    </label>
                    <input
                      type="number"
                      min="10"
                      max={balance}
                      step="1"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      {withdrawMethod === 'usdt_crypto'
                        ? 'عنوان محفظة USDT (TRC20 / BEP20)'
                        : withdrawMethod === 'bank_wire'
                        ? 'رقم الآيبان البنكي الكامل (IBAN) واسم البنك'
                        : 'البريد الإلكتروني المسجل في الحساب'}
                    </label>
                    <input
                      type="text"
                      required
                      value={withdrawAccount}
                      onChange={(e) => setWithdrawAccount(e.target.value)}
                      placeholder={
                        withdrawMethod === 'usdt_crypto'
                          ? 'TEv9xKq... أو 0x71C...'
                          : withdrawMethod === 'bank_wire'
                          ? 'SA0380000...'
                          : 'user@example.com'
                      }
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={balance < 10}
                    className="w-full py-3.5 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-extrabold text-sm shadow-md transition-all disabled:opacity-50"
                  >
                    تأكيد طلب سحب {withdrawAmount}$
                  </button>
                </>
              )}
            </form>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">لا توجد عمليات سابقة</p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                          tx.type === 'deposit' || tx.type.startsWith('earning')
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'deposit' || tx.type.startsWith('earning') ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {tx.description}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {tx.createdAt} • {tx.paymentMethod}
                        </span>
                      </div>
                    </div>

                    <div className="text-end">
                      <span
                        className={`font-black text-sm block ${
                          tx.type === 'deposit' || tx.type.startsWith('earning')
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'deposit' || tx.type.startsWith('earning') ? '+' : '-'}
                        {tx.amount.toFixed(2)}$
                      </span>
                      <span className="text-[10px] text-emerald-500 font-bold">مكتملة</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
