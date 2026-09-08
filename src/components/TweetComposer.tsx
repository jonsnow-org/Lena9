import React, { useRef, useState } from 'react';
import { Send, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { User } from '../types';
import { uploadAdMedia, fetchMediaUploadStatus } from '../services/mediaApi';

const MAX_TWEET_LENGTH = 280;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface TweetComposerProps {
  currentUser: User;
  onSubmit: (content: string, imageUrl?: string) => void | Promise<void>;
  placeholder?: string;
}

export const TweetComposer: React.FC<TweetComposerProps> = ({
  currentUser,
  onSubmit,
  placeholder = 'بماذا تفكر؟ شارك خاطرة قصيرة...'
}) => {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [uploadConfigured, setUploadConfigured] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const remaining = MAX_TWEET_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isPosting && !imageUploading;

  const handlePickImage = async () => {
    if (uploadConfigured === null) {
      const configured = await fetchMediaUploadStatus();
      setUploadConfigured(configured);
      if (!configured) {
        setImageError('رفع الصور غير مفعّل على الخادم حالياً.');
        return;
      }
    } else if (!uploadConfigured) {
      setImageError('رفع الصور غير مفعّل على الخادم حالياً.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImageFile = async (file: File) => {
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('يرجى اختيار ملف صورة صالح.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('حجم الصورة يتجاوز 8 ميغابايت.');
      return;
    }
    setImageUploading(true);
    try {
      const result = await uploadAdMedia(file, 'tweet');
      setImageUrl(result.url);
    } catch (err: any) {
      setImageError(err?.message || 'تعذر رفع الصورة.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsPosting(true);
    try {
      await onSubmit(content.trim(), imageUrl || undefined);
      setContent('');
      setImageUrl('');
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-transparent text-sm resize-none outline-hidden placeholder-slate-400 text-slate-900 dark:text-white"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = '';
            }}
          />

          {imageUploading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>جاري رفع الصورة...</span>
            </div>
          )}

          {imageUrl && !imageUploading && (
            <div className="relative inline-block">
              <img src={imageUrl} alt="" className="max-h-40 rounded-xl border border-slate-200 dark:border-slate-700 object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute top-1.5 end-1.5 p-1 rounded-lg bg-slate-950/70 text-white hover:bg-slate-950 active:scale-90 transition-transform"
                title="إزالة الصورة"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {imageError && <p className="text-[11px] text-rose-500 font-medium">{imageError}</p>}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePickImage}
                disabled={imageUploading}
                className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 active:scale-90 transition-all disabled:opacity-40"
                title="إرفاق صورة"
              >
                <ImageIcon className="w-4 h-4" />
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
