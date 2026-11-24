import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Check,
  Zap,
  ShieldCheck,
  CreditCard,
  Wallet as WalletIcon,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Crown,
  Flame,
  ArrowRight,
  Loader2,
  Table,
  CheckCircle,
  HelpCircle,
  QrCode,
  Lock,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, PaymentMethod } from '../types';
import {
  SUBSCRIPTION_PLANS,
  COMPARISON_METRICS,
  formatAiExpiryDate,
  getRemainingAiUses
} from '../utils/aiQuota';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUpgradeSuccess: (
    planId: 'monthly' | 'annual',
    paymentMethod: PaymentMethod
  ) => { ok: boolean; error?: string };
  onOpenAuth?: () => void;
  onOpenAiAssistant?: () => void;
  initialSelectedPlan?: 'monthly' | 'annual';
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpgradeSuccess,
  onOpenAuth,
  onOpenAiAssistant,
  initialSelectedPlan = 'annual'
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<'monthly' | 'annual'>(initialSelectedPlan);
  const [viewMode, setViewMode] = useState<'plans' | 'comparison'>('plans');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'usdt_trc20' | 'usdt_bep20' | 'card' | 'paypal'>('wallet');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [step, setStep] = useState<'plans' | 'checkout' | 'success'>('plans');
  const [successDetails, setSuccessDetails] = useState<{
    referenceId: string;
    expiryDate: string;
    newLimit: string;
  } | null>(null);

  // Card details state
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(currentUser?.fullName || '');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // النافذة تبقى مركّبة دون إعادة تحميل بين مرات الفتح (return null فقط
  // أدناه)، فبدون هذا، فتحها مجدداً بعد نجاح طلب سابق كان سيُظهر شاشة
  // "تم استلام الطلب" القديمة مباشرة بدل شاشة اختيار الباقة من جديد.
  useEffect(() => {
    if (isOpen) {
      setStep('plans');
      setPaymentError('');
      setSuccessDetails(null);
    }
  }, [isOpen]);
  useEscapeToClose(onClose, isOpen);

  if (!isOpen) return null;

  const currentPlan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanId) || SUBSCRIPTION_PLANS[1];
  // كان يقرأ totalEarnings (إحصائية أرباح، لا رصيداً قابلاً للإنفاق) —
  // نفس خطأ حقل الرصيد المُصلَح في App.tsx (WalletModal/NewCampaignModal).
  const walletBalance = currentUser?.walletBalance || 0;
  const hasEnoughWalletBalance = walletBalance >= currentPlan.price;
  const quotaStats = currentUser ? getRemainingAiUses(currentUser.aiQuota) : null;

  const usdtAddressTRC20 = 'TX9qL89KzRtW4mP1vBnQe8Y7xUs31LiteriumTRC';
  const usdtAddressBEP20 = '0x71C5980a3E5F92716492E88AcBc9177A6e4C9833';
  const activeCryptoAddress = paymentMethod === 'usdt_bep20' ? usdtAddressBEP20 : usdtAddressTRC20;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(activeCryptoAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleProceedToCheckout = () => {
    if (!currentUser) {
      onClose();
      if (onOpenAuth) onOpenAuth();
      return;
    }
    setStep('checkout');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setIsProcessing(true);

    let methodLabel = 'محفظة ليتيريوم';
    if (paymentMethod === 'usdt_trc20') methodLabel = 'USDT (TRC20)';
    else if (paymentMethod === 'usdt_bep20') methodLabel = 'USDT (BEP20)';
    else if (paymentMethod === 'card') methodLabel = 'Stripe / بطاقة ائتمانية';
    else if (paymentMethod === 'paypal') methodLabel = 'PayPal';

    // لا يوجد أي اتصال حقيقي ببوابة دفع (Stripe/PayPal) في هذه المنصة —
    // الدفع بوساطة الأدمن حصراً. لا تفعيل فوري ولا محاكاة نجاح وهمية هنا؛
    // الطلب يُرسَل فوراً وتتولى App.tsx إنشاء طلب معلّق للمراجعة اليدوية،
    // والشاشة التالية تعرض "تم الاستلام — قيد المراجعة" بصدق، لا "مفعّل الآن".
    const result = onUpgradeSuccess(selectedPlanId, methodLabel as PaymentMethod);

    if (!result?.ok) {
      setIsProcessing(false);
      setPaymentError(result?.error || 'تعذر إرسال طلب الاشتراك. يرجى المحاولة مرة أخرى.');
      return;
    }

    setSuccessDetails({
      referenceId: `SUB-${Date.now().toString().slice(-6)}`,
      expiryDate: '',
      newLimit: currentPlan.aiLimitLabel
    });
    setIsProcessing(false);
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-android-in">
        {/* Header with deep navy & turquoise background */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 text-white border-b border-teal-900/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500 via-cyan-400 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-teal-950/50 ring-2 ring-teal-500/20">
                <Crown className="w-6 h-6 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg sm:text-xl text-white">
                    باقات الذكاء الاصطناعي Pro
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                    Gemini 2.5 Pro
                  </span>
                </div>
                <p className="text-xs text-teal-200/80 mt-0.5">
                  ارتقِ بقدراتك في الكتابة والتدقيق والتأليف الأدبي بأحدث نماذج الذكاء الاصطناعي
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Quota Status Pill inside Header */}
          {currentUser && quotaStats && (
            <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-teal-200">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  وضع حسابك الحالي:{' '}
                  <strong className="text-white">
                    {quotaStats.isSubscriber
                      ? quotaStats.plan === 'annual'
                        ? 'مشترك VIP السنوي (غير محدود)'
                        : `مشترك Pro (${quotaStats.remaining} استعلام متبقي)`
                      : `الخطة المجانية (${quotaStats.remaining} / ${quotaStats.limit} استخدامات اليوم)`}
                  </strong>
                </span>
              </div>

              {!quotaStats.isSubscriber && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-200 font-bold border border-teal-400/30">
                  تتجدد 5 استخدامات كل 24 ساعة
                </span>
              )}
            </div>
          )}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {step === 'plans' ? (
            <>
              {/* View Mode Switcher (Cards vs Comparison Table) */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewMode('plans')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                      viewMode === 'plans'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-teal-600'
                    }`}
                  >
                    عرض الباقات
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('comparison')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      viewMode === 'comparison'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-teal-600'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>مقارنة الميزات</span>
                  </button>
                </div>

                {/* Savings Banner */}
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
                  <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span>وفر 35% مع باقة VIP السنوية + شارة ملكية موثقة</span>
                </div>
              </div>

              {viewMode === 'plans' ? (
                /* Plan Cards Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SUBSCRIPTION_PLANS.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    const isAnnual = plan.id === 'annual';

                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`relative rounded-3xl p-5 border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? isAnnual
                              ? 'border-amber-500 dark:border-amber-400 bg-amber-500/5 dark:bg-amber-500/10 shadow-lg ring-2 ring-amber-500/20'
                              : 'border-teal-600 dark:border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 shadow-lg ring-2 ring-teal-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-300 dark:hover:border-teal-700'
                        }`}
                      >
                        {/* Top Badge */}
                        {plan.badge && (
                          <div
                            className={`absolute -top-3 start-5 px-3 py-1 rounded-full text-white text-[11px] font-black shadow-md flex items-center gap-1 ${
                              isAnnual
                                ? 'bg-gradient-to-r from-amber-500 to-teal-600'
                                : 'bg-gradient-to-r from-teal-600 to-cyan-600'
                            }`}
                          >
                            {plan.popular && <Crown className="w-3.5 h-3.5 text-amber-200" />}
                            <span>{plan.badge}</span>
                          </div>
                        )}

                        <div>
                          {/* Plan Header */}
                          <div className="flex items-center justify-between mt-1 mb-2">
                            <div>
                              <h4 className="font-black text-base sm:text-lg text-slate-950 dark:text-white flex items-center gap-1.5">
                                <span>{plan.name}</span>
                                {isAnnual && <span className="text-amber-500">👑</span>}
                              </h4>
                              <span className="text-[11px] text-slate-500">{plan.nameEn}</span>
                            </div>

                            <div
                              className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                isSelected
                                  ? isAnnual
                                    ? 'bg-amber-500 border-amber-500 text-slate-950'
                                    : 'bg-teal-600 border-teal-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>

                          {/* Price Display */}
                          <div className="my-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={`text-3xl font-black ${
                                  isAnnual
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-teal-600 dark:text-teal-400'
                                }`}
                              >
                                {plan.price}$
                              </span>
                              <span className="text-xs font-bold text-slate-500">
                                / {plan.periodLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                              <Zap className="w-3.5 h-3.5 text-amber-500" />
                              <span>{plan.aiLimitLabel}</span>
                            </div>
                          </div>

                          {/* Feature Bullets */}
                          <div className="space-y-2.5 pt-2">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                              المميزات المضمنة في الباقة:
                            </span>
                            {plan.features.map((feat, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 leading-snug"
                              >
                                <CheckCircle2
                                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                                    isAnnual
                                      ? 'text-amber-500 dark:text-amber-400'
                                      : 'text-teal-600 dark:text-teal-400'
                                  }`}
                                />
                                <span className="font-medium">{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Selection Button */}
                        <button
                          type="button"
                          className={`mt-6 w-full py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? isAnnual
                                ? 'bg-amber-500 text-slate-950 shadow-md hover:bg-amber-400'
                                : 'bg-teal-600 text-white shadow-md hover:bg-teal-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900/40'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>الباقة المحددة للمتابعة</span>
                            </>
                          ) : (
                            <span>اختيار هذه الباقة</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Plan Comparison Table View */
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm animate-android-in">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-start">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-black">
                          <th className="p-3.5 text-start">المعيار والميزة</th>
                          <th className="p-3.5 text-center text-slate-500">الخطة المجانية</th>
                          <th className="p-3.5 text-center text-teal-600 dark:text-teal-400">
                            باقة Pro الشهرية
                          </th>
                          <th className="p-3.5 text-center text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30">
                            باقة VIP السنوية 👑
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {COMPARISON_METRICS.map((row, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                              {row.metric}
                            </td>
                            <td className="p-3.5 text-center text-slate-500">{row.free}</td>
                            <td className="p-3.5 text-center font-bold text-teal-600 dark:text-teal-400">
                              {row.monthly}
                            </td>
                            <td className="p-3.5 text-center font-black text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/20">
                              {row.annual}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Security & Guarantees Trust Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                      تفعيل فوري وتلقائي
                    </h5>
                    <p className="text-[10px] text-slate-500">
                      يتم رفع حد استخدام الذكاء الاصطناعي في نفس اللحظة
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-teal-500 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                      بوابات دفع مشفرة 100%
                    </h5>
                    <p className="text-[10px] text-slate-500">
                      حماية كاملة بالبطاقات البنكية وUSDT ومحفظتك
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <Crown className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                      شارة توثيق للمشتركين
                    </h5>
                    <p className="text-[10px] text-slate-500">
                      ظهور مميز لكتبك ومقالاتك في صدر منصة ليتيريوم
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : step === 'checkout' ? (
            /* Checkout Step */
            <form onSubmit={handleConfirmPayment} className="space-y-5 animate-android-in">
              {/* Order Summary Pill */}
              <div className="p-4 rounded-3xl bg-gradient-to-r from-teal-50 via-cyan-50 to-slate-50 dark:from-teal-950/40 dark:via-cyan-950/40 dark:to-slate-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-teal-700 dark:text-teal-300 font-black">
                      ملخص الطلب: {currentPlan.name}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5">
                    {currentPlan.aiLimitLabel}
                  </span>
                </div>
                <div className="text-end">
                  <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                    {currentPlan.price}$
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {currentPlan.periodLabel}
                  </span>
                </div>
              </div>

              {/* Payment Methods Selector */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2">
                  اختر طريقة الدفع المعتمدة:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Internal Wallet */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-2xl border text-start transition-all ${
                      paymentMethod === 'wallet'
                        ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <WalletIcon className="w-4 h-4 text-emerald-600" />
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black">
                        رصيدك
                      </span>
                    </div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                      محفظة التطبيق
                    </span>
                    <span className="text-[11px] text-emerald-600 font-black">
                      {walletBalance.toFixed(2)}$
                    </span>
                  </button>

                  {/* USDT TRC20 */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('usdt_trc20')}
                    className={`p-3 rounded-2xl border text-start transition-all ${
                      paymentMethod === 'usdt_trc20'
                        ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-emerald-500">₮</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                        TRC20
                      </span>
                    </div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      USDT (TRON)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      دفع فوري
                    </span>
                  </button>

                  {/* Stripe / Credit Card */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-2xl border text-start transition-all ${
                      paymentMethod === 'card'
                        ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <CreditCard className="w-4 h-4 text-teal-600" />
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold">
                        Stripe
                      </span>
                    </div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      بطاقة مصرفية
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Visa / MasterCard
                    </span>
                  </button>

                  {/* PayPal */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paypal')}
                    className={`p-3 rounded-2xl border text-start transition-all ${
                      paymentMethod === 'paypal'
                        ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-cyan-600">PP</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-bold">
                        PayPal
                      </span>
                    </div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      بوابة PayPal
                    </span>
                    <span className="text-[10px] text-slate-500">
                      حماية المشتري
                    </span>
                  </button>
                </div>
              </div>

              {/* Dynamic Payment Details Area */}
              {paymentMethod === 'wallet' && (
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">الرصيد المتاح في محفظتك:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {walletBalance.toFixed(2)}$
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">قيمة الاشتراك المطلوب:</span>
                    <span className="font-black text-teal-600">
                      -{currentPlan.price}$
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-black">
                    <span>الرصيد المتبقي بعد الخصم:</span>
                    <span className={hasEnoughWalletBalance ? 'text-emerald-600' : 'text-rose-500'}>
                      {(walletBalance - currentPlan.price).toFixed(2)}$
                    </span>
                  </div>

                  {!hasEnoughWalletBalance && (
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>
                        رصيد محفظتك غير كافٍ. يرجى اختيار الدفع بـ USDT أو البطاقة المصرفية لإتمام الاشتراك.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'usdt_trc20' && (
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      أرسل مبلغ <strong className="text-teal-600">{currentPlan.price} USDT</strong> إلى العنوان:
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black">
                      شبكة TRON (TRC20)
                    </span>
                  </div>

                  {/* Copyable Address Box */}
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <code className="flex-1 text-xs font-mono text-teal-700 dark:text-teal-300 truncate select-all">
                      {activeCryptoAddress}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                    >
                      {copiedAddress ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAddress ? 'تم النسخ!' : 'نسخ'}</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      معرف المعاملة (TxID / Hash) بعد التحويل لتأكيد الاشتراك الفوري:
                    </label>
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="مثال: 9a8f4c2e... أو رقم الحوالة من محفظتك"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-hidden focus:border-teal-500"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      اسم حامل البطاقة:
                    </label>
                    <input
                      type="text"
                      required
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="الاسم كما هو مدون على البطاقة"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-teal-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      رقم البطاقة (Stripe Sandbox Secure):
                    </label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 •••• •••• 4242"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        تاريخ الانتهاء:
                      </label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM / YY"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        رمز الأمان (CVC):
                      </label>
                      <input
                        type="text"
                        required
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-teal-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'paypal' && (
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 flex items-center justify-center mx-auto font-black text-xl">
                    PP
                  </div>
                  <h5 className="font-black text-sm text-slate-900 dark:text-white">
                    الدفع الآمن عبر PayPal
                  </h5>
                  <p className="text-xs text-slate-500">
                    سيتم إرسال طلب اشتراكك بقيمة <strong>{currentPlan.price}$</strong> لمراجعة إدارة المنصة وتفعيله يدوياً خلال 24 إلى 48 ساعة.
                  </p>
                </div>
              )}

              {paymentError && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{paymentError}</p>
                </div>
              )}

              {/* Checkout Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('plans')}
                  className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                  <span>تغيير الباقة</span>
                </button>

                <button
                  type="submit"
                  disabled={isProcessing || (paymentMethod === 'wallet' && !hasEnoughWalletBalance)}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري إرسال طلب الاشتراك...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>إرسال طلب الاشتراك ({currentPlan.price}$)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Success Step: Pending-Review Receipt.
               ⚠️ لا يوجد تفعيل فوري حقيقي في هذه المنصة — الدفع يمر عبر
               مراجعة يدوية من المالك (انظر التعليق في handleConfirmPayment
               وفي App.tsx/handleUpgradeSuccess). هذه الشاشة تعرض تأكيد
               "استلام الطلب" الصادق، لا "تفعيل ناجح" وهمياً. */
            <div className="py-4 space-y-5 animate-android-in">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20 border-2 border-amber-500/30">
                  <Clock className="w-9 h-9 stroke-[2.5]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  تم استلام طلب اشتراكك ✅
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                  {paymentMethod === 'wallet'
                    ? <>سيُخصم المبلغ من محفظتك ويُفعَّل اشتراكك في <strong>{currentPlan.name}</strong> خلال 24 إلى 48 ساعة بعد المراجعة اليدوية.</>
                    : <>تتم مراجعة إثبات الدفع يدوياً خلال 24 إلى 48 ساعة، وسيُفعَّل اشتراكك في <strong>{currentPlan.name}</strong> فور التحقق.</>}
                </p>
              </div>

              {/* Order Confirmation Receipt Card */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 shadow-inner">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      إيصال طلب الاشتراك
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-black text-teal-600 dark:text-teal-400">
                    {successDetails?.referenceId}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">الباقة المطلوبة:</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {currentPlan.name}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">حد الاستخدام بعد التفعيل:</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      {successDetails?.newLimit || currentPlan.aiLimitLabel}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">حالة الطلب:</span>
                    <span className="font-black text-amber-600 dark:text-amber-400">
                      قيد المراجعة اليدوية
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all"
                >
                  حسناً، فهمت
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info when in plans step */}
        {step === 'plans' && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
            <div>
              <span className="text-[11px] text-slate-500 block">الباقة المحددة:</span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {currentPlan.name} ({currentPlan.price}$ / {currentPlan.periodLabel})
              </span>
            </div>

            <button
              onClick={handleProceedToCheckout}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 hover:from-teal-700 hover:to-cyan-700 text-white font-black text-xs sm:text-sm shadow-md shadow-teal-500/25 flex items-center gap-2 active:scale-95 transition-all"
            >
              <span>متابعة الدفع</span>
              <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

