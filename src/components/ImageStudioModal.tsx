import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  X,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  Wallet,
  AlertCircle,
  Loader2,
  RefreshCw,
  Layers,
  Ratio,
  Maximize2
} from 'lucide-react';
import { User } from '../types';
import { requestAiImageGeneration } from '../services/imageApi';

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  initialPrompt?: string;
  onSelectImage?: (url: string) => void;
  onOpenWallet?: () => void;
  onOpenAuth?: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

const STYLE_OPTIONS = [
  { id: 'oil_painting', label: 'لوحة زيتية أدبية', desc: 'فن تشكيلي كلاسيكي وألوان دافئة', icon: '🎨' },
  { id: 'surrealist', label: 'سريالي وفلسفي', desc: 'تأملي ورمزي عميق ومؤثر', icon: '🌌' },
  { id: 'photorealistic', label: 'واقعي سينمائي', desc: 'دقة فائقة كعدسة كاميرا احترافية', icon: '📷' },
  { id: 'digital_art', label: 'فن رقمي عصري', desc: 'إضاءة ديناميكية وألوان حيوية', icon: '✨' },
  { id: 'minimalist', label: 'بسيط وتجريدي', desc: 'مساحات مريحة وأناقة بصرية', icon: '◻️' },
  { id: 'arabic_calligraphy_art', label: 'زخرفة وخط عربي', desc: 'أصالة شرقية ونقوش إسلامية مذهبة', icon: '📜' },
  { id: 'fantasy', label: 'خيالي أسطوري', desc: 'أجواء سحرية وإضاءة أثيرية', icon: '🔮' }
];

const ASPECT_RATIOS = [
  { id: '16:9' as const, label: '16:9 (غلاف مقال)', desc: 'أفقي عريض مناسب للترويج والمقالات' },
  { id: '1:1' as const, label: '1:1 (مربع)', desc: 'مثالي للملف الشخصي والتواصل' },
  { id: '4:3' as const, label: '4:3 (بطاقة)', desc: 'كلاسيكي متوازن' },
  { id: '9:16' as const, label: '9:16 (ستوري)', desc: 'طولي مناسب للهواتف والقصص' }
];

