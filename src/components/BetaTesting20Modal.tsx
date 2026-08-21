import React, { useState } from 'react';
import {
  Users,
  X,
  CheckCircle2,
  Send,
  Star,
  Smartphone,
  ShieldCheck,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BetaTesting20ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BetaTesting20Modal: React.FC<BetaTesting20ModalProps> = ({
  isOpen,
  onClose
}) => {
  const [testerName, setTesterName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [deviceModel, setDeviceModel] = useState('Samsung Galaxy S24 / Pixel 8');
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);

  // Simulated 20 testers roster
  const [testersCount, setTestersCount] = useState(18);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setSubmitted(true);
    setTestersCount((c) => Math.min(20, c + 1));
    try {
      confetti({ particleCount: 70, spread: 60 });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-brand-900 via-brand-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-600/30 border border-brand-400/30 text-brand-300 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">
                برنامج الـ 20 مجرب (Google Play Beta)
              </h3>
              <p className="text-xs text-brand-200">
                اختبار الأداء والملاحظات قبل الإطلاق الرسمي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Progress Tracker */}
          <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-brand-900 dark:text-brand-200">
                اكتمال متطلبات جوجل بلاي المغلقة (14 يوماً):
              </span>
              <span className="text-brand-600 dark:text-brand-400">{testersCount} / 20 مجرب</span>
            </div>
            <div className="w-full h-2.5 bg-brand-200 dark:bg-brand-900/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${(testersCount / 20) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-brand-700 dark:text-brand-300 mt-2">
              ✓ تم استيفاء معايير استقرار التطبيق وتجربة المستخدم RTL وتقاسم الأرباح.
            </p>
          </div>

          {submitted ? (
            <div className="p-6 text-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-black text-emerald-900 dark:text-emerald-200">
                شكراً لمشاركتك القيّمة!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                تم تسجيل تقريرك بنجاح وسيسهم في تحسين منصة ليتيريوم قبل إصدار الإنتاج النهائي على متجر Google Play.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  اسم المجرب
                </label>
                <input
                  type="text"
                  required
                  value={testerName}
                  onChange={(e) => setTesterName(e.target.value)}
                  placeholder="مثال: م. أحمد الخالدي"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  نوع الجهاز ونظام التشغيل
                </label>
                <input
                  type="text"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  تقييم الاستقرار وتجربة الاستخدام:
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                  الملاحظات والاقتراحات
                </label>
                <textarea
                  rows={3}
                  required
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="اكتب ملاحظاتك حول سرعة التصفح، وضوح الخطوط العربية، وسلاسة نموذج الأرباح..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-brand-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md"
              >
                إرسال تقرير التجربة
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
