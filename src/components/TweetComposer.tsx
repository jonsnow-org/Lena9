import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { User } from '../types';
import { uploadAdMedia, fetchMediaUploadStatus } from '../services/mediaApi';
import { VideoPlayer } from './VideoPlayer';

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const IMAGE_URL_PATTERN = /\.(jpe?g|png|gif|webp)(\?.*)?$/i;
const ANY_URL_PATTERN = /https?:\/\/\S+/i;

const MAX_TWEET_LENGTH = 280;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
// نفس حد المدة الفعلي على الخادم لمقاطع فيديو التغريد (server.ts، purpose='tweet'
// يقع على القيمة الافتراضية MAX_VIDEO_DURATION_SECONDS=61) — 60 هنا فقط للعرض
// المبسّط على المستخدم؛ الخادم هو الحَكَم الفعلي النهائي بهامش الثانية الإضافية.
const MAX_VIDEO_SECONDS = 60;

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('تعذر قراءة معلومات الفيديو.'));
    };
    video.src = URL.createObjectURL(file);
  });
}

interface TweetComposerProps {
  currentUser: User;
  onSubmit: (content: string, imageUrl?: string, mediaType?: 'image' | 'video') => void | Promise<void>;
  placeholder?: string;
  /** يتغيّر (رقم متزايد) كلما ضُغط زر الكتابة العائم أثناء وضع التغريد — يُمرَّر
   *  من App.tsx عبر TweetFeed. عند تغيّره نُمرِّر الصفحة لهذا المُنشئ ونُركِّز
   *  حقل النص مباشرة، بدل ترك المستخدم يبحث عنه يدوياً أعلى الخلاصة. */
  focusTrigger?: number;
}

