import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Bot,
  User as UserIcon,
  Loader2,
  Lock,
  LogIn,
  AlertCircle,
  Wallet,
  Sparkles
} from 'lucide-react';
import { User } from '../types';
import { sendClaudeChatMessage } from '../services/claudeChatApi';

interface ClaudeChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  model?: 'haiku' | 'sonnet';
}

const FREE_DAILY_LIMIT = 10;

export const ClaudeChatModal: React.FC<ClaudeChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAuth,
  onOpenWallet,
  onBalanceUpdated
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: 'مرحباً! أنا Claude، مساعد ذكاء اصطناعي متكامل من Anthropic مدمج داخل ليتيريوم. اسألني عن أي شيء — كتابة، بحث، برمجة، أو مجرد محادثة.',
      timestamp: 'الآن'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState<{ required: number; current: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (customPrompt?: string) => {
    if (!currentUser || currentUser.id === 'guest') {
      onOpenAuth();
      return;
    }

    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || isLoading) return;

    setInsufficientBalance(null);

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    const result = await sendClaudeChatMessage(textToSend);
    setIsLoading(false);

    if (!result.success) {
      if (result.error === 'insufficient_balance') {
        setInsufficientBalance({
          required: result.requiredAmount ?? 0,
          current: result.currentBalance ?? 0
        });
        setRemainingFree(0);
        return;
      }
      if (result.error === 'auth_required') {
        onOpenAuth();
        return;
      }
      const errorMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: result.message || 'تعذّر الاتصال بـ Claude. حاول مرة أخرى.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    if (typeof result.remainingFreeUses === 'number') {
      setRemainingFree(result.remainingFreeUses);
    }
    if (result.charged && typeof result.newBalance === 'number' && onBalanceUpdated) {
      onBalanceUpdated(result.newBalance);
    }

    const aiReply: Message = {
      id: `ai_${Date.now()}`,
      sender: 'ai',
      text: result.reply || 'عذراً، لم أتمكن من توليد رد.',
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      model: result.model
    };
    setMessages((prev) => [...prev, aiReply]);
  };

  const isBlocked = insufficientBalance !== null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-xl h-[88vh] max-h-[720px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-android-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-orange-950 to-slate-900 text-white flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-orange-500/20 border border-orange-400/30 text-orange-300 flex items-center justify-center font-bold shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base">التحدث مع Claude</h3>
                  <span className="px-1.5 py-0.5 rounded-md bg-orange-500/30 text-orange-200 text-[10px] font-mono font-bold">
                    Anthropic
                  </span>
                </div>
                <p className="text-[11px] text-orange-200/90">مساعد ذكاء اصطناعي كامل، بلا قيود موضوعية</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {currentUser && currentUser.id !== 'guest' && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/25 backdrop-blur-xs border border-white/10 text-xs">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-300" />
                <span className="text-slate-200 text-[11px]">
                  {remainingFree === null ? (
                    <>حتى <strong className="text-amber-300 font-bold">{FREE_DAILY_LIMIT}</strong> رسائل مجانية اليوم (Haiku)</>
                  ) : remainingFree > 0 ? (
                    <>تبقى لك <strong className="text-amber-300 font-bold">{remainingFree}</strong> من {FREE_DAILY_LIMIT} رسائل مجانية اليوم</>
                  ) : (
                    <>استُنفدت رسائلك المجانية — المتابعة الآن من رصيد المحفظة (Sonnet)</>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Not Logged In Gate */}
        {!currentUser || currentUser.id === 'guest' ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/10">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-sm space-y-1">
              <h4 className="font-black text-lg text-slate-900 dark:text-white">
                تسجيل الدخول إجباري للتحدث مع Claude
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                يحصل كل مستخدم مسجَّل على <strong>{FREE_DAILY_LIMIT} رسائل مجانية كل 24 ساعة</strong>، ثم يمكن المتابعة بالنسخة الكاملة من رصيد محفظتك.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-500/25 flex items-center gap-2 active:scale-95 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول / إنشاء حساب مجاناً</span>
            </button>
          </div>
        ) : (
          <>
            {/* Chat Feed */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      msg.sender === 'user'
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-300'
                    }`}
                  >
                    {msg.sender === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-orange-600 text-white rounded-te-none font-medium'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-ts-none'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.text}</div>
                    <span
                      className={`block text-[9px] mt-1 text-end ${
                        msg.sender === 'user' ? 'text-orange-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                      {msg.model === 'sonnet' && ' · Sonnet'}
                    </span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 font-bold p-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Claude يكتب رداً...</span>
                </div>
              )}
            </div>

            {/* Insufficient Balance Banner */}
            {isBlocked && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span className="text-[11px]">
                    رصيدك (${insufficientBalance.current.toFixed(2)}) غير كافٍ لمتابعة المحادثة (تكلفة الرسالة ${insufficientBalance.required.toFixed(2)}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>شحن المحفظة</span>
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
                  disabled={isLoading}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="اكتب رسالتك لـ Claude هنا..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-orange-500 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
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
