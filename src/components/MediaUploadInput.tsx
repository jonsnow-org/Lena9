import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, Link2, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchMediaUploadStatus, uploadAdMedia } from '../services/mediaApi';

let cachedConfigured: boolean | null = null;
let inFlight: Promise<boolean> | null = null;
function getUploadConfigured(): Promise<boolean> {
  if (cachedConfigured !== null) return Promise.resolve(cachedConfigured);
  if (!inFlight) {
    inFlight = fetchMediaUploadStatus().then((v) => {
      cachedConfigured = v;
      return v;
    });
  }
  return inFlight;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 60;

interface MediaUploadInputProps {
  kind: 'image' | 'video';
  value: string;
  onChange: (url: string) => void;
  label: string;
}

/**
 * حقل وسائط بديل يدعم الرفع الحقيقي (Cloudinary) عندما يكون مفعّلاً على
 * الخادم، ويعود تلقائياً لحقل رابط خارجي فقط عندما لا يكون كذلك — دون
 * كسر أي شيء ودون إظهار زر رفع لا يعمل.
 */
export const MediaUploadInput: React.FC<MediaUploadInputProps> = ({ kind, value, onChange, label }) => {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getUploadConfigured().then((v) => {
      if (mounted) setConfigured(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const validateVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
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

  const handleFile = async (file: File) => {
    setErrorMsg('');

    if (kind === 'image') {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('يرجى اختيار ملف صورة صالح.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setErrorMsg('حجم الصورة يتجاوز 8 ميغابايت.');
        return;
      }
    } else {
      if (!file.type.startsWith('video/')) {
        setErrorMsg('يرجى اختيار ملف فيديو صالح.');
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setErrorMsg('حجم الفيديو يتجاوز 50 ميغابايت.');
        return;
      }
      try {
        const duration = await validateVideoDuration(file);
        if (duration > MAX_VIDEO_DURATION_SECONDS) {
          setErrorMsg('مدة الفيديو تتجاوز الدقيقة المسموحة. يرجى اختيار مقطع أقصر.');
          return;
        }
      } catch {
        // لا نمنع الرفع إن فشل قياس المدة محلياً — الخادم يتحقق منها فعلياً بعد الرفع
      }
    }

    setStatus('uploading');
    try {
      const result = await uploadAdMedia(file);
      onChange(result.url);
      setStatus('done');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'تعذر رفع الملف.');
    }
  };

  // لا يزال يتحقق من حالة الخادم — لا نعرض شيئاً بعد لتفادي الوميض
  if (configured === null) return null;

  // الرفع غير مفعّل على الخادم: حقل رابط خارجي فقط (السلوك السابق)
  if (!configured) {
    return (
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Link2 className="w-3.5 h-3.5" />
          {label} (رابط خارجي)
        </label>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          dir="ltr"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500 text-start"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <UploadCloud className="w-3.5 h-3.5" />
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlField((s) => !s)}
          className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
        >
          {showUrlField ? 'رفع ملف بدلاً من ذلك' : 'أو ضع رابطاً جاهزاً'}
        </button>
      </div>

      {showUrlField ? (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          dir="ltr"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500 text-start"
        />
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={kind === 'image' ? 'image/*' : 'video/*'}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />

          {value && status !== 'uploading' ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              {kind === 'image' ? (
                <img src={value} alt="" className="w-full max-h-40 object-cover" />
              ) : (
                <video src={value} controls className="w-full max-h-40" />
              )}
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setStatus('idle');
                }}
                className="absolute top-1.5 end-1.5 p-1 rounded-lg bg-slate-950/70 text-white hover:bg-slate-950"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {status === 'done' && (
                <div className="absolute bottom-1.5 start-1.5 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600/90 text-white text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  تم الرفع
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={status === 'uploading'}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold flex flex-col items-center gap-1.5 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors disabled:opacity-60"
            >
              {status === 'uploading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري الرفع...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span>{kind === 'image' ? 'انقر لرفع صورة (حتى 8 ميغابايت)' : 'انقر لرفع فيديو قصير (حتى دقيقة، 50 ميغابايت)'}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-1.5 text-[11px] text-rose-500 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
