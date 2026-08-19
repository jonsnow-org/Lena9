import React from 'react';
import { Video, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseVideoUrl } from '../utils/videoEmbed';

interface VideoEmbedProps {
  url: string;
  className?: string;
}

/**
 * مشغّل فيديو مضمّن من يوتيوب أو Vimeo.
 * لا يشغّل تلقائياً ولا يصدر صوتاً بلا تفاعل من المستخدم.
 */
export const VideoEmbed: React.FC<VideoEmbedProps> = ({ url, className = '' }) => {
  const parsed = parseVideoUrl(url);
  if (!parsed) return null;

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden bg-slate-900 ${className}`}>
      {/* نسبة 16:9 محجوزة مسبقاً حتى لا يقفز المحتوى عند التحميل */}
      <div style={{ paddingTop: '56.25%' }} />
      <iframe
        src={parsed.embedUrl}
        title="فيديو"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
};

interface VideoUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** الحد الأقصى للمدة بالثواني — للعرض فقط، يتحقق منه الأدمن بصرياً */
  maxDurationHint?: string;
}

/**
 * حقل إدخال رابط فيديو مع تحقق فوري ومعاينة.
 *
 * ⚠️ لا نرفع ملفات — الرفع يحتاج Firebase Storage غير المتاح في الخطة
 * المجانية. التضمين مجاني وأسرع للقارئ.
 */
export const VideoUrlInput: React.FC<VideoUrlInputProps> = ({
  value,
  onChange,
  label = 'رابط فيديو (اختياري)',
  maxDurationHint
}) => {
  const parsed = parseVideoUrl(value);
  const hasInput = Boolean(value && value.trim());

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
        <Video className="w-3.5 h-3.5" />
        {label}
      </label>

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="الصق رابط يوتيوب أو Vimeo هنا..."
        dir="ltr"
        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500 text-start"
      />

      {hasInput && !parsed && (
        <div className="flex items-start gap-2 text-[11px] text-rose-500 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            رابط غير مدعوم. المدعوم حالياً: يوتيوب (youtube.com أو youtu.be) و Vimeo.
          </span>
        </div>
      )}

      {parsed && (
        <>
          <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تم التعرف على الفيديو ({parsed.provider === 'youtube' ? 'يوتيوب' : 'Vimeo'})</span>
          </div>
          <VideoEmbed url={value} />
        </>
      )}

      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
        نستخدم روابط التضمين بدلاً من رفع الملفات — أسرع للقارئ ولا يستهلك مساحة تخزين.
        {maxDurationHint && ` ${maxDurationHint}`}
      </p>
    </div>
  );
};
