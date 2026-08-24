import React from 'react';

/**
 * لو كان الرابط من Cloudinary، نُدرج تحويل الجودة/الصيغة التلقائي
 * (q_auto,f_auto) مباشرة في الرابط — يختار Cloudinary أخف صيغة وجودة
 * مناسبة لجهاز/اتصال كل زائر تلقائياً (WebM/عادةً أصغر بكثير من MP4 خام)،
 * بدل تسليم نفس الملف الأصلي الثقيل للجميع دائماً.
 */
function optimizeCloudinaryVideoUrl(url: string): string {
  if (!url) return url;
  const marker = '/video/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const rest = url.slice(idx + marker.length);
  if (rest.startsWith('q_auto') || rest.startsWith('f_auto')) return url;
  return url.slice(0, idx + marker.length) + 'q_auto,f_auto/' + rest;
}

interface VideoPlayerProps {
  src: string;
  className?: string;
  poster?: string;
  onClick?: (e: React.MouseEvent<HTMLVideoElement>) => void;
}

/**
 * مشغّل الفيديو الموحّد للموقع كله (رسائل + مقالات + إعلانات) — بدل تكرار
 * وسم <video> خاماً في كل مكان بإعدادات مختلفة. يحمّل البيانات الوصفية فقط
 * أولاً (preload="metadata") بدل الملف كاملاً قبل أي تشغيل فعلي، وهذا وحده
 * يقلّص زمن ظهور الصفحة بشكل ملحوظ عند وجود فيديو لم يُشغَّل بعد.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className, poster, onClick }) => {
  return (
    <video
      src={optimizeCloudinaryVideoUrl(src)}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      className={className}
      onClick={onClick}
    />
  );
};
