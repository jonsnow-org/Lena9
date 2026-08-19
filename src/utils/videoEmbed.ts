/**
 * دعم الوسائط المرئية عبر التضمين (Embed) بدلاً من الرفع المباشر.
 *
 * السبب: رفع الملفات يحتاج Firebase Storage، وهو غير متاح في خطة Spark
 * المجانية. التضمين من يوتيوب أو Vimeo مجاني تماماً، ولا يستهلك تخزيناً
 * ولا نطاقاً من المنصة، ويحمّل أسرع للقارئ.
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'unknown';

export interface ParsedVideo {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  thumbnailUrl: string;
}

/**
 * يستخرج معرّف الفيديو من رابط يوتيوب بكل صيغه المعروفة.
 */
function parseYouTube(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function parseVimeo(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/**
 * يحلّل رابط فيديو ويعيد بيانات التضمين، أو null إن كان الرابط غير مدعوم.
 */
export function parseVideoUrl(url: string): ParsedVideo | null {
  if (!url || !url.trim()) return null;
  const clean = url.trim();

  const ytId = parseYouTube(clean);
  if (ytId) {
    return {
      provider: 'youtube',
      videoId: ytId,
      // rel=0 يقلل اقتراحات الفيديوهات الخارجية بعد الانتهاء
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    };
  }

  const vimeoId = parseVimeo(clean);
  if (vimeoId) {
    return {
      provider: 'vimeo',
      videoId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      thumbnailUrl: ''
    };
  }

  return null;
}

export function isValidVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}

/**
 * يتحقق من أن رابط الصورة صالح الشكل.
 * لا نرفع الصور — تُستخدم روابط خارجية فقط.
 */
export function isValidImageUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
