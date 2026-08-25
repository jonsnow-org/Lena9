import React, { useState, useEffect } from 'react';
import {
  Wallet,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  ShieldCheck,
  Zap,
  Lock,
  Loader2,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Transaction, PaymentMethod } from '../types';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { MIN_DEPOSIT_USD, MIN_PAYOUT_USD } from '../constants/payoutRules';
import {
  fetchPaymentStatus,
  createDepositCheckout,
  fetchPayoutAccountStatus,
  createPayoutConnectLink,
  createAutomatedPayout,
  fetchNowPaymentsStatus,
  createNowPaymentsInvoice,
  createNowPaymentsDirectPayment,
  PaymentStatus,
  PayoutAccountStatus
} from '../services/paymentsApi';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  pendingBalance: number;
  transactions: Transaction[];
  onDeposit: (amount: number, method: PaymentMethod, ref: string) => void;
  onWithdraw: (amount: number, method: PaymentMethod, accountDetail: string) => void;
  userRole: 'reader' | 'writer' | 'advertiser' | 'admin';
  isKycVerified?: boolean;
  onOpenKyc?: () => void;
}

// أي طلب سحب فوق هذا المبلغ يُطلب تأكيده مرتين — حماية من خطأ كتابي
// (رقم زائد) يُنفَّذ مباشرة بلا أي فرصة للتراجع.
const LARGE_WITHDRAW_CONFIRM_THRESHOLD = 500;

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  balance,
  pendingBalance,
  transactions,
  onDeposit,
  onWithdraw,
  userRole,
  isKycVerified = false,
  onOpenKyc
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'history'>('overview');

  // حالة بوابة الدفع الآلية — تُفحص فقط عند فتح النافذة، وتبقى معطّلة
  // بأمان (automated: false) إن لم يضبط المالك المفاتيح على الخادم.
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [payoutAccountStatus, setPayoutAccountStatus] = useState<PayoutAccountStatus | null>(null);
  const [isAutomatedBusy, setIsAutomatedBusy] = useState(false);
  const [automatedError, setAutomatedError] = useState('');

  // نفس فكرة paymentStatus تماماً لكن لبوابة NOWPayments (عملات رقمية) —
  // مستقلة كلياً، قد تعمل إحداهما دون الأخرى.
  const [cryptoAutomated, setCryptoAutomated] = useState(false);
  const [isCryptoBusy, setIsCryptoBusy] = useState(false);
  const [cryptoError, setCryptoError] = useState('');

  // "دفع بالبطاقة عبر وسيط خارجي" — عنوان استلام USDT-TRC20 حقيقي من
  // NOWPayments يُعرض للمستخدم مع زر نسخ، ليلصقه يدوياً بموقع Guardarian
  // العام. لا تعبئة تلقائية (اختُبرت كل صيغ الروابط الجاهزة ولم تعمل مع
  // أي مزوّد بدون شراكة رسمية/KYB)، فهذا المسار اليدوي الوحيد المضمون.
  const [cardBridgeAddress, setCardBridgeAddress] = useState('');
  const [isCardBridgeBusy, setIsCardBridgeBusy] = useState(false);
  const [cardBridgeError, setCardBridgeError] = useState('');
  const [cardBridgeCopied, setCardBridgeCopied] = useState(false);

  // Deposit state
  const [depositAmount, setDepositAmount] = useState<number>(MIN_DEPOSIT_USD);
  const [depositSuccess, setDepositSuccess] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState<number>(Math.min(balance, MIN_PAYOUT_USD));
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethod>('usdt_crypto');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [pendingLargeWithdraw, setPendingLargeWithdraw] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchPaymentStatus().then(setPaymentStatus);
    fetchNowPaymentsStatus().then((s) => setCryptoAutomated(s.automated));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'withdraw' || !paymentStatus?.automated) return;
    fetchPayoutAccountStatus().then(setPayoutAccountStatus).catch(() => setPayoutAccountStatus(null));
  }, [isOpen, activeTab, paymentStatus?.automated]);

  if (!isOpen) return null;

  const handleAutomatedDeposit = async () => {
    setAutomatedError('');
    if (!depositAmount || depositAmount < MIN_DEPOSIT_USD) {
      setAutomatedError(`الحد الأدنى للإيداع ${MIN_DEPOSIT_USD}$.`);
      return;
    }
    setIsAutomatedBusy(true);
    try {
      const { checkoutUrl } = await createDepositCheckout(Number(depositAmount));
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setAutomatedError(err?.message || 'تعذر بدء عملية الدفع.');
      setIsAutomatedBusy(false);
    }
  };

  const handleCryptoDeposit = async () => {
    setCryptoError('');
    if (!depositAmount || depositAmount < MIN_DEPOSIT_USD) {
      setCryptoError(`الحد الأدنى للإيداع ${MIN_DEPOSIT_USD}$.`);
      return;
    }
    setIsCryptoBusy(true);
    try {
      const { checkoutUrl } = await createNowPaymentsInvoice(Number(depositAmount));
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setCryptoError(err?.message || 'تعذر بدء عملية الدفع بالعملة الرقمية.');
      setIsCryptoBusy(false);
    }
  };

  const handleCardBridgeDeposit = async () => {
    setCardBridgeError('');
    setCardBridgeCopied(false);
    if (!depositAmount || depositAmount < MIN_DEPOSIT_USD) {
      setCardBridgeError(`الحد الأدنى للإيداع ${MIN_DEPOSIT_USD}$.`);
      return;
    }
    setIsCardBridgeBusy(true);
    try {
      const result = await createNowPaymentsDirectPayment(Number(depositAmount));
      setCardBridgeAddress(result.payAddress);
    } catch (err: any) {
      setCardBridgeError(err?.message || 'تعذر إنشاء عنوان استلام الدفع.');
    } finally {
      setIsCardBridgeBusy(false);
    }
  };

  const handleCopyCardBridgeAddress = async () => {
    if (!cardBridgeAddress) return;
    try {
      await navigator.clipboard.writeText(cardBridgeAddress);
      setCardBridgeCopied(true);
      setTimeout(() => setCardBridgeCopied(false), 2500);
    } catch {
      setCardBridgeError('تعذر النسخ التلقائي — انسخ العنوان يدوياً من الحقل أعلاه.');
    }
  };

  const handleConnectPayoutAccount = async () => {
    setAutomatedError('');
    setIsAutomatedBusy(true);
    try {
      const result = await createPayoutConnectLink();
      setPayoutAccountStatus(result.status);
      if (result.status.onboardingUrl) {
        window.open(result.status.onboardingUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setAutomatedError(err?.message || 'تعذر بدء ربط حساب الاستلام.');
    } finally {
      setIsAutomatedBusy(false);
    }
  };

  const handleAutomatedWithdraw = async () => {
    setAutomatedError('');
    if (!isKycVerified) {
      setAutomatedError('يجب إتمام التحقق من الهوية (KYC) أولاً.');
      return;
    }
    if (withdrawAmount < MIN_PAYOUT_USD) {
      setAutomatedError(`الحد الأدنى للسحب هو ${MIN_PAYOUT_USD} دولاراً.`);
      return;
    }
    if (withdrawAmount > balance) {
      setAutomatedError('المبلغ يتجاوز رصيدك المتاح للسحب.');
      return;
    }
    setIsAutomatedBusy(true);
    try {
      await createAutomatedPayout(Number(withdrawAmount));
      setWithdrawSuccess(true);
      try {
        confetti({ particleCount: 80, spread: 70 });
      } catch {}
      setTimeout(() => {
        setWithdrawSuccess(false);
        setActiveTab('overview');
      }, 2200);
    } catch (err: any) {
      setAutomatedError(err?.message || 'تعذر تنفيذ عملية السحب.');
    } finally {
      setIsAutomatedBusy(false);
    }
  };

  // طرق الإيداع اليدوي المتبقية (PayPal / USDT يدوي / تحويل بنكي) قيد
  // التطوير ولم يعد لها زر إرسال ضمن هذا النموذج — هذا يبقى فقط ليمنع أي
  // إرسال ضمني (مثلاً عبر Enter داخل حقل المبلغ) من إنشاء طلب بلا وجهة
  // تحويل حقيقية.
  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };


  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');

    // مطابق تماماً لحد handleWithdraw الفعلي في App.tsx — كان هذا النموذج
    // يعرض حداً أدنى مختلفاً (10$) يخالف الحد الحقيقي المطبَّق (50$)،
    // فيسمح للمستخدم بملء النموذج وإرساله ليُرفض لاحقاً بلا تفسير هنا.
    if (withdrawAmount < MIN_PAYOUT_USD) {
      setWithdrawError(`الحد الأدنى لطلب السحب هو ${MIN_PAYOUT_USD} دولاراً.`);
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

    if (!isKycVerified) {
      setWithdrawError('يجب إتمام التحقق من الهوية (KYC) قبل طلب السحب.');
      return;
    }

    // مبلغ كبير: نطلب تأكيداً إضافياً قبل التنفيذ الفعلي، حماية من رقم
    // خاطئ يُرسَل مباشرة بلا أي فرصة للمراجعة.
    if (withdrawAmount >= LARGE_WITHDRAW_CONFIRM_THRESHOLD && !pendingLargeWithdraw) {
      setPendingLargeWithdraw(true);
      return;
    }
    setPendingLargeWithdraw(false);

    onWithdraw(Number(withdrawAmount), withdrawMethod, withdrawAccount);
    setWithdrawSuccess(true);
    setTimeout(() => {
      setWithdrawSuccess(false);
      setActiveTab('overview');
      setWithdrawAccount('');
    }, 2200);
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
                    <span className="font-bold text-sm text-emerald-300">{MIN_PAYOUT_USD.toFixed(2)}$</span>
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
                    تم إرسال طلب الإيداع
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    سيُضاف {depositAmount}$ إلى رصيدك بعد تأكيد إدارة المنصة لوصول المبلغ (خلال 24-48 ساعة).
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      حدد المبلغ المراد إيداعه ($):
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[MIN_DEPOSIT_USD, 25, 50, 100, 250].map((amt) => (
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
                      min={MIN_DEPOSIT_USD}
                      max="10000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-hidden focus:border-teal-500"
                    />
                  </div>

                  {/* الدفع الآلي الفوري — يظهر فقط إن ضبط المالك مفاتيح بوابة
                      دفع حقيقية على الخادم (انظر /api/payments/status). */}
                  {paymentStatus?.automated && (
                    <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 text-xs font-bold">
                        <Zap className="w-4 h-4" />
                        <span>دفع فوري بالبطاقة — يُضاف الرصيد تلقائياً خلال ثوانٍ</span>
                      </div>
                      {automatedError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">{automatedError}</p>
                      )}
                      <button
                        type="button"
                        onClick={handleAutomatedDeposit}
                        disabled={isAutomatedBusy}
                        className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        {isAutomatedBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        <span>ادفع {depositAmount}$ الآن ببطاقتك</span>
                      </button>
                    </div>
                  )}

                  {/* دفع فوري بعملة رقمية عبر NOWPayments — يظهر فقط إن
                      ضبط المالك مفاتيحه على الخادم، مستقل تماماً عن Stripe. */}
                  {cryptoAutomated && (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                        <Zap className="w-4 h-4" />
                        <span>دفع فوري بعملة رقمية — يُضاف الرصيد تلقائياً فور تأكيد الشبكة</span>
                      </div>
                      {cryptoError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">{cryptoError}</p>
                      )}
                      <button
                        type="button"
                        onClick={handleCryptoDeposit}
                        disabled={isCryptoBusy}
                        className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        {isCryptoBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <DollarSign className="w-4 h-4" />
                        )}
                        <span>ادفع {depositAmount}$ الآن بعملة رقمية</span>
                      </button>
                    </div>
                  )}

                  {/* دفع بالبطاقة عبر وسيط خارجي (Guardarian) — لا تعبئة
                      تلقائية ممكنة (يتطلب partner_api_token رسمي غير
                      متاح)، فالمسار هنا: نعرض عنوان استلام USDT-TRC20
                      حقيقي من NOWPayments مع زر نسخ، والمستخدم يلصقه يدوياً
                      بموقع الوسيط بعد فتحه. */}
                  {cryptoAutomated && (
                    <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 text-xs font-bold">
                        <CreditCard className="w-4 h-4" />
                        <span>الدفع بالفيزا/ماستركارد عبر وسيط خارجي</span>
                      </div>
                      <p className="text-[11px] text-sky-700 dark:text-sky-400 leading-relaxed">
                        هذا المسار غير آلي بالكامل: أنشئ عنوان استلام أدناه، انسخه، ثم افتح موقع الوسيط (Guardarian)
                        والصق العنوان هناك يدوياً، واختر <span dir="ltr" className="font-mono">USDT</span> على شبكة{' '}
                        <span dir="ltr" className="font-mono">TRC20/TRON</span>. قد يطلب منك الوسيط تأكيد هويتك
                        (KYC) كإجراء خاص فيه قبل إتمام أول عملية.
                      </p>
                      {cardBridgeError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">{cardBridgeError}</p>
                      )}

                      {!cardBridgeAddress ? (
                        <button
                          type="button"
                          onClick={handleCardBridgeDeposit}
                          disabled={isCardBridgeBusy}
                          className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          {isCardBridgeBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          )}
                          <span>أنشئ عنوان استلام لدفع {depositAmount}$ بالبطاقة</span>
                        </button>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                              عنوان الاستلام (USDT - شبكة TRC20):
                            </p>
                            <p dir="ltr" className="font-mono text-xs break-all text-slate-900 dark:text-white">
                              {cardBridgeAddress}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyCardBridgeAddress}
                            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                          >
                            <span>{cardBridgeCopied ? 'تم نسخ العنوان ✓' : 'انسخ العنوان'}</span>
                          </button>
                          <a
                            href="https://guardarian.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>افتح موقع الوسيط (Guardarian)</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setCardBridgeAddress('');
                              setCardBridgeCopied(false);
                            }}
                            className="w-full py-2 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold"
                          >
                            إنشاء عنوان جديد
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* طرق الإيداع اليدوي الأخرى (PayPal / USDT يدوي / تحويل بنكي)
                      ما زالت قيد التطوير — لا تعرض للمستخدم أي بيانات حساب فعلية
                      يُحوّل إليها، ما كان يسمح بإرسال طلب إيداع بلا أي وجهة
                      حقيقية. تُعرض هنا فقط لإعلام المستخدم أنها قادمة قريباً،
                      ومعطّلة تماماً حتى تُستكمل ببيانات حساب حقيقية وشاشة
                      اعتماد إدارية مخصصة لها. */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      طرق إيداع إضافية:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'paypal' as PaymentMethod, label: 'باي بال PayPal', desc: 'دفع فوري وآمن' },
                        { id: 'usdt_crypto' as PaymentMethod, label: 'USDT Tether', desc: 'شبكة TRC20 / BEP20' },
                        { id: 'bank_wire' as PaymentMethod, label: 'تحويل بنكي IBAN', desc: 'خلال 24-48 ساعة' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          disabled
                          title="قيد التطوير — سيتم تفعيلها قريباً"
                          className="relative p-3 rounded-2xl border text-start bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70"
                        >
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[9px] font-bold">
                            قيد التطوير
                          </span>
                          <span className="block text-xs font-bold">{m.label}</span>
                          <span className="block text-[10px] text-slate-400">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      هذه الطرق قيد التطوير حالياً وستتوفر قريباً. استخدم الدفع الفوري بالبطاقة أو بالعملة الرقمية أعلاه للإيداع الآن.
                    </p>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Withdraw Tab */}
          {activeTab === 'withdraw' && (
            <>
              {!isKycVerified ? (
                // ⚠️ التحقق من الهوية (KYC) لم يكن شرطاً فعلياً لأي طلب سحب —
                // أي حساب غير موثّق كان يستطيع طلب سحب مبالغ كبيرة رغم أن
                // شاشة KYC نفسها تشرح أنها "لضمان أمان المعاملات المالية".
                <div className="p-6 text-center rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                  <Lock className="w-10 h-10 text-amber-600 mx-auto" />
                  <h4 className="font-black text-sm text-amber-900 dark:text-amber-200">
                    التحقق من الهوية مطلوب قبل السحب
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    لحماية أرباحك ومنع الاحتيال، يجب إتمام التحقق من الهوية (KYC) قبل تقديم أي طلب سحب.
                  </p>
                  {onOpenKyc && (
                    <button
                      type="button"
                      onClick={onOpenKyc}
                      className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                    >
                      إتمام التحقق من الهوية الآن
                    </button>
                  )}
                </div>
              ) : (
              <form onSubmit={handleWithdrawSubmit} className="space-y-5">
              {withdrawSuccess ? (
                <div className="p-8 text-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-black text-lg text-emerald-900 dark:text-emerald-200">
                    {paymentStatus?.automated && payoutAccountStatus?.payoutsEnabled
                      ? 'تم تنفيذ عملية السحب!'
                      : 'تم إرسال طلب السحب بنجاح!'}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {paymentStatus?.automated && payoutAccountStatus?.payoutsEnabled
                      ? `تم تحويل ${withdrawAmount}$ إلى حسابك المرتبط، وسيصلك خلال جدول السحب المعتاد لحسابك.`
                      : `سيراجع فريق المنصة طلبك وتحويل ${withdrawAmount}$ خلال 24 إلى 48 ساعة.`}
                  </p>
                </div>
              ) : (
                <>
                  {(withdrawError || automatedError) && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{withdrawError || automatedError}</span>
                    </div>
                  )}

                  {/* السحب الآلي الفوري — يظهر فقط إن ضبط المالك مفاتيح بوابة
                      دفع حقيقية على الخادم. يتطلب ربط حساب استلام أموال مرة
                      واحدة (يتولى Stripe نفسه جمع بيانات الحساب البنكي). */}
                  {paymentStatus?.automated && (
                    <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 text-xs font-bold">
                        <Zap className="w-4 h-4" />
                        <span>سحب فوري تلقائي</span>
                      </div>
                      {payoutAccountStatus?.payoutsEnabled ? (
                        <button
                          type="button"
                          onClick={handleAutomatedWithdraw}
                          disabled={isAutomatedBusy || withdrawAmount < MIN_PAYOUT_USD || withdrawAmount > balance}
                          className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          {isAutomatedBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          <span>اسحب {withdrawAmount}$ الآن تلقائياً</span>
                        </button>
                      ) : (
                        <>
                          <p className="text-[11px] text-teal-700 dark:text-teal-300">
                            اربط حساب استلام الأموال مرة واحدة (يستغرق دقائق عبر صفحة آمنة) لتفعيل السحب الفوري لاحقاً.
                          </p>
                          <button
                            type="button"
                            onClick={handleConnectPayoutAccount}
                            disabled={isAutomatedBusy}
                            className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center gap-2"
                          >
                            {isAutomatedBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                            <span>ربط حساب استلام الأموال</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                      {paymentStatus?.automated ? `أو أرسل طلب سحب يدوي بطريقة أخرى — الحد الأدنى ${MIN_PAYOUT_USD}$:` : 'طريقة استلام الأرباح:'}
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
                      مبلغ السحب (المتاح: {balance.toFixed(2)}$، الحد الأدنى {MIN_PAYOUT_USD}$):
                    </label>
                    <input
                      type="number"
                      min={MIN_PAYOUT_USD}
                      max={balance}
                      step="1"
                      value={withdrawAmount}
                      onChange={(e) => {
                        setWithdrawAmount(Number(e.target.value));
                        setPendingLargeWithdraw(false);
                      }}
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

                  {pendingLargeWithdraw && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                      <p className="font-bold">
                        هذا مبلغ كبير (≥ {LARGE_WITHDRAW_CONFIRM_THRESHOLD}$). تأكد من صحة بيانات الاستلام قبل المتابعة.
                      </p>
                      <button
                        type="button"
                        onClick={() => setPendingLargeWithdraw(false)}
                        className="text-amber-700 dark:text-amber-300 underline font-bold"
                      >
                        إلغاء والتعديل
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={balance < MIN_PAYOUT_USD}
                    className="w-full py-3.5 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-extrabold text-sm shadow-md transition-all disabled:opacity-50"
                  >
                    {pendingLargeWithdraw ? `تأكيد نهائي: سحب ${withdrawAmount}$` : `تأكيد طلب سحب ${withdrawAmount}$`}
                  </button>
                </>
              )}
              </form>
              )}
            </>
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