const PROMPT_SUGGESTIONS = [
  'مكتبة خشبية تاريخية في ليل هادئ مع ضوء دافئ يتسلل بين الكتب القديمة',
  'مفكر يتأمل الأفق عند غروب الشمس فوق مدينة قديمة بطراز أندلسي',
  'لوحة فنية تعبر عن فلسفة الوقت وتدفق الأفكار بأسلوب سريالي ساحر',
  'قلم حبر ذهبي عتيق يكتب على ورق بردي قديم محاطاً بنقوش إسلامية وزخارف',
  'غلاف مقال مستقبلي يجمع بين الذكاء الاصطناعي وبلاغة اللغة العربية'
];

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialPrompt = '',
  onSelectImage,
  onOpenWallet,
  onOpenAuth,
  onBalanceUpdated
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState('oil_painting');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:3' | '3:4' | '9:16'>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [freeQuotaRemaining, setFreeQuotaRemaining] = useState<number | null>(null);

  React.useEffect(() => {
    if (initialPrompt && !prompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  if (!isOpen) return null;

  const isGuest = currentUser.id === 'guest';
  const isOwner = (currentUser.email || '').toLowerCase() === 'brnardtsho@gmail.com';
  const walletBalance = Number(currentUser.walletBalance ?? 0);

  const handleGenerate = async () => {
    setErrorMessage(null);
    setSuccessInfo(null);

    if (!prompt.trim()) {
      setErrorMessage('يرجى إدخال وصف للصورة المطلوب توليدها.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await requestAiImageGeneration({
        prompt,
        style,
        aspectRatio,
        user: currentUser
      });

      if (result.success && result.imageUrl) {
        setCurrentImage(result.imageUrl);
        setHistory((prev) => [result.imageUrl!, ...prev.filter((img) => img !== result.imageUrl)]);

        if (typeof result.remainingFreeUses === 'number') {
          setFreeQuotaRemaining(result.remainingFreeUses);
        }

        if (result.isAiGenerated === false) {
          // فشل الاتصال الحقيقي بمولّد الذكاء الاصطناعي على الخادم — صورة
          // بديلة من مكتبة ثابتة، لم يُخصَم أي مبلغ ولم تُستهلَك أي حصة.
          setErrorMessage(
            result.message || 'تعذّر الاتصال بمولّد الذكاء الاصطناعي، فتم عرض صورة بديلة مؤقتة. لم يُخصَم أي مبلغ.'
          );
        } else if (result.charged && result.cost) {
          setSuccessInfo(`تم توليد الصورة وخصم $${result.cost.toFixed(2)} بنجاح وتم إيداعها في رصيد المنصة.`);
          if (typeof result.newBalance === 'number' && onBalanceUpdated) {
            onBalanceUpdated(result.newBalance);
          }
        } else {
          setSuccessInfo('تم توليد الصورة بنجاح عبر حصتك المجانية!');
        }
      } else {
        setErrorMessage(result.message || 'تعذر توليد الصورة بالذكاء الاصطناعي.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء توليد الصورة.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (!currentImage) return;
    navigator.clipboard.writeText(currentImage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentImage) return;
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = `literium-ai-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      id="image-studio-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        id="image-studio-modal-container"
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-brand-500/30 shadow-2xl overflow-hidden text-slate-100 animate-android-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-brand-950/80 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-lg shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  استوديو توليد الصور الذكية
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                  Gemini Image
                </span>
              </div>
              <p className="text-xs text-slate-400">
                حوّل أفكارك ومقالاتك إلى أغلفة ولوحات فنية أدبية متقنة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Financial Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              {isOwner ? (
                <span className="text-amber-300 font-bold">حساب المالك 👑 (غير محدود)</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">رصيدك:</span>
                  <span className="font-mono font-bold text-emerald-400">${walletBalance.toFixed(2)}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-cyan-300">
                    {freeQuotaRemaining !== null ? `${freeQuotaRemaining} مجانية متبقية` : '3 صور مجانية'}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              disabled={isLoading}
              aria-label="إغلاق"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Guest Warning */}
          {isGuest && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>تصفّحك حالياً كزائر — يمكنك توليد صور مجاناً الآن، لكن سجّل الدخول لحفظ سجلّ صورك وربطها بحساب دائم.</span>
              </div>
              {onOpenAuth && (
                <button
                  onClick={onOpenAuth}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors shrink-0"
                >
                  تسجيل الدخول
                </button>
              )}
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {errorMessage.includes('شحن') && onOpenWallet && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenWallet();
                  }}
                  className="px-3 py-1 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors shrink-0"
                >
                  شحن المحفظة
                </button>
              )}
            </div>
          )}

          {/* Success Banner */}
          {successInfo && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Grid Layout: Prompt Controls & Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left/Controls Column */}
            <div className="lg:col-span-6 space-y-4">
              {/* Prompt Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <label htmlFor="ai-image-prompt" className="flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>وصف الصورة والفكرة الإبداعية *</span>
                  </label>
                  <span className="text-[11px] text-slate-500">لغة عربية أو إنجليزية</span>
                </div>
                <textarea
                  id="ai-image-prompt"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="مثال: غلاف مقال أدبي يعبر عن تأمل كاتب عربي في مكتبة عتيقة على ضوء الشموع..."
                  className="w-full p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-hidden focus:border-cyan-500 transition-colors"
                />

                {/* Suggestions Pills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400">أفكار مقترحة سريعة:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPrompt(s)}
                        className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-brand-500/50 text-[10px] text-slate-400 hover:text-slate-200 transition-colors text-start"
                      >
                        {s.slice(0, 38)}...
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Aspect Ratio Selector */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Ratio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>الأبعاد والتنسيق (Aspect Ratio)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setAspectRatio(r.id)}
                      className={`p-2.5 rounded-xl border text-start transition-all ${
                        aspectRatio === r.id
                          ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-xs'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{r.label}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Artistic Style Selector */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>النمط والأسلوب الفني</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStyle(st.id)}
                      className={`p-2.5 rounded-xl border text-start transition-all flex items-start gap-2 ${
                        style === st.id
                          ? 'bg-brand-500/20 border-brand-500 text-white shadow-xs'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-base">{st.icon}</span>
                      <div>
                        <div className="text-xs font-bold">{st.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{st.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Action Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 via-cyan-600 to-brand-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري رسم وتوليد اللوحة بالذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    <span>
                      توليد الصورة الآن{' '}
                      {isOwner ? '(مجاناً للمالك)' : walletBalance < 0.05 && freeQuotaRemaining === 0 ? '($0.05)' : ''}
                    </span>
                  </>
                )}
              </button>

              <div className="text-[10px] text-slate-500 text-center">
                * أول 3 صور مجانية لحسابك، وبعدها يُخصَم 0.05$ فقط لكل صورة من رصيد محفظتك.
              </div>
            </div>

            {/* Right/Preview Column */}
            <div className="lg:col-span-6 flex flex-col space-y-4">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>معاينة الصورة الناتجة</span>
                {currentImage && (
                  <span className="text-[10px] text-emerald-400 font-mono">جاهزة للتحميل والاستخدام</span>
                )}
              </div>

              {/* Preview Box */}
              <div className="relative flex-1 min-h-[300px] rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center p-2">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3 text-center p-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                      <Sparkles className="w-6 h-6 text-brand-400 absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">يقوم Gemini بمعالجة المشهد الفني...</p>
                      <p className="text-xs text-slate-500 mt-1">تطبيق الإضاءة، الأسلوب البصري والتفاصيل الدقيقة</p>
                    </div>
                  </div>
                ) : currentImage ? (
                  <div className="relative w-full h-full flex items-center justify-center group">
                    <img
                      src={currentImage}
                      alt="Generated"
                      referrerPolicy="no-referrer"
                      className="max-h-[380px] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="p-2 rounded-xl bg-slate-900/90 text-white hover:bg-cyan-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          title="تحميل الصورة"
                        >
                          <Download className="w-4 h-4" />
                          <span>تحميل</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyUrl}
                          className="p-2 rounded-xl bg-slate-900/90 text-white hover:bg-cyan-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          title="نسخ الرابط"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          <span>{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
                        </button>
                        {onSelectImage && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectImage(currentImage);
                              onClose();
                            }}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg"
                          >
                            <ImageIcon className="w-4 h-4" />
                            <span>استخدام كغلاف للمقال</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-600 text-center p-6">
                    <ImageIcon className="w-12 h-12 stroke-[1.2]" />
                    <p className="text-xs font-bold">لم يتم توليد أي صورة بعد</p>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      اكتب فكرتك في الحقل واضغط على "توليد الصورة الآن" لتشاهد الإبداع الفني هنا.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Toolbar if image exists */}
              {currentImage && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
                    </button>
                  </div>

                  {onSelectImage && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectImage(currentImage);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>تطبيق كغلاف للمقال</span>
                    </button>
                  )}
                </div>
              )}

              {/* History Gallery */}
              {history.length > 1 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-bold text-slate-400">الصور السابقة في هذه الجلسة:</span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {history.map((imgUrl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentImage(imgUrl)}
                        className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          currentImage === imgUrl ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ImageStudioModal;
