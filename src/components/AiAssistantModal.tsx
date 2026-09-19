import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User as UserIcon,
  HelpCircle,
  DollarSign,
  PenTool,
  Megaphone,
  Loader2,
  Lock,
  LogIn,
  Crown,
  Zap,
  AlertCircle,
  Clock
} from 'lucide-react';
import { User } from '../types';
import { getRemainingAiUses } from '../utils/aiQuota';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenSubscription: () => void;
  onConsumeAiQuota: () => boolean;
  /** معرّف الزائر الثابت لهذا المتصفح (جلسة Firebase مجهولة حقيقية) —
   *  يُستخدم كمفتاح حصة يومية مستقل لكل زائر بدل مفتاح "guest" واحد
   *  مشترك بين كل الزوار حول العالم. */
  guestIdentityUid?: string;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAuth,
  onOpenSubscription,
  onConsumeAiQuota,
  guestIdentityUid
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: 'مرحباً بك! أنا المساعد الذكي لمنصة "ليتيريوم" (LITERIUM). يسعدني إرشادك في كل ما يتعلق بقراءة المقالات، كتابة ونشر المحتوى، تقاسم أرباح Google AdSense والمقالات المقفولة، وإطلاق الحملات الإعلانية. كيف أساعدك اليوم؟',
      timestamp: 'الآن'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const userRole = currentUser?.role || 'reader';
  const quotaStats = currentUser ? getRemainingAiUses(currentUser.aiQuota) : null;
  const isOutOfQuota = quotaStats ? !quotaStats.isUnlimited && quotaStats.remaining <= 0 : true;

  const handleSend = async (customPrompt?: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (isOutOfQuota) {
      onOpenSubscription();
      return;
    }

    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || isLoading) return;

    // Deduct quota locally and verify
    const allowed = onConsumeAiQuota();
    if (!allowed) {
      onOpenSubscription();
      return;
    }

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          userRole,
          language: 'ar',
          userId: currentUser.id !== 'guest' ? currentUser.id : guestIdentityUid || 'guest',
          isSubscriber: quotaStats?.isSubscriber,
          plan: quotaStats?.plan
        })
      });

      const data = await res.json();
      if (!res.ok && data.error === 'quota_exceeded') {
        const errorMsg: Message = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: '⚠️ لقد استنفدت حد الاستخدام المجاني المخصص لك لليوم (10 استخدامات). يرجى الترقية إلى إحدى باقات Pro للاستمرار في المحادثة غير المحدودة.',
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const aiReply: Message = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.reply || 'شكراً لسؤالك! أنا دائماً هنا لمساعدتك.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch {
      const fallbackMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: `يسرني مساعدتك في منصة ليتيريوم! يمكنك استكشاف المقالات، كتابة مقال جديد بربح ${REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% من الإعلانات و${REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% من المقالات المقفولة، أو إطلاق حملة إعلانية كمعلن.`,
        timestamp: 'الآن'
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-xl h-[88vh] max-h-[720px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-android-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 text-white flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-teal-500/20 border border-teal-400/30 text-teal-300 flex items-center justify-center font-bold shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base">المساعد الذكي ليتيريوم</h3>
                  <span className="px-1.5 py-0.5 rounded-md bg-teal-500/30 text-teal-200 text-[10px] font-mono font-bold">
                    Gemini 3.7
                  </span>
                </div>
                <p className="text-[11px] text-teal-200/90">
                  إرشاد مالي وثقافي وأدوات ذكية متكاملة
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Real-time AI Quota Counter Bar */}
          {currentUser && quotaStats && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/25 backdrop-blur-xs border border-white/10 text-xs">
              <div className="flex items-center gap-1.5">
                {quotaStats.isSubscriber ? (
                  <>
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-amber-300 text-[11px]">
                      {quotaStats.plan === 'annual'
                        ? 'مشترك VIP السنوي (استخدام غير محدود)'
                        : `مشترك Pro (متبقي ${quotaStats.remaining} استخدام شهري)`}
                    </span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-teal-300" />
                    <span className="text-slate-200 text-[11px]">
                      تبقى لك{' '}
                      <strong className="text-amber-300 font-bold">
                        {quotaStats.remaining} من {quotaStats.limit}
                      </strong>{' '}
                      استخدامات مجانية اليوم
                    </span>
                  </>
                )}
              </div>

              {!quotaStats.isSubscriber ? (
                <button
                  type="button"
                  onClick={onOpenSubscription}
                  className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-[10px] shadow-xs active:scale-95 transition-all flex items-center gap-1"
                >
                  <Crown className="w-3 h-3" />
                  <span>ترقية الباقة</span>
                </button>
              ) : (
                <span className="text-[10px] text-emerald-300 font-bold">نشط</span>
              )}
            </div>
          )}
        </div>

        {/* Not Logged In Gate */}
        {!currentUser ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-sm space-y-1">
              <h4 className="font-black text-lg text-slate-900 dark:text-white">
                تسجيل الدخول إجباري لاستخدام المساعد الذكي
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                لحماية استهلاك الخدمة وتقديم تجربة مخصصة لك، يتطلب الذكاء الاصطناعي تسجيل الدخول. يحصل كل مستخدم جديد على <strong>10 استخدامات مجانية كل 24 ساعة</strong>.
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-500/25 flex items-center gap-2 active:scale-95 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول / إنشاء حساب مجاناً</span>
            </button>
          </div>
        ) : (
          <>
            {/* Quick Shortcuts */}
            <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <button
                onClick={() => handleSend('كيف يتم توزيع أرباح إعلانات Google AdSense والمقالات المقفولة؟')}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-slate-200 dark:border-slate-700 shrink-0"
              >
                💰 نظام الأرباح
              </button>
              <button
                onClick={() => handleSend('كيف أقوم بتوثيق حسابي (KYC) وسحب الأرباح؟')}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-slate-200 dark:border-slate-700 shrink-0"
              >
                🛡️ توثيق KYC والسحب
              </button>
              <button
                onClick={() => handleSend('كيف أنشئ حملة إعلانية بالنقرات CPC أو مدة ثابتة؟')}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-slate-200 dark:border-slate-700 shrink-0"
              >
                📢 إطلاق إعلان
              </button>
            </div>

            {/* Chat Feed */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${
                    msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-teal-600 dark:text-teal-300'
                    }`}
                  >
                    {msg.sender === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-te-none font-medium'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-ts-none'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.text}</div>
                    <span
                      className={`block text-[9px] mt-1 text-end ${
                        msg.sender === 'user' ? 'text-teal-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400 font-bold p-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري المعالجة وتوليد الإجابة...</span>
                </div>
              )}
            </div>

            {/* Out of Quota Block Banner */}
            {isOutOfQuota && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span className="text-[11px]">
                    استنفدت الـ 10 استخدامات المجانية لليوم. ترقية الباقة تمنحك استخداماً فورياً غير محدود.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSubscription}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs"
                >
                  ترقية الآن
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  disabled={isOutOfQuota || isLoading}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isOutOfQuota
                      ? 'انتهت الاستخدامات المجانية لليوم. يرجى الترقية للمتابعة...'
                      : 'اكتب استفسارك هنا وسيجيبك المساعد فوراً...'
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading || isOutOfQuota}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <span>إرسال</span>
                  <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
