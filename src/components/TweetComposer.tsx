import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { User } from '../types';
import { uploadAdMedia, fetchMediaUploadStatus } from '../services/mediaApi';
import { VideoPlayer } from './VideoPlayer';

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

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
  // لوحة إرفاق واحدة قابلة للطي والإغلاق — زر "إرفاق" وحيد يفتحها عند
  // الطلب فقط (بدل فتح منتقي الملفات مباشرة بلا تحذير)، وتحوي داخلها كِلا
  // الخيارين معاً (رفع من الجهاز / لصق رابط جاهز) مع زر إغلاق صريح. الإصدار
  // السابق كان يفتح صفاً منفصلاً دائماً بلا إغلاق بمجرد فشل رفع واحد —
  // فيبقى شريط خطأ أحمر عالقاً في صندوق التغريد الرئيسي الذي يراه كل
  // مستخدم، بلا أي طريقة لإخفائه. هذا التصميم يحتوي كل شيء في مكان واحد
  // مضغوط يُغلَق تلقائياً عند النجاح، أو يدوياً بضغطة X في أي وقت.
  const [attachPanelOpen, setAttachPanelOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const remaining = MAX_TWEET_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isPosting && !imageUploading;

  const handlePickImage = async () => {
    setImageError('');
    // بمجرد تأكيد التفعيل مرة، لا حاجة لإعادة التحقق. لكن نتيجة سلبية لا
    // تُحفَظ أبداً في uploadConfigured (يبقى null) — فشل التحقق مرة واحدة
    // (غالباً خادم Render لا يزال يستيقظ من سبات، أو انقطاع شبكة عابر) كان
    // يُعطِّل زر الإرفاق نهائياً لبقية عمر هذا المكوّن بلا أي إعادة محاولة.
    // كل ضغطة تالية تعيد المحاولة من الصفر إن لم تنجح سابقاً.
    if (uploadConfigured) {
      fileInputRef.current?.click();
      return;
    }
    const configured = await fetchMediaUploadStatus();
    if (configured) {
      setUploadConfigured(true);
      fileInputRef.current?.click();
    } else {
      setImageError('تعذّر الاتصال بخدمة رفع الملفات الآن. الصق رابطاً جاهزاً بدلاً من ذلك، أو حاول لاحقاً.');
    }
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    setImageError('');
    setImageUrl(url);
    setMediaType(VIDEO_URL_PATTERN.test(url) ? 'video' : 'image');
    setUrlInput('');
    setAttachPanelOpen(false);
  };

  const closeAttachPanel = () => {
    setAttachPanelOpen(false);
    setImageError('');
    setUrlInput('');
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
      setAttachPanelOpen(false);
    } catch (err: any) {
      setImageError(err?.message || 'تعذر رفع الملف.');
    } finally {
      setImageUploading(false);
    }
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

          {attachPanelOpen && !imageUrl && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إرفاق صورة أو فيديو قصير</span>
                <button
                  type="button"
                  onClick={closeAttachPanel}
                  aria-label="إغلاق"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {imageUploading ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري رفع الملف...</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePickImage}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-brand-400"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>رفع من الجهاز</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span>أو</span>
                <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  dir="ltr"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUrlSubmit();
                    }
                  }}
                  placeholder="https://... رابط صورة أو فيديو مباشر"
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-brand-500 text-start"
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-[11px] font-bold shrink-0"
                >
                  إرفاق
                </button>
              </div>

              {imageError && <p className="text-[11px] text-rose-500 font-medium">{imageError}</p>}
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
                onClick={() => setImageUrl('')}
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
                onClick={() => {
                  if (attachPanelOpen) {
                    closeAttachPanel();
                  } else {
                    setImageError('');
                    setAttachPanelOpen(true);
                  }
                }}
                disabled={imageUploading}
                className={`p-2 rounded-lg transition-all active:scale-90 disabled:opacity-40 ${
                  attachPanelOpen
                    ? 'text-brand-600 bg-brand-50 dark:bg-brand-950/20'
                    : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20'
                }`}
                title="إرفاق صورة أو فيديو قصير"
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