export const TweetComposer: React.FC<TweetComposerProps> = ({
  currentUser,
  onSubmit,
  placeholder = 'بماذا تفكر؟ شارك خاطرة قصيرة...',
  focusTrigger
}) => {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!focusTrigger) return;
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTrigger]);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [uploadConfigured, setUploadConfigured] = useState<boolean | null>(null);
  // مصدر المرفق الحالي: 'upload' (رفع فعلي من الجهاز) أو 'link' (اكتُشف
  // تلقائياً من نص التغريدة). التمييز ضروري لأمرين: (1) لا يصح أن يُصادر
  // رابط عرضي داخل النص صورة رُفعت فعلاً من الجهاز، (2) عند إزالة معاينة
  // رابط بضغطة X نُسجّل الرابط في dismissedLinkUrl كي لا يُعاد اكتشافه
  // فوراً من نفس النص الذي لم يتغيّر بعد.
  const [attachmentSource, setAttachmentSource] = useState<'upload' | 'link' | null>(null);
  const [dismissedLinkUrl, setDismissedLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const remaining = MAX_TWEET_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  // يمكن نشر تغريدة بصورة/فيديو فقط بلا أي نص إطلاقاً — نفس سلوك منصات
  // التغريد المعروفة؛ النص مطلوب فقط في حال عدم وجود أي مرفق أصلاً.
  const canSubmit = (content.trim().length > 0 || !!imageUrl) && !isOverLimit && !isPosting && !imageUploading;

  // اكتشاف رابط صورة/فيديو مباشر دُوِّن داخل نص التغريدة نفسه وعرض معاينته
  // تلقائياً — بدل حقل رابط منفصل يفتحه المستخدم يدوياً بخطوة إضافية. هذا
  // هو نفس أسلوب منصات التغريد المعروفة: الصق الرابط في النص، تظهر
  // المعاينة من تلقاء نفسها.
  useEffect(() => {
    if (attachmentSource === 'upload') return;
    const match = content.match(ANY_URL_PATTERN);
    const url = match ? match[0] : '';
    if (!url) {
      if (attachmentSource === 'link') {
        setImageUrl('');
        setAttachmentSource(null);
      }
      setDismissedLinkUrl('');
      return;
    }
    if (url === dismissedLinkUrl || url === imageUrl) return;
    const isVideo = VIDEO_URL_PATTERN.test(url);
    const isImage = IMAGE_URL_PATTERN.test(url);
    if (isVideo || isImage) {
      setImageUrl(url);
      setMediaType(isVideo ? 'video' : 'image');
      setAttachmentSource('link');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, attachmentSource, dismissedLinkUrl]);

  const handlePickImage = async () => {
    setImageError('');
    // بمجرد تأكيد التفعيل مرة، لا حاجة لإعادة التحقق. لكن نتيجة سلبية لا
    // تُحفَظ أبداً في uploadConfigured (يبقى null) — فشل التحقق مرة واحدة
    // (غالباً خادم Render لا يزال يستيقظ من سبات، أو انقطاع شبكة عابر) كان
    // يُعطِّل زر الإرفاق نهائياً لبقية عمر هذا المكوّن بلا أي إعادة محاولة.
    // كل ضغطة تالية تعيد المحاولة من الصفر إن لم تنجح سابقاً.
    // زر الإرفاق يفتح منتقي ملفات الجهاز مباشرة بضغطة واحدة — لا لوحة
    // وسيطة بعد الآن؛ إرفاق رابط أصبح عبر لصقه داخل نص التغريدة نفسه.
    if (uploadConfigured) {
      fileInputRef.current?.click();
      return;
    }
    const configured = await fetchMediaUploadStatus();
    if (configured) {
      setUploadConfigured(true);
      fileInputRef.current?.click();
    } else {
      setImageError('رفع الملفات من الجهاز غير مفعّل على هذا الخادم بعد. الصق رابطاً جاهزاً داخل نص التغريدة بدلاً من ذلك.');
    }
  };

  const handleImageFile = async (file: File) => {
    setImageError('');
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setImageError('يرجى اختيار ملف صورة أو فيديو صالح.');
      return;
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setImageError('حجم الصورة يتجاوز 8 ميغابايت.');
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setImageError('حجم الفيديو يتجاوز 50 ميغابايت.');
      return;
    }
    if (isVideo) {
      try {
        const duration = await readVideoDuration(file);
        if (duration > MAX_VIDEO_SECONDS) {
          setImageError('مدة الفيديو تتجاوز الدقيقة المسموحة.');
          return;
        }
      } catch (err: any) {
        setImageError(err?.message || 'تعذر قراءة معلومات الفيديو.');
        return;
      }
    }
    setImageUploading(true);
    try {
      const result = await uploadAdMedia(file, 'tweet');
      setImageUrl(result.url);
      setMediaType(isVideo ? 'video' : 'image');
      setAttachmentSource('upload');
    } catch (err: any) {
      setImageError(err?.message || 'تعذر رفع الملف.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleRemoveAttachment = () => {
    if (attachmentSource === 'link') setDismissedLinkUrl(imageUrl);
    setImageUrl('');
    setAttachmentSource(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsPosting(true);
    try {
      await onSubmit(content.trim(), imageUrl || undefined, imageUrl ? mediaType : undefined);
      setContent('');
      setImageUrl('');
      setMediaType('image');
      setImageError('');
      setAttachmentSource(null);
      setDismissedLinkUrl('');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
      <div className="flex items-start gap-3">
        <img
          src={currentUser.avatarUrl}
          alt={currentUser.fullName}
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-transparent text-sm resize-none outline-hidden placeholder-slate-400 text-slate-900 dark:text-white"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = '';
            }}
          />

          {imageUploading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>جاري رفع الملف...</span>
            </div>
          )}

          {imageError && !imageUploading && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-600 dark:text-rose-400">
              <span>{imageError}</span>
              <button
                type="button"
                onClick={() => setImageError('')}
                aria-label="إغلاق"
                className="p-0.5 rounded shrink-0 hover:text-rose-800 dark:hover:text-rose-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {imageUrl && !imageUploading && (
            <div className="relative inline-block">
              {mediaType === 'video' ? (
                <VideoPlayer src={imageUrl} className="max-h-40 rounded-xl border border-slate-200 dark:border-slate-700" />
              ) : (
                <img src={imageUrl} alt="" className="max-h-40 rounded-xl border border-slate-200 dark:border-slate-700 object-cover" />
              )}
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="absolute top-1.5 end-1.5 p-1 rounded-lg bg-slate-950/70 text-white hover:bg-slate-950 active:scale-90 transition-transform"
                title="إزالة المرفق"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePickImage}
                disabled={imageUploading}
                className="p-2 rounded-lg transition-all active:scale-90 disabled:opacity-40 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20"
                title="إرفاق صورة أو فيديو من الجهاز"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <span
                className={`text-[11px] font-mono font-bold ${
                  isOverLimit
                    ? 'text-rose-500'
                    : remaining <= 20
                    ? 'text-amber-500'
                    : 'text-slate-400'
                }`}
              >
                {remaining}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all active:scale-90"
            >
              <span>{isPosting ? 'جارٍ النشر...' : 'تغريد'}</span>
              <Send className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
