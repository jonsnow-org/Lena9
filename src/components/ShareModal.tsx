import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** عنوان المحتوى المُشارَك (اسم الكاتب للتغريدة، عنوان المقال...) */
  title: string;
  /** مقتطف نصي قصير يظهر أسفل العنوان داخل بطاقة المعاينة */
  excerpt?: string;
  imageUrl?: string;
  url: string;
}

/**
 * نافذة مشاركة موحّدة تُستخدم للمقالات والتغريدات معاً — بديل "نسخ الرابط
 * فوراً بلا أي شيء آخر" (كان هذا كل ما يحدث عند مشاركة تغريدة تحديداً إن
 * لم يدعم المتصفح Web Share API). تعرض بطاقة معاينة بصرية حقيقية (صورة إن
 * وُجدت + العنوان + مقتطف + شعار المنصة) بدل رابط عارٍ، بالإضافة لأزرار
 * مشاركة مباشرة لأشهر المنصات ونسخ الرابط — هذا ما يُشجّع فعلياً على
 * انتشار المحتوى بدل رابط نصي جاف قليل الجاذبية.
 * تُستدعى فقط كبديل احتياطي حين navigator.share غير متاح أو ألغاه
 * المستخدم؛ الجهاز الذي يدعم مشاركة النظام الأصلية يستخدمها مباشرة (وهي
 * نفسها بطاقة/قائمة تطبيقات حقيقية توفرها المنصة).
 */
export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, title, excerpt, imageUrl, url }) => {
  const [copied, setCopied] = useState(false);
  useEscapeToClose(onClose, isOpen);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = excerpt ? `${title} — ${excerpt}` : title;

  return (
    <div
      className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-android-in overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <h4 className="font-bold text-base text-slate-900 dark:text-white">مشاركة</h4>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* بطاقة المعاينة — هذا ما يُشاهده من يستقبل الرابط عند لصقه غالباً */}
        <div className="mx-5 mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
          {imageUrl && <img src={imageUrl} alt="" className="w-full h-28 object-cover" />}
          <div className="p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-teal-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                ل
              </span>
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400">ليتيريوم</span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">{title}</p>
            {excerpt && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{excerpt}</p>
            )}
            <p dir="ltr" className="text-[10px] text-slate-400 truncate text-start">
              {url}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 px-5 mt-4">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold"
          >
            <span className="text-lg">𝕏</span>
            <span className="text-[10px]">تويتر</span>
          </a>
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${url}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-xs font-semibold"
          >
            <span className="text-lg">💬</span>
            <span className="text-[10px]">واتساب</span>
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-950 text-xs font-semibold"
          >
            <span className="text-lg">✈️</span>
            <span className="text-[10px]">تيليجرام</span>
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950 text-xs font-semibold"
          >
            <span className="text-lg">📘</span>
            <span className="text-[10px]">فيسبوك</span>
          </a>
        </div>

        <div className="flex gap-2 p-5 pt-4">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ الرابط!' : 'نسخ الرابط'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
